import type { AIAnalysisCard } from '@/types/models';

/** Évite les cartes d'analyse redondantes (même thème ou texte proche). */
export function dedupeAnalysisCards(cards: AIAnalysisCard[]): AIAnalysisCard[] {
  const topicOrder = ['budget_critique', 'budget_rythme', 'budget_ok', 'journalier', 'categorie', 'comportement', 'creance', 'planifie', 'revenu', 'comparaison', 'resume'];
  const topicRank = new Map(topicOrder.map((t, i) => [t, i]));

  function topicOf(card: AIAnalysisCard): string {
    const t = card.text.toLowerCase();
    if (t.includes('alerte critique') || t.includes('déjà dépensé') && t.includes('% du budget')) return 'budget_critique';
    if (t.includes('rythme') || t.includes('trop élevé')) return 'budget_rythme';
    if (t.includes('excellent') || t.includes('seulement') && t.includes('% du budget')) return 'budget_ok';
    if (t.includes('journalier') || t.includes('/jour')) return 'journalier';
    if (t.includes('représente') && t.includes('% des dépenses')) return 'categorie';
    if (t.includes('non planifi') || t.includes('comportement')) return 'comportement';
    if (t.includes('prêt') || t.includes('dette') || t.includes('rembours')) return 'creance';
    if (t.includes('planifi') || t.includes('prévu le')) return 'planifie';
    if (t.includes('revenu') || t.includes('entrée')) return 'revenu';
    if (t.includes('mois précédent') || t.includes('hausse') || t.includes('baisse')) return 'comparaison';
    return 'resume';
  }

  const byTopic = new Map<string, AIAnalysisCard>();
  for (const card of cards) {
    const topic = topicOf(card);
    const existing = byTopic.get(topic);
    if (!existing) {
      byTopic.set(topic, card);
      continue;
    }
    const priority = { danger: 4, warning: 3, info: 2, success: 1 };
    if (priority[card.type] > priority[existing.type]) {
      byTopic.set(topic, card);
    }
  }

  return [...byTopic.entries()]
    .sort((a, b) => (topicRank.get(a[0]) ?? 99) - (topicRank.get(b[0]) ?? 99))
    .map(([, card]) => card);
}

/** Réduit les répétitions évidentes entre sections de rapport IA. */
export function trimReportRepetition(text: string, alreadySaid: string): string {
  if (!text.trim()) return text;
  const saidLines = new Set(
    alreadySaid
      .split(/\n+/)
      .map((l) => l.replace(/\*\*/g, '').trim().toLowerCase())
      .filter((l) => l.length > 40)
  );
  const kept: string[] = [];
  for (const para of text.split(/\n\n+/)) {
    const key = para.replace(/\*\*/g, '').trim().toLowerCase();
    if (key.length > 40 && saidLines.has(key)) continue;
    kept.push(para);
    if (key.length > 40) saidLines.add(key);
  }
  return kept.join('\n\n');
}
