export type CategoryType = 'personnelle' | 'tiers' | 'speciale';

export interface Category {
  code: string;
  name: string;
  description: string | null;
  type: CategoryType;
  icone: string | null;
}

export interface Transaction {
  id: string;
  date: string;
  categorie: string;
  sous_categorie: string | null;
  beneficiaire: string | null;
  libelle: string;
  montant: number;
  type: 'sortie' | 'entree' | string;
  planifie: number;
  tag_non_planifie: number;
  creance_id: string | null;
  mois_budget: string;
  note: string | null;
}

export interface Budget {
  mois: string;
  montant: number;
}

export interface CategoryStat {
  code: string;
  nom: string;
  total: number;
  count: number;
}

export interface MonthStats {
  total: number;
  parCategorie: CategoryStat[];
}

export interface AIAnalysisCard {
  type: 'danger' | 'warning' | 'success' | 'info';
  icon: string;
  text: string;
}

export type CreanceStatut = 'ouverte' | 'partielle' | 'soldee';

export interface Creance {
  id: string;
  debiteur: string;
  montant_initial: number;
  montant_restant: number;
  date_creation: string;
  date_rappel: string | null;
  statut: CreanceStatut;
  motif: string | null;
}

export type PlannedExpenseStatus = 'en_attente' | 'realisee' | 'annulee';

export interface PlannedExpense {
  id: string;
  libelle: string;
  montant: number;
  categorie: string;
  date_prevue: string;
  rappel_actif: number;
  rappel_envoye: number;
  statut: PlannedExpenseStatus;
  note: string | null;
}

export interface CreanceSummary {
  debiteur: string;
  montant_initial: number;
  montant_restant: number;
  statut: CreanceStatut;
  rembourse: number;
}
