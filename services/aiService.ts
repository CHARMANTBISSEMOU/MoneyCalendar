import axios from 'axios';
import { categoriesRepo, creancesRepo } from '@/services/data';
import { assertGroqConfigured, GROQ_API_KEYS, GROQ_MODELS } from '@/services/groqConfig';
import type { CategoryType } from '@/types/models';
import { log } from '@/utils/logger';

const MODELS = GROQ_MODELS;

let currentKeyIndex = 0;

export interface SuggestedCategory {
  code: string;
  name: string;
  type: CategoryType;
  icone?: string;
  raison?: string;
}

export interface AICreanceAction {
  action: 'nouveau_pret' | 'remboursement' | 'aucun';
  debiteur?: string;
  montant?: number;
  date_rappel?: string;
  motif?: string;
}

export interface AIPlannedExpense {
  libelle: string;
  montant: number;
  categorie: string;
  date_prevue: string;
  note?: string;
}

export interface AIAnalysisResult {
  transaction?: {
    categorie: string;
    beneficiaire?: string;
    libelle: string;
    montant: number;
    type: string;
    tag_non_planifie?: boolean;
    planifie?: boolean;
  };
  creance?: AICreanceAction;
  depense_planifiee?: AIPlannedExpense | null;
  nouvelle_categorie?: SuggestedCategory | null;
  message: string;
}

function buildCreancesContext(): string {
  const open = creancesRepo.getOpen();
  if (open.length === 0) return 'Aucun prêt en cours.';
  return open
    .map(
      (c) =>
        `- ${c.debiteur} : reste ${Math.round(c.montant_restant).toLocaleString('fr-FR')} FCFA / ${Math.round(c.montant_initial).toLocaleString('fr-FR')} (${c.statut})`
    )
    .join('\n');
}

function buildSystemPrompt(): string {
  const categories = categoriesRepo.getAll();
  const categoryList = categories.map((c) => `- ${c.code} : ${c.name} (${c.type})`).join('\n');

  return `
Tu es MoneyCalendar AI, assistant financier rigoureux et bienveillant.

IMPORTANT : réponds UNIQUEMENT avec un objet json valide (sans markdown).

Format json :
{
  "transaction": {
    "categorie": "CODE_CATEGORIE",
    "beneficiaire": "Nom ou prénom",
    "libelle": "Libellé clair",
    "montant": 17000,
    "type": "sortie",
    "tag_non_planifie": false,
    "planifie": true
  },
  "creance": {
    "action": "nouveau_pret|remboursement|aucun",
    "debiteur": "Prénom",
    "montant": 50000,
    "date_rappel": "2026-06-15",
    "motif": "optionnel"
  },
  "depense_planifiee": null,
  "nouvelle_categorie": null,
  "message": "2 à 4 phrases max, sans répéter les mêmes chiffres deux fois."
}

Règles transaction :
- Utilise un CODE existant si possible.
- montant entier en FCFA.
- type = "sortie" (dépense, prêt accordé) ou "entree" (salaire, revenu, remboursement reçu).
- Prêt accordé → PRET_ACCORDE, sortie, beneficiaire = emprunteur.
- Remboursement reçu → REMB_RECU, entree.
- Remboursement d'une dette que TU dois → DETTE_REMB, sortie.
- Revenu / salaire / argent reçu (hors remboursement) → REVENU, entree.
- tag_non_planifie = true si dépense imprévue > 10000 FCFA.
- planifie = true si l'utilisateur avait prévu cette dépense.

Règles creance (prêts & remboursements) :
- "Prêt à X", "j'ai prêté" → creance.action = "nouveau_pret", debiteur = X, montant = montant du prêt.
- "X me rembourse", "remboursement de X" → creance.action = "remboursement", debiteur = X.
- Si remboursement partiel, montant = montant remboursé (pas le reste).
- Sinon creance.action = "aucun".

Règles depense_planifiee (dépense future à rappeler) :
- Si l'utilisateur planifie une dépense avec une date future ("prévoir", "planifier", "le 15 juin") :
  depense_planifiee = { libelle, montant, categorie, date_prevue: "YYYY-MM-DD", note }
  et transaction peut être null ou une estimation.

Prêts en cours (pour savoir qui a fini sa dette) :
${buildCreancesContext()}

Message :
- Pas de répétition : n'écris pas deux fois le même montant ou la même alerte.
- Mentionne si la dette est soldée ou combien il reste après un remboursement.

Catégories existantes :
${categoryList || '- DIVERS : Divers (speciale)'}
`;
}

function groqErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.error?.message;
    if (typeof msg === 'string') return msg;
    return `HTTP ${error.response?.status ?? '?'} : ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeCreance(raw: unknown): AICreanceAction | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  const action = String(c.action ?? 'aucun');
  if (!['nouveau_pret', 'remboursement', 'aucun'].includes(action)) {
    return { action: 'aucun' };
  }
  return {
    action: action as AICreanceAction['action'],
    debiteur: c.debiteur ? String(c.debiteur) : undefined,
    montant: c.montant != null ? Number(c.montant) : undefined,
    date_rappel: c.date_rappel ? String(c.date_rappel) : undefined,
    motif: c.motif ? String(c.motif) : undefined,
  };
}

function normalizePlanned(raw: unknown): AIPlannedExpense | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (!p.libelle || !p.montant || !p.date_prevue) return null;
  return {
    libelle: String(p.libelle),
    montant: Number(p.montant),
    categorie: String(p.categorie ?? 'DIVERS').toUpperCase(),
    date_prevue: String(p.date_prevue).slice(0, 10),
    note: p.note ? String(p.note) : undefined,
  };
}

function normalizeResult(raw: Record<string, unknown>): AIAnalysisResult {
  const nouvelle = raw.nouvelle_categorie as SuggestedCategory | null | undefined;
  const transaction = raw.transaction as AIAnalysisResult['transaction'] | undefined;

  if (nouvelle?.code) {
    nouvelle.code = String(nouvelle.code).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 24);
  }
  if (transaction?.categorie) {
    transaction.categorie = String(transaction.categorie).toUpperCase();
  }

  return {
    transaction,
    creance: normalizeCreance(raw.creance),
    depense_planifiee: normalizePlanned(raw.depense_planifiee),
    nouvelle_categorie: nouvelle ?? null,
    message: String(raw.message ?? ''),
  };
}

async function callGroq(key: string, model: string, userInput: string): Promise<AIAnalysisResult> {
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: `${userInput}\n(Réponds en json.)` },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const content = response.data.choices[0].message.content;
  return normalizeResult(JSON.parse(content));
}

export const analyzeTransactionWithAI = async (userInput: string): Promise<AIAnalysisResult> => {
  assertGroqConfigured();
  log.info('AI', 'Analyse transaction', { input: userInput, models: MODELS });

  let lastError = 'Erreur inconnue';

  for (let attempt = 0; attempt < GROQ_API_KEYS.length; attempt++) {
    const key = GROQ_API_KEYS[currentKeyIndex];

    for (const model of MODELS) {
      log.info('AI', `Appel Groq — clé #${currentKeyIndex + 1}, modèle ${model}`);
      try {
        const parsed = await callGroq(key, model, userInput);
        log.info('AI', 'Réponse Groq OK', {
          model,
          categorie: parsed.transaction?.categorie,
          creance: parsed.creance?.action,
          planifiee: !!parsed.depense_planifiee,
        });
        return parsed;
      } catch (error) {
        lastError = groqErrorMessage(error);
        log.warn('AI', `Échec clé #${currentKeyIndex + 1} / ${model}`, lastError);
      }
    }

    currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
  }

  log.error('AI', 'Toutes les tentatives Groq ont échoué', lastError);
  throw new Error(`IA indisponible : ${lastError}`);
};
