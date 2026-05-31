export function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export function formatFCFA(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

export function getMonthsList(): { value: string; label: string; year: number; month: number }[] {
  const months = [];
  for (let i = -12; i <= 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    months.push({
      value: formatMonthKey(d),
      label: formatMonthLabel(d),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return months;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function formatPeriodLabel(start: Date, end: Date): string {
  if (formatMonthKey(start) === formatMonthKey(end)) {
    return formatMonthLabel(start);
  }
  return `${start.toLocaleDateString('fr-FR')} — ${end.toLocaleDateString('fr-FR')}`;
}

/** Ex: MoneyCalendar-05-2026.pdf ou MoneyCalendar-01-2026-05-2026.pdf */
export function buildReportFilename(start: Date, end: Date): string {
  const sm = String(start.getMonth() + 1).padStart(2, '0');
  const sy = start.getFullYear();
  const em = String(end.getMonth() + 1).padStart(2, '0');
  const ey = end.getFullYear();
  if (sm === em && sy === ey) return `MoneyCalendar-${sm}-${sy}.pdf`;
  return `MoneyCalendar-${sm}-${sy}-${em}-${ey}.pdf`;
}

export function getMonthsInRange(start: Date, end: Date): string[] {
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    months.push(formatMonthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}
