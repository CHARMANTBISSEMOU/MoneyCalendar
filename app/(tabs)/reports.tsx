import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '@/constants/theme';
import { COMPANY_NAME } from '@/constants/brand';
import { buildPeriodReportData } from '@/services/reportData';
import { generateReportAnalysis, generateLocalFallbackAnalysis } from '@/services/reportAnalysis';
import { exportReportPdf, type ReportExportMode } from '@/services/reportPdf';
import { formatMonthLabel, buildReportFilename } from '@/utils/format';

type PeriodMode = 'month' | 'range';

const EXPORT_OPTIONS: { id: ReportExportMode; label: string; desc: string }[] = [
  { id: 'expenses', label: 'Dépenses seules', desc: 'Liste + budgets par mois' },
  { id: 'analysis', label: 'Analyses seules', desc: 'Critique IA (prêts, comportement, 5 étapes)' },
  { id: 'both', label: 'Complet', desc: 'Dépenses + analyses dans un PDF' },
];

export default function ReportsScreen() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [month, setMonth] = useState(new Date());
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    d.setDate(1);
    return d;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [exportMode, setExportMode] = useState<ReportExportMode>('both');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);

  const resolvePeriod = (): { start: Date; end: Date } => {
    if (periodMode === 'month') {
      const start = new Date(month.getFullYear(), month.getMonth(), 1);
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      return { start, end };
    }
    return { start: startDate, end: endDate };
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(month);
    d.setMonth(d.getMonth() + delta);
    setMonth(d);
  };

  const generate = async () => {
    const { start, end } = resolvePeriod();
    if (start > end) {
      Alert.alert('Erreur', 'La date de début doit être avant la date de fin.');
      return;
    }

    setLoading(true);
    setProgress('Préparation des données…');

    try {
      const data = buildPeriodReportData(start, end);
      if (data.transactionCount === 0 && exportMode !== 'analysis') {
        Alert.alert('Aucune donnée', 'Aucune dépense sur cette période.');
        setLoading(false);
        return;
      }

      let analysis;
      if (exportMode === 'analysis' || exportMode === 'both') {
        try {
          analysis = await generateReportAnalysis(data, (step, total, label) => {
            setProgress(`Étape ${step}/${total} — ${label}`);
          });
        } catch (aiError) {
          console.warn(aiError);
          Alert.alert(
            'Analyse IA partielle',
            "L'IA n'a pas répondu. Export avec analyse locale simplifiée."
          );
          analysis = generateLocalFallbackAnalysis(data);
        }
      }

      setProgress('Génération du PDF…');
      const filename = buildReportFilename(start, end);
      await exportReportPdf({ data, start, end, mode: exportMode, analysis });

      Alert.alert('PDF prêt', `Fichier : ${filename}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible de générer le rapport.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const { start, end } = resolvePeriod();
  const previewName = buildReportFilename(start, end);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Rapports PDF</Text>
        <Text style={styles.sub}>{COMPANY_NAME}</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={styles.sectionLabel}>Période</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, periodMode === 'month' && styles.toggleOn]}
            onPress={() => setPeriodMode('month')}
          >
            <Text style={[styles.toggleText, periodMode === 'month' && styles.toggleTextOn]}>Un mois</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, periodMode === 'range' && styles.toggleOn]}
            onPress={() => setPeriodMode('range')}
          >
            <Text style={[styles.toggleText, periodMode === 'range' && styles.toggleTextOn]}>Période libre</Text>
          </TouchableOpacity>
        </View>

        {periodMode === 'month' ? (
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.arrow}>
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.arrow}>
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rangeBox}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPicker('start')}>
              <Text style={styles.dateLabel}>Du</Text>
              <Text style={styles.dateValue}>{startDate.toLocaleDateString('fr-FR')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPicker('end')}>
              <Text style={styles.dateLabel}>Au</Text>
              <Text style={styles.dateValue}>{endDate.toLocaleDateString('fr-FR')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {picker && (
          <DateTimePicker
            value={picker === 'start' ? startDate : endDate}
            mode="date"
            onChange={(_, d) => {
              if (Platform.OS === 'android') setPicker(null);
              if (!d) return;
              if (picker === 'start') setStartDate(d);
              else setEndDate(d);
            }}
          />
        )}

        <Text style={styles.filenamePreview}>📄 {previewName}</Text>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Contenu du rapport</Text>
        {EXPORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.exportOption, exportMode === opt.id && styles.exportOptionOn]}
            onPress={() => setExportMode(opt.id)}
          >
            <View style={styles.radioOuter}>{exportMode === opt.id && <View style={styles.radioInner} />}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exportLabel}>{opt.label}</Text>
              <Text style={styles.exportDesc}>{opt.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {(exportMode === 'analysis' || exportMode === 'both') && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Analyse critique (4 étapes IA)</Text>
            <Text style={styles.infoText}>
              1. Par catégorie · 2. Tiers/bénéficiaires · 3. Libellés & comportement · 4. Synthèse &
              recommandations — style audit personnel (Exemple_critique).
            </Text>
          </View>
        )}

        {loading && (
          <View style={styles.progressBox}>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.progressText}>{progress}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.btn} onPress={generate} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>Générer & partager le PDF</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: { backgroundColor: theme.primary, padding: 16 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  sub: { color: '#E9D5FF', fontSize: 13, marginTop: 2 },
  body: { flex: 1, padding: 20 },
  sectionLabel: { fontWeight: '700', color: theme.text, marginBottom: 10, fontSize: 15 },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: '#EDE9FE', borderColor: theme.primary },
  toggleText: { color: theme.textMuted, fontWeight: '600' },
  toggleTextOn: { color: theme.primary },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center' },
  arrowText: { fontSize: 24, color: theme.primary },
  monthLabel: { fontSize: 17, fontWeight: 'bold', color: theme.text },
  rangeBox: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dateBtn: { flex: 1, backgroundColor: theme.card, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
  dateLabel: { color: theme.textMuted, fontSize: 12 },
  dateValue: { color: theme.text, fontWeight: '600', marginTop: 4 },
  filenamePreview: { textAlign: 'center', color: theme.primary, fontWeight: '600', marginTop: 12, fontSize: 13 },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: theme.card,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  exportOptionOn: { borderColor: theme.primary, backgroundColor: '#F5F3FF' },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.primary },
  exportLabel: { fontWeight: '600', color: theme.text },
  exportDesc: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  infoBox: { backgroundColor: '#EDE9FE', padding: 14, borderRadius: 10, marginVertical: 12 },
  infoTitle: { fontWeight: 'bold', color: theme.primary, marginBottom: 6 },
  infoText: { color: theme.text, fontSize: 13, lineHeight: 20 },
  progressBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  progressText: { color: theme.textMuted, flex: 1 },
  btn: { backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
