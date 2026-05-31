import { db } from '@/services/db';
import type {
  Budget,
  Category,
  CategoryStat,
  Creance,
  CreanceStatut,
  CreanceSummary,
  MonthStats,
  PlannedExpense,
  PlannedExpenseStatus,
  Transaction,
} from '@/types/models';
import { formatMonthKey, generateId } from '@/utils/format';

const LOAN_CATEGORIES = new Set(['PRET_ACCORDE', 'PRET_AMI']);
const REPAYMENT_IN_CATEGORIES = new Set(['REMB_RECU', 'CONTRIBUTION']);
const REPAYMENT_OUT_CATEGORIES = new Set(['DETTE_REMB']);

export const categoriesRepo = {
  getAll(): Category[] {
    try {
      return db.getAllSync<Category>('SELECT * FROM categories ORDER BY name ASC');
    } catch {
      return db.getAllSync<Category>('SELECT * FROM categories');
    }
  },

  getByCode(code: string): Category | null {
    return db.getFirstSync<Category>('SELECT * FROM categories WHERE code = ?', code);
  },

  create(code: string, name: string, type: Category['type'] = 'personnelle', icone = '📦') {
    db.runSync(
      `INSERT INTO categories (code, name, description, type, icone) VALUES (?, ?, '', ?, ?)`,
      code.toUpperCase(),
      name,
      type,
      icone
    );
  },

  delete(code: string) {
    db.runSync('DELETE FROM categories WHERE code = ?', code);
  },
};

export const budgetsRepo = {
  getByMonth(mois: string): Budget | null {
    return db.getFirstSync<Budget>('SELECT mois, montant FROM budgets WHERE mois = ?', mois);
  },

  set(mois: string, montant: number) {
    const existing = this.getByMonth(mois);
    if (existing) {
      db.runSync('UPDATE budgets SET montant = ? WHERE mois = ?', montant, mois);
    } else {
      db.runSync('INSERT INTO budgets (mois, montant) VALUES (?, ?)', mois, montant);
    }
  },
};

export const transactionsRepo = {
  getAll(mois?: string): Transaction[] {
    if (mois) {
      return db.getAllSync<Transaction>(
        `SELECT * FROM transactions WHERE mois_budget = ? ORDER BY date DESC, id DESC`,
        mois
      );
    }
    return db.getAllSync<Transaction>('SELECT * FROM transactions ORDER BY date DESC, id DESC');
  },

  getSortiesByMonth(mois: string): Transaction[] {
    return db.getAllSync<Transaction>(
      `SELECT * FROM transactions WHERE mois_budget = ? AND type = 'sortie' ORDER BY date DESC`,
      mois
    );
  },

  getEntreesByMonth(mois: string): Transaction[] {
    return db.getAllSync<Transaction>(
      `SELECT * FROM transactions WHERE mois_budget = ? AND type = 'entree' ORDER BY date DESC`,
      mois
    );
  },

  getMonthIncomeTotal(mois: string): number {
    const row = db.getFirstSync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM transactions WHERE mois_budget = ? AND type = 'entree'`,
      mois
    );
    return row?.total ?? 0;
  },

  getBehaviorStats(mois: string): { totalSorties: number; nonPlanifie: number; planifie: number } {
    const rows = db.getAllSync<{ planifie: number; tag_non_planifie: number; montant: number }>(
      `SELECT planifie, tag_non_planifie, montant FROM transactions WHERE mois_budget = ? AND type = 'sortie'`,
      mois
    );
    let nonPlanifie = 0;
    let planifie = 0;
    let totalSorties = 0;
    for (const r of rows) {
      totalSorties += r.montant;
      if (r.tag_non_planifie) nonPlanifie += r.montant;
      else if (r.planifie) planifie += r.montant;
    }
    return { totalSorties, nonPlanifie, planifie };
  },

  getByPeriod(startDate: string, endDate: string, type?: string): Transaction[] {
    if (type) {
      return db.getAllSync<Transaction>(
        `SELECT * FROM transactions WHERE date >= ? AND date <= ? AND type = ? ORDER BY date ASC`,
        startDate,
        endDate,
        type
      );
    }
    return db.getAllSync<Transaction>(
      `SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY date ASC`,
      startDate,
      endDate
    );
  },

  create(input: {
    montant: number;
    libelle: string;
    categorie: string;
    date: string;
    type?: string;
    beneficiaire?: string;
    tag_non_planifie?: boolean;
    planifie?: boolean;
    creance_id?: string | null;
  }): string {
    const id = generateId();
    const mois = input.date.slice(0, 7);
    db.runSync(
      `INSERT INTO transactions (id, date, categorie, beneficiaire, libelle, montant, type, planifie, tag_non_planifie, creance_id, mois_budget)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.date,
      input.categorie,
      input.beneficiaire ?? '',
      input.libelle,
      input.montant,
      input.type ?? 'sortie',
      input.planifie === false ? 0 : 1,
      input.tag_non_planifie ? 1 : 0,
      input.creance_id ?? null,
      mois
    );
    return id;
  },

  update(
    id: string,
    input: {
      montant: number;
      libelle: string;
      categorie: string;
      date: string;
      type?: string;
    }
  ) {
    const mois = input.date.slice(0, 7);
    db.runSync(
      `UPDATE transactions SET montant = ?, libelle = ?, categorie = ?, date = ?, type = ?, mois_budget = ? WHERE id = ?`,
      input.montant,
      input.libelle,
      input.categorie,
      input.date,
      input.type ?? 'sortie',
      mois,
      id
    );
  },

  delete(id: string) {
    db.runSync('DELETE FROM transactions WHERE id = ?', id);
  },

  getStatistics(mois: string): MonthStats {
    const totalRow = db.getFirstSync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM transactions WHERE mois_budget = ? AND type = 'sortie'`,
      mois
    );

    let parCategorie: { categorie: string; nom: string; total: number; count: number }[] = [];
    try {
      parCategorie = db.getAllSync(
        `SELECT t.categorie, COALESCE(c.name, t.categorie) as nom, SUM(t.montant) as total, COUNT(*) as count
         FROM transactions t
         LEFT JOIN categories c ON t.categorie = c.code
         WHERE t.mois_budget = ? AND t.type = 'sortie'
         GROUP BY t.categorie
         ORDER BY total DESC`,
        mois
      );
    } catch {
      parCategorie = db.getAllSync(
        `SELECT categorie, categorie as nom, SUM(montant) as total, COUNT(*) as count
         FROM transactions
         WHERE mois_budget = ? AND type = 'sortie'
         GROUP BY categorie
         ORDER BY total DESC`,
        mois
      );
    }

    return {
      total: totalRow?.total ?? 0,
      parCategorie: parCategorie.map((r) => ({
        code: r.categorie,
        nom: r.nom,
        total: r.total,
        count: r.count,
      })),
    };
  },
};

export function getBudgetWithStats(mois: string) {
  const budget = budgetsRepo.getByMonth(mois);
  const stats = transactionsRepo.getStatistics(mois);
  const totalEntrees = transactionsRepo.getMonthIncomeTotal(mois);
  if (!budget) return null;
  const restant = Math.max(budget.montant - stats.total, 0);
  const pourcentageUtilise = budget.montant > 0 ? (stats.total / budget.montant) * 100 : 0;
  return {
    ...budget,
    totalDepense: stats.total,
    totalEntrees,
    restant,
    pourcentageUtilise,
  };
}

function normalizeDebiteur(name: string): string {
  return name.trim().toLowerCase();
}

function computeCreanceStatut(restant: number, initial: number): CreanceStatut {
  if (restant <= 0) return 'soldee';
  if (restant < initial) return 'partielle';
  return 'ouverte';
}

export const creancesRepo = {
  getAll(): Creance[] {
    return db.getAllSync<Creance>(
      `SELECT * FROM creances ORDER BY CASE statut WHEN 'soldee' THEN 1 ELSE 0 END, date_creation DESC`
    );
  },

  getOpen(): Creance[] {
    return db.getAllSync<Creance>(
      `SELECT * FROM creances WHERE statut != 'soldee' ORDER BY montant_restant DESC`
    );
  },

  getById(id: string): Creance | null {
    return db.getFirstSync<Creance>('SELECT * FROM creances WHERE id = ?', id);
  },

  findOpenByDebiteur(debiteur: string): Creance | null {
    const key = normalizeDebiteur(debiteur);
    const all = this.getOpen();
    return all.find((c) => normalizeDebiteur(c.debiteur) === key) ?? null;
  },

  create(input: {
    debiteur: string;
    montant: number;
    date_rappel?: string;
    motif?: string;
  }): string {
    const id = generateId();
    const today = new Date().toISOString().split('T')[0];
    db.runSync(
      `INSERT INTO creances (id, debiteur, montant_initial, montant_restant, date_creation, date_rappel, statut, motif)
       VALUES (?, ?, ?, ?, ?, ?, 'ouverte', ?)`,
      id,
      input.debiteur.trim(),
      input.montant,
      input.montant,
      today,
      input.date_rappel ?? null,
      input.motif ?? null
    );
    return id;
  },

  applyRepayment(creanceId: string, montant: number): Creance | null {
    const c = this.getById(creanceId);
    if (!c) return null;
    const restant = Math.max(c.montant_restant - montant, 0);
    const statut = computeCreanceStatut(restant, c.montant_initial);
    db.runSync('UPDATE creances SET montant_restant = ?, statut = ? WHERE id = ?', restant, statut, creanceId);
    return this.getById(creanceId);
  },

  applyRepaymentByDebiteur(debiteur: string, montant: number): Creance | null {
    const c = this.findOpenByDebiteur(debiteur);
    if (!c) return null;
    return this.applyRepayment(c.id, montant);
  },

  getSummaries(): CreanceSummary[] {
    return this.getAll().map((c) => ({
      debiteur: c.debiteur,
      montant_initial: c.montant_initial,
      montant_restant: c.montant_restant,
      statut: c.statut,
      rembourse: c.montant_initial - c.montant_restant,
    }));
  },

  isLoanCategory(code: string): boolean {
    return LOAN_CATEGORIES.has(code);
  },

  isRepaymentCategory(code: string, type: string): boolean {
    if (type === 'entree') return REPAYMENT_IN_CATEGORIES.has(code);
    return REPAYMENT_OUT_CATEGORIES.has(code);
  },
};

export const plannedExpensesRepo = {
  getAll(): PlannedExpense[] {
    return db.getAllSync<PlannedExpense>(
      `SELECT * FROM depenses_planifiees ORDER BY date_prevue ASC`
    );
  },

  getPending(): PlannedExpense[] {
    return db.getAllSync<PlannedExpense>(
      `SELECT * FROM depenses_planifiees WHERE statut = 'en_attente' ORDER BY date_prevue ASC`
    );
  },

  getDueOnOrBefore(dateIso: string): PlannedExpense[] {
    return db.getAllSync<PlannedExpense>(
      `SELECT * FROM depenses_planifiees WHERE statut = 'en_attente' AND date_prevue <= ? ORDER BY date_prevue ASC`,
      dateIso
    );
  },

  getUpcoming(days = 7): PlannedExpense[] {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + days);
    const startStr = today.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return db.getAllSync<PlannedExpense>(
      `SELECT * FROM depenses_planifiees WHERE statut = 'en_attente' AND date_prevue >= ? AND date_prevue <= ? ORDER BY date_prevue ASC`,
      startStr,
      endStr
    );
  },

  create(input: {
    libelle: string;
    montant: number;
    categorie: string;
    date_prevue: string;
    note?: string;
  }): string {
    const id = generateId();
    db.runSync(
      `INSERT INTO depenses_planifiees (id, libelle, montant, categorie, date_prevue, rappel_actif, rappel_envoye, statut, note)
       VALUES (?, ?, ?, ?, ?, 1, 0, 'en_attente', ?)`,
      id,
      input.libelle,
      input.montant,
      input.categorie,
      input.date_prevue,
      input.note ?? null
    );
    return id;
  },

  markReminderSent(id: string) {
    db.runSync('UPDATE depenses_planifiees SET rappel_envoye = 1 WHERE id = ?', id);
  },

  markRealized(id: string) {
    db.runSync(`UPDATE depenses_planifiees SET statut = 'realisee' WHERE id = ?`, id);
  },
};

export function getCurrentMonthKey(): string {
  return formatMonthKey(new Date());
}
