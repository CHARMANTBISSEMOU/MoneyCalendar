import { categoriesRepo, budgetsRepo, creancesRepo, transactionsRepo } from '@/services/data';
import type { CreanceSummary } from '@/types/models';
import type { Transaction } from '@/types/models';
import { formatMonthKey, getMonthsInRange } from '@/utils/format';

export interface CategoryMonthStat {
  month: string;
  total: number;
  count: number;
}

export interface CategoryReportRow {
  code: string;
  name: string;
  total: number;
  count: number;
  byMonth: CategoryMonthStat[];
  topLibelles: { libelle: string; total: number; count: number }[];
}

export interface BeneficiaryReportRow {
  name: string;
  total: number;
  count: number;
  byMonth: CategoryMonthStat[];
  transactions: { date: string; libelle: string; montant: number; categorie: string }[];
}

export interface PeriodReportData {
  startDate: string;
  endDate: string;
  transactions: Transaction[];
  totalDepenses: number;
  totalEntrees: number;
  transactionCount: number;
  months: string[];
  byCategory: CategoryReportRow[];
  byBeneficiary: BeneficiaryReportRow[];
  budgets: { month: string; budget: number | null; depense: number; entrees: number }[];
  frequentLibelles: { libelle: string; count: number; total: number }[];
  creances: CreanceSummary[];
}

function extractBeneficiary(tx: Transaction): string {
  if (tx.beneficiaire?.trim()) return tx.beneficiaire.trim();
  const lib = tx.libelle.trim();
  const forMatch = lib.match(/(?:pour|à|a)\s+([A-ZÀ-Ü][a-zà-üA-ZÀ-Ü\-]+)/i);
  if (forMatch) return forMatch[1];
  const startMatch = lib.match(/^([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)?)/);
  if (startMatch && startMatch[1].length > 2) return startMatch[1];
  return '';
}

export function buildPeriodReportData(start: Date, end: Date): PeriodReportData {
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];
  const transactions = transactionsRepo.getByPeriod(startDate, endDate, 'sortie');
  const entrees = transactionsRepo.getByPeriod(startDate, endDate, 'entree');
  const months = getMonthsInRange(start, end);

  const catMap = new Map<string, CategoryReportRow>();
  const benMap = new Map<string, BeneficiaryReportRow>();
  const libelleFreq = new Map<string, { count: number; total: number }>();

  for (const tx of transactions) {
    const month = tx.mois_budget;
    const catCode = tx.categorie;
    const catMeta = categoriesRepo.getByCode(catCode);

    if (!catMap.has(catCode)) {
      catMap.set(catCode, {
        code: catCode,
        name: catMeta?.name ?? catCode,
        total: 0,
        count: 0,
        byMonth: months.map((m) => ({ month: m, total: 0, count: 0 })),
        topLibelles: [],
      });
    }
    const catRow = catMap.get(catCode)!;
    catRow.total += tx.montant;
    catRow.count += 1;
    const catMonth = catRow.byMonth.find((b) => b.month === month);
    if (catMonth) {
      catMonth.total += tx.montant;
      catMonth.count += 1;
    }

    const libKey = tx.libelle.trim().toLowerCase();
    const lf = libelleFreq.get(libKey) ?? { count: 0, total: 0 };
    lf.count += 1;
    lf.total += tx.montant;
    libelleFreq.set(libKey, lf);

    const ben = extractBeneficiary(tx);
    if (ben && ben.length > 1) {
      if (!benMap.has(ben)) {
        benMap.set(ben, {
          name: ben,
          total: 0,
          count: 0,
          byMonth: months.map((m) => ({ month: m, total: 0, count: 0 })),
          transactions: [],
        });
      }
      const benRow = benMap.get(ben)!;
      benRow.total += tx.montant;
      benRow.count += 1;
      const benMonth = benRow.byMonth.find((b) => b.month === month);
      if (benMonth) {
        benMonth.total += tx.montant;
        benMonth.count += 1;
      }
      benRow.transactions.push({
        date: tx.date,
        libelle: tx.libelle,
        montant: tx.montant,
        categorie: catMeta?.name ?? catCode,
      });
    }
  }

  for (const row of catMap.values()) {
    const libByCat = new Map<string, { total: number; count: number }>();
    for (const tx of transactions.filter((t) => t.categorie === row.code)) {
      const k = tx.libelle;
      const e = libByCat.get(k) ?? { total: 0, count: 0 };
      e.total += tx.montant;
      e.count += 1;
      libByCat.set(k, e);
    }
    row.topLibelles = [...libByCat.entries()]
      .map(([libelle, v]) => ({ libelle, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }

  const budgets = months.map((m) => {
    const b = budgetsRepo.getByMonth(m);
    const depense = transactions.filter((t) => t.mois_budget === m).reduce((s, t) => s + t.montant, 0);
    const entreesMois = entrees.filter((t) => t.mois_budget === m).reduce((s, t) => s + t.montant, 0);
    return { month: m, budget: b?.montant ?? null, depense, entrees: entreesMois };
  });

  const frequentLibelles = [...libelleFreq.entries()]
    .map(([libelle, v]) => ({ libelle, ...v }))
    .filter((l) => l.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    startDate,
    endDate,
    transactions,
    totalDepenses: transactions.reduce((s, t) => s + t.montant, 0),
    totalEntrees: entrees.reduce((s, t) => s + t.montant, 0),
    transactionCount: transactions.length,
    months,
    byCategory: [...catMap.values()].sort((a, b) => b.total - a.total),
    byBeneficiary: [...benMap.values()].sort((a, b) => b.total - a.total),
    budgets,
    frequentLibelles,
    creances: creancesRepo.getSummaries(),
  };
}

export function summarizeDataForPrompt(data: PeriodReportData): string {
  return JSON.stringify(
    {
      periode: `${data.startDate} → ${data.endDate}`,
      total_depenses: data.totalDepenses,
      total_entrees: data.totalEntrees,
      nb_transactions: data.transactionCount,
      creances: data.creances,
      categories: data.byCategory.map((c) => ({
        code: c.code,
        name: c.name,
        total: c.total,
        par_mois: c.byMonth.filter((m) => m.total > 0),
        libelles_frequents: c.topLibelles.slice(0, 5),
      })),
      beneficiaires: data.byBeneficiary.slice(0, 12).map((b) => ({
        nom: b.name,
        total: b.total,
        par_mois: b.byMonth.filter((m) => m.total > 0),
        operations: b.transactions.slice(0, 10),
      })),
      libelles_recurrents: data.frequentLibelles.slice(0, 15),
      budgets: data.budgets,
    },
    null,
    0
  );
}
