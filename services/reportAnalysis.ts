import axios from 'axios';
import { log } from '@/utils/logger';
import type { CategoryReportRow, PeriodReportData } from '@/services/reportData';
import { summarizeDataForPrompt } from '@/services/reportData';
import { assertGroqConfigured, GROQ_API_KEYS, GROQ_MODELS } from '@/services/groqConfig';
import { trimReportRepetition } from '@/utils/analysisDedupe';

const MODELS = GROQ_MODELS;
let currentKeyIndex = 0;

export interface ReportAnalysisSections {
  categoriesAnalysis: string;
  tiersAnalysis: string;
  creancesAnalysis: string;
  libellesAnalysis: string;
  synthesis: string;
}

export type ReportProgressCallback = (step: number, total: number, label: string) => void;

const CRITIQUE_STYLE = `
Style "analyse froide" (comme un audit financier personnel) :
- Ton direct, factuel, sans complaisance mais bienveillant.
- Pour chaque poste : totaux, évolution mensuelle si disponible, libellés récurrents interprétés.
- Section "Critique :" avec jugement argumenté (habitudes, risques, dépassements, trésorerie).
- Repérer : dépenses tiers, achats pour autrui, prêts/remboursements, poste Divers fourre-tout, fréquence des transactions.
- Montants en FCFA avec séparateurs de milliers.
- Paragraphes structurés, titres en gras avec **texte**.
- NE RÉPÈTE PAS une information déjà donnée dans une autre section (une seule fois par fait).
`;

async function callGroqText(system: string, user: string): Promise<string> {
  assertGroqConfigured();
  let lastError = 'Erreur Groq';

  for (let attempt = 0; attempt < GROQ_API_KEYS.length; attempt++) {
    const key = GROQ_API_KEYS[currentKeyIndex];
    for (const model of MODELS) {
      try {
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature: 0.2,
            max_tokens: 2048,
          },
          {
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            timeout: 60000,
          }
        );
        return String(response.data.choices[0].message.content ?? '');
      } catch (error) {
        if (axios.isAxiosError(error)) {
          lastError = error.response?.data?.error?.message ?? error.message;
        }
        log.warn('ReportAI', `Échec ${model}`, lastError);
      }
    }
    currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
  }
  throw new Error(`Analyse IA : ${lastError}`);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatCategoryChunk(cats: CategoryReportRow[]): string {
  return JSON.stringify(
    cats.map((c) => ({
      categorie: c.name,
      code: c.code,
      total: c.total,
      nb: c.count,
      par_mois: c.byMonth.filter((m) => m.total > 0),
      libelles: c.topLibelles,
    })),
    null,
    0
  );
}

/** Analyse en 4 étapes pour ne pas saturer l'IA */
export async function generateReportAnalysis(
  data: PeriodReportData,
  onProgress?: ReportProgressCallback
): Promise<ReportAnalysisSections> {
  const totalSteps = 5;
  const contextBase = summarizeDataForPrompt(data);
  let accumulated = '';

  // Étape 1 — Catégories (par lots de 4)
  onProgress?.(1, totalSteps, 'Analyse par catégorie…');
  const catChunks = chunk(data.byCategory, 4);
  const catParts: string[] = [];
  for (let i = 0; i < catChunks.length; i++) {
    const part = await callGroqText(
      `Tu es un auditeur financier MoneyCalendar. ${CRITIQUE_STYLE}
Analyse UNIQUEMENT les catégories fournies. Structure :
## [Nom catégorie]
- Totaux et tendance mensuelle
- Interprétation des libellés
**Critique :** ...
Ne analyse pas les tiers ici (étape séparée).`,
      `Contexte période :\n${contextBase}\n\nCatégories lot ${i + 1}/${catChunks.length} :\n${formatCategoryChunk(catChunks[i])}`
    );
    catParts.push(part);
  }
  let categoriesAnalysis =
    catParts.join('\n\n---\n\n') || 'Aucune dépense par catégorie sur cette période.';
  categoriesAnalysis = trimReportRepetition(categoriesAnalysis, accumulated);
  accumulated += categoriesAnalysis;

  // Étape 2 — Tiers / bénéficiaires
  onProgress?.(2, totalSteps, 'Analyse des tiers et bénéficiaires…');
  let tiersAnalysis = '';
  if (data.byBeneficiary.length > 0) {
    tiersAnalysis = await callGroqText(
      `Tu es un auditeur financier MoneyCalendar. ${CRITIQUE_STYLE}
Analyse les dépenses liées aux TIERS et personnes (bénéficiaires).
Pour CHAQUE personne significative :
## [Prénom/Nom]
- Total cumulé, détail mensuel, nature des dépenses (connexion, vêtements, aide, prêt…)
**Critique :** régularité, risque de prise en charge croissante, trésorerie immobilisée, remboursements.
Termine par "Ce qui apparaît trop souvent dans les aides tiers".`,
      `Données tiers :\n${JSON.stringify(
        data.byBeneficiary.slice(0, 15).map((b) => ({
          nom: b.name,
          total: b.total,
          par_mois: b.byMonth.filter((m) => m.total > 0),
          operations: b.transactions,
        })),
        null,
        0
      )}`
    );
  } else {
    tiersAnalysis = 'Aucun bénéficiaire tiers identifié dans les libellés sur cette période.';
  }
  tiersAnalysis = trimReportRepetition(tiersAnalysis, accumulated);
  accumulated += tiersAnalysis;

  // Étape 3 — Prêts, dettes, remboursements
  onProgress?.(3, totalSteps, 'Prêts et remboursements…');
  let creancesAnalysis = '';
  if (data.creances.length > 0) {
    creancesAnalysis = await callGroqText(
      `Tu es un auditeur financier MoneyCalendar. ${CRITIQUE_STYLE}
Analyse UNIQUEMENT les prêts / créances / remboursements.
Pour CHAQUE personne :
## [Nom]
- Montant initial, remboursé, reste dû, statut (soldée ou en cours)
**Critique :** qui a terminé sa dette, qui traîne, impact trésorerie.
Ne répète pas l'analyse des catégories ou des tiers déjà faite ailleurs.`,
      `Créances :\n${JSON.stringify(data.creances, null, 0)}\n\nEntrées période : ${data.totalEntrees} FCFA`
    );
  } else {
    creancesAnalysis = 'Aucun prêt ou créance enregistré dans l\'application sur cette période.';
  }
  creancesAnalysis = trimReportRepetition(creancesAnalysis, accumulated);
  accumulated += creancesAnalysis;

  // Étape 4 — Libellés & comportement
  onProgress?.(4, totalSteps, 'Analyse des libellés et comportements…');
  let libellesAnalysis = await callGroqText(
    `Tu es un auditeur financier MoneyCalendar. ${CRITIQUE_STYLE}
Analyse :
1. Libellés récurrents et ce qu'ils révèlent (connexions offertes, cadeaux, achats masqués dans Divers…)
2. Fréquence des transactions (${data.transactionCount} ops) — micro-dépenses, journées à fort impact
3. "Analyse froide du comportement financier" : réaction vs intention, générosité vs budget, poste poubelle Divers
Utilise les budgets par mois si fournis.`,
    `Contexte :\n${contextBase}\n\nLibellés récurrents :\n${JSON.stringify(data.frequentLibelles, null, 0)}`
  );
  libellesAnalysis = trimReportRepetition(libellesAnalysis, accumulated);
  accumulated += libellesAnalysis;

  // Étape 5 — Synthèse & recommandations
  onProgress?.(5, totalSteps, 'Synthèse et recommandations…');
  let synthesis = await callGroqText(
    `Tu es un auditeur financier MoneyCalendar. ${CRITIQUE_STYLE}
Rédige une SYNTHÈSE GLOBALE incluant :
## Synthèse globale
- Totaux dépenses ET entrées d'argent, écart vs budgets, mois les plus lourds
- État des dettes : qui a soldé, qui doit encore
## Les habitudes destructrices identifiées (3 à 5)
## Recommandations avec impact financier long terme
Chaque recommandation : action concrète + économie estimée par mois/an en FCFA.
INTERDIT de recopier des paragraphes des sections précédentes : uniquement nouveaux angles et priorités.
Ton direct, orienté action.`,
    `Résumé chiffré :\n${contextBase}\n\nExtraits (ne pas répéter) :\n--- CRÉANCES ---\n${creancesAnalysis.slice(0, 1500)}`
  );
  synthesis = trimReportRepetition(synthesis, accumulated);

  log.info('ReportAI', 'Analyse rapport terminée (5 étapes)');
  return { categoriesAnalysis, tiersAnalysis, creancesAnalysis, libellesAnalysis, synthesis };
}

/** Analyse locale rapide si l'IA échoue */
export function generateLocalFallbackAnalysis(data: PeriodReportData): ReportAnalysisSections {
  const top = data.byCategory.slice(0, 5).map((c) => `${c.name} : ${Math.round(c.total).toLocaleString('fr-FR')} FCFA (${c.count} ops)`).join('\n');
  const creancesLine = data.creances.length
    ? data.creances
        .map(
          (c) =>
            `${c.debiteur} : ${c.statut === 'soldee' ? 'dette soldée' : `reste ${Math.round(c.montant_restant).toLocaleString('fr-FR')} FCFA`}`
        )
        .join('\n')
    : 'Aucune créance.';

  return {
    categoriesAnalysis: `Top catégories :\n${top}`,
    tiersAnalysis: data.byBeneficiary.length
      ? data.byBeneficiary.slice(0, 5).map((b) => `${b.name} : ${Math.round(b.total).toLocaleString('fr-FR')} FCFA`).join('\n')
      : 'Aucun tiers identifié.',
    creancesAnalysis: creancesLine,
    libellesAnalysis: `${data.transactionCount} transactions sur la période.`,
    synthesis: `Dépenses : ${Math.round(data.totalDepenses).toLocaleString('fr-FR')} FCFA · Entrées : ${Math.round(data.totalEntrees).toLocaleString('fr-FR')} FCFA. Analyse IA indisponible.`,
  };
}
