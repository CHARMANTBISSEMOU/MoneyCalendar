import { Alert } from 'react-native';
import { creancesRepo, plannedExpensesRepo } from '@/services/data';
import { formatFCFA } from '@/utils/format';

let lastReminderCheck = '';

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/** Rappels in-app : dépenses planifiées à échéance et créances en retard */
export function checkFinancialReminders() {
  const today = todayKey();
  if (lastReminderCheck === today) return;
  lastReminderCheck = today;

  const lines: string[] = [];

  const duePlanned = plannedExpensesRepo.getDueOnOrBefore(today).filter((p) => !p.rappel_envoye);
  for (const p of duePlanned.slice(0, 5)) {
    lines.push(`📅 ${p.libelle} — ${formatFCFA(p.montant)} (prévu le ${p.date_prevue})`);
    plannedExpensesRepo.markReminderSent(p.id);
  }

  const upcoming = plannedExpensesRepo.getUpcoming(3).filter((p) => p.date_prevue > today);
  for (const p of upcoming.slice(0, 3)) {
    lines.push(`⏳ Bientôt : ${p.libelle} — ${formatFCFA(p.montant)} le ${p.date_prevue}`);
  }

  const overdueLoans = creancesRepo.getOpen().filter((c) => c.date_rappel && c.date_rappel < today);
  for (const c of overdueLoans.slice(0, 5)) {
    lines.push(
      `💸 ${c.debiteur} doit encore ${formatFCFA(c.montant_restant)} (échéance ${c.date_rappel})`
    );
  }

  if (lines.length === 0) return;

  Alert.alert('Rappels MoneyCalendar', lines.join('\n\n'), [{ text: 'OK' }]);
}
