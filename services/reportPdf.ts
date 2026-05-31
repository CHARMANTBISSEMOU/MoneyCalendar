import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { copyAsync, cacheDirectory } from 'expo-file-system/legacy';
import { APP_NAME, COMPANY_NAME } from '@/constants/brand';
import type { PeriodReportData } from '@/services/reportData';
import type { ReportAnalysisSections } from '@/services/reportAnalysis';
import { categoriesRepo } from '@/services/data';
import { buildReportFilename, formatFCFA, formatPeriodLabel } from '@/utils/format';

export type ReportExportMode = 'expenses' | 'analysis' | 'both';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(md: string): string {
  return escapeHtml(md)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\n/g, '<br/>');
}

function buildExpensesSection(data: PeriodReportData): string {
  const rows = data.transactions
    .map((t) => {
      const cat = categoriesRepo.getByCode(t.categorie);
      return `<tr>
        <td>${escapeHtml(t.date)}</td>
        <td>${escapeHtml(t.libelle)}</td>
        <td>${escapeHtml(cat?.name ?? t.categorie)}</td>
        <td>${escapeHtml(t.beneficiaire ?? '')}</td>
        <td style="text-align:right">${Math.round(t.montant).toLocaleString('fr-FR')} F</td>
      </tr>`;
    })
    .join('');

  const budgetRows = data.budgets
    .map(
      (b) =>
        `<tr><td>${b.month}</td><td>${b.budget != null ? formatFCFA(b.budget) : '—'}</td><td style="text-align:right">${formatFCFA(b.entrees)}</td><td style="text-align:right">${formatFCFA(b.depense)}</td></tr>`
    )
    .join('');

  const creanceRows = data.creances
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.debiteur)}</td><td>${formatFCFA(c.montant_initial)}</td><td>${formatFCFA(c.montant_restant)}</td><td>${c.statut === 'soldee' ? 'Soldée' : c.statut === 'partielle' ? 'Partielle' : 'En cours'}</td></tr>`
    )
    .join('');

  return `
    <h2>Dépenses de la période</h2>
    <p><strong>Sorties :</strong> ${formatFCFA(data.totalDepenses)} · <strong>Entrées :</strong> ${formatFCFA(data.totalEntrees)} · ${data.transactionCount} opérations</p>
    <h3>Budget, entrées et dépenses par mois</h3>
    <table><tr><th>Mois</th><th>Budget</th><th>Entrées</th><th>Dépensé</th></tr>${budgetRows}</table>
    <h3>Prêts & remboursements</h3>
    <table><tr><th>Personne</th><th>Initial</th><th>Reste dû</th><th>Statut</th></tr>${creanceRows || '<tr><td colspan="4">Aucune créance</td></tr>'}</table>
    <h3>Liste des transactions</h3>
    <table>
      <tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Bénéficiaire</th><th>Montant</th></tr>
      ${rows || '<tr><td colspan="5">Aucune transaction</td></tr>'}
    </table>`;
}

function buildAnalysisSection(analysis: ReportAnalysisSections): string {
  return `
    <h2>Analyse critique MoneyCalendar AI</h2>
    <p><em>Style audit personnel — catégories, libellés, tiers, comportement.</em></p>
    <h3>Par catégorie</h3>
    <div class="analysis">${markdownToHtml(analysis.categoriesAnalysis)}</div>
    <h3>Tiers & bénéficiaires</h3>
    <div class="analysis">${markdownToHtml(analysis.tiersAnalysis)}</div>
    <h3>Prêts, dettes & remboursements</h3>
    <div class="analysis">${markdownToHtml(analysis.creancesAnalysis)}</div>
    <h3>Libellés & comportement</h3>
    <div class="analysis">${markdownToHtml(analysis.libellesAnalysis)}</div>
    <h3>Synthèse & recommandations</h3>
    <div class="analysis">${markdownToHtml(analysis.synthesis)}</div>`;
}

function buildHtml(
  data: PeriodReportData,
  start: Date,
  end: Date,
  mode: ReportExportMode,
  analysis?: ReportAnalysisSections
): string {
  const period = formatPeriodLabel(start, end);
  let body = '';

  if (mode === 'expenses' || mode === 'both') {
    body += buildExpensesSection(data);
  }
  if (mode === 'analysis' || mode === 'both') {
    if (analysis) body += buildAnalysisSection(analysis);
    else body += '<p><em>Analyse non disponible.</em></p>';
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>
      body{font-family:Helvetica,Arial,sans-serif;padding:28px;color:#1F2937;font-size:12px;line-height:1.5}
      h1{color:#7C3AED;font-size:22px;margin-bottom:4px}
      h2{color:#7C3AED;font-size:16px;margin-top:28px;border-bottom:2px solid #EDE9FE;padding-bottom:6px}
      h3{color:#374151;font-size:14px;margin-top:18px}
      .meta{color:#6B7280;font-size:11px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}
      th,td{border:1px solid #E5E7EB;padding:6px 8px;text-align:left}
      th{background:#EDE9FE;color:#5B21B6}
      .analysis{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px;margin-top:8px}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E5E7EB;color:#9CA3AF;font-size:10px}
    </style></head><body>
    <h1>${APP_NAME}</h1>
    <p class="meta">
      Rapport ${escapeHtml(period)}<br/>
      Édité par ${escapeHtml(COMPANY_NAME)} · Généré le ${new Date().toLocaleString('fr-FR')}
    </p>
    ${body}
    <p class="footer">${APP_NAME} — ${COMPANY_NAME} · Données locales · Document confidentiel</p>
    </body></html>`;
}

export async function exportReportPdf(options: {
  data: PeriodReportData;
  start: Date;
  end: Date;
  mode: ReportExportMode;
  analysis?: ReportAnalysisSections;
}): Promise<string> {
  const { data, start, end, mode, analysis } = options;
  const filename = buildReportFilename(start, end);
  const html = buildHtml(data, start, end, mode, analysis);

  const { uri: tempUri } = await Print.printToFileAsync({ html });

  const destUri = `${cacheDirectory}${filename}`;
  await copyAsync({ from: tempUri, to: destUri });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destUri, {
      mimeType: 'application/pdf',
      dialogTitle: filename.replace('.pdf', ''),
      UTI: 'com.adobe.pdf',
    });
  }
  return destUri;
}
