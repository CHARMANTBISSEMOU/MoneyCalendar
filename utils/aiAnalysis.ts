import type { AIAnalysisCard, CategoryStat, CreanceSummary } from '@/types/models';
import { dedupeAnalysisCards } from '@/utils/analysisDedupe';
import { formatFCFA } from '@/utils/format';

interface AnalysisInput {
  budget: {
    montant: number;
    totalDepense?: number;
    totalEntrees?: number;
    restant?: number;
  } | null;
  stats: { totalMois: number; topCategories: CategoryStat[] } | null;
  depensesMois: { categorie: string; montant: number }[];
  depensesPrecedentes: { categorie: string; montant: number }[];
  selectedMonth: Date;
  creances?: CreanceSummary[];
  behavior?: { totalSorties: number; nonPlanifie: number; planifie: number };
  plannedDueSoon?: { libelle: string; montant: number; date_prevue: string }[];
}

export function generateAIAnalysis(input: AnalysisInput): AIAnalysisCard[] {
  const {
    budget,
    stats,
    depensesPrecedentes,
    selectedMonth,
    creances = [],
    behavior,
    plannedDueSoon = [],
  } = input;

  const analyses: AIAnalysisCard[] = [];

  if (!budget?.montant) {
    return [
      {
        type: 'info',
        icon: '📊',
        text: 'Définissez un budget mensuel pour recevoir des analyses personnalisées de vos dépenses.',
      },
    ];
  }

  const budgetMontant = budget.montant;
  const totalDepense = budget.totalDepense ?? stats?.totalMois ?? 0;
  const totalEntrees = budget.totalEntrees ?? 0;
  const restant = budget.restant ?? Math.max(budgetMontant - totalDepense, 0);
  const pourcentage = (totalDepense / budgetMontant) * 100;

  const now = new Date();
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

  const joursTotal = new Date(year, month + 1, 0).getDate();
  const jourActuel = isCurrentMonth ? now.getDate() : joursTotal;
  const joursRestants = isCurrentMonth ? joursTotal - jourActuel : 0;
  const pourcentageTemps = (jourActuel / joursTotal) * 100;
  const milieuMois = Math.ceil(joursTotal / 2);

  if (totalEntrees > 0) {
    analyses.push({
      type: 'info',
      icon: '💵',
      text: `Entrées du mois : ${formatFCFA(totalEntrees)} (budget dépenses : ${formatFCFA(budgetMontant)}).`,
    });
  }

  if (isCurrentMonth) {
    if (jourActuel <= milieuMois && pourcentage > 50) {
      analyses.push({
        type: 'danger',
        icon: '🚨',
        text: `Alerte : ${jourActuel}/${joursTotal} du mois, ${Math.round(pourcentage)}% du budget déjà utilisé.`,
      });
    } else if (pourcentage > pourcentageTemps * 1.3) {
      analyses.push({
        type: 'warning',
        icon: '⚠️',
        text: `Rythme élevé : ${Math.round(pourcentageTemps)}% du mois, ${Math.round(pourcentage)}% du budget.`,
      });
    } else if (pourcentage <= pourcentageTemps * 0.8 && totalDepense > 0) {
      analyses.push({
        type: 'success',
        icon: '✅',
        text: `Bon contrôle : ${Math.round(pourcentage)}% du budget pour ${Math.round(pourcentageTemps)}% du mois.`,
      });
    }

    if (joursRestants > 0 && pourcentage < 95) {
      const budgetJournalier = restant / joursRestants;
      analyses.push({
        type: budgetJournalier < 1000 ? 'danger' : 'info',
        icon: budgetJournalier < 1000 ? '💸' : '📅',
        text: `Budget journalier restant : ${Math.round(budgetJournalier).toLocaleString('fr-FR')} FCFA/jour (${joursRestants} j.).`,
      });
    }
  }

  const topCategories = stats?.topCategories ?? [];
  if (topCategories.length > 0 && totalDepense > 0 && topCategories[0].total > totalDepense * 0.4) {
    analyses.push({
      type: 'warning',
      icon: '📊',
      text: `"${topCategories[0].nom}" = ${Math.round((topCategories[0].total / totalDepense) * 100)}% des sorties.`,
    });
  }

  if (behavior && behavior.totalSorties > 0) {
    const pctNp = Math.round((behavior.nonPlanifie / behavior.totalSorties) * 100);
    if (pctNp >= 25) {
      analyses.push({
        type: pctNp >= 45 ? 'danger' : 'warning',
        icon: '🎯',
        text: `Comportement : ${pctNp}% des dépenses marquées non planifiées ce mois.`,
      });
    }
  }

  const openLoans = creances.filter((c) => c.statut !== 'soldee');
  if (openLoans.length > 0) {
    const totalRestant = openLoans.reduce((s, c) => s + c.montant_restant, 0);
    const soldes = creances.filter((c) => c.statut === 'soldee').map((c) => c.debiteur);
    let text = `${openLoans.length} prêt(s) en cours : ${formatFCFA(totalRestant)} à récupérer`;
    if (soldes.length > 0) {
      text += `. Dettes soldées : ${soldes.slice(0, 3).join(', ')}${soldes.length > 3 ? '…' : ''}`;
    }
    analyses.push({ type: openLoans.some((c) => c.montant_restant > 50000) ? 'warning' : 'info', icon: '🤝', text });
  }

  if (plannedDueSoon.length > 0 && isCurrentMonth) {
    const next = plannedDueSoon[0];
    analyses.push({
      type: 'info',
      icon: '📌',
      text: `Dépense planifiée : « ${next.libelle} » (${formatFCFA(next.montant)}) le ${next.date_prevue}.`,
    });
  }

  if (depensesPrecedentes.length > 0 && isCurrentMonth) {
    const totalPrecedent = depensesPrecedentes.reduce((s, d) => s + d.montant, 0);
    if (totalDepense > 0 && totalPrecedent > 0) {
      const diff = ((totalDepense - totalPrecedent) / totalPrecedent) * 100;
      if (diff > 20) {
        analyses.push({
          type: 'warning',
          icon: '📈',
          text: `+${Math.round(diff)}% de dépenses vs le mois précédent.`,
        });
      } else if (diff < -10) {
        analyses.push({
          type: 'success',
          icon: '📉',
          text: `-${Math.round(Math.abs(diff))}% vs le mois précédent.`,
        });
      }
    }
  }

  if (analyses.length === 0) {
    analyses.push({
      type: 'info',
      icon: '📊',
      text: `${formatFCFA(totalDepense)} dépensés sur ${formatFCFA(budgetMontant)} de budget.`,
    });
  }

  return dedupeAnalysisCards(analyses);
}
