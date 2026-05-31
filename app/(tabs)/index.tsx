import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import {
  budgetsRepo,
  categoriesRepo,
  creancesRepo,
  getBudgetWithStats,
  plannedExpensesRepo,
  transactionsRepo,
} from '@/services/data';
import { generateAIAnalysis } from '@/utils/aiAnalysis';
import { checkFinancialReminders } from '@/utils/reminders';
import { formatFCFA, formatMonthKey, formatMonthLabel, getMonthsList } from '@/utils/format';
import type { AIAnalysisCard, Category, CategoryStat } from '@/types/models';

export default function DashboardScreen() {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budget, setBudget] = useState<ReturnType<typeof getBudgetWithStats>>(null);
  const [stats, setStats] = useState<{ totalMois: number; topCategories: CategoryStat[] } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [aiAnalyses, setAiAnalyses] = useState<AIAnalysisCard[]>([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [newBudget, setNewBudget] = useState('');

  const mois = useMemo(() => formatMonthKey(selectedMonth), [selectedMonth]);

  const loadData = useCallback(() => {
    try {
      const monthStats = transactionsRepo.getStatistics(mois);
      setStats({
        totalMois: monthStats.total,
        topCategories: monthStats.parCategorie,
      });
      setBudget(getBudgetWithStats(mois));
      setCategories(categoriesRepo.getAll());

      const prev = new Date(selectedMonth);
      prev.setMonth(prev.getMonth() - 1);
      const moisPrec = formatMonthKey(prev);
      const depensesMois = transactionsRepo.getSortiesByMonth(mois).map((t) => ({
        categorie: t.categorie,
        montant: t.montant,
      }));
      const depensesPrecedentes = transactionsRepo.getSortiesByMonth(moisPrec).map((t) => ({
        categorie: t.categorie,
        montant: t.montant,
      }));

      const b = getBudgetWithStats(mois);
      setAiAnalyses(
        generateAIAnalysis({
          budget: b,
          stats: {
            totalMois: monthStats.total,
            topCategories: monthStats.parCategorie,
          },
          depensesMois,
          depensesPrecedentes,
          selectedMonth,
          creances: creancesRepo.getSummaries(),
          behavior: transactionsRepo.getBehaviorStats(mois),
          plannedDueSoon: plannedExpensesRepo.getUpcoming(14).map((p) => ({
            libelle: p.libelle,
            montant: p.montant,
            date_prevue: p.date_prevue,
          })),
        })
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mois, selectedMonth]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      checkFinancialReminders();
    }, [loadData])
  );

  const saveBudget = () => {
    const amount = parseFloat(newBudget);
    if (!newBudget || isNaN(amount) || amount <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    budgetsRepo.set(mois, amount);
    setShowBudgetModal(false);
    setNewBudget('');
    loadData();
  };

  const pct = budget ? Math.min(budget.pourcentageUtilise, 100) : 0;
  const restant = budget?.restant ?? 0;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
        <Text style={styles.headerTitle}>MoneyCalendar</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={styles.budgetCard}>
          <View style={styles.budgetTop}>
            <Text style={styles.budgetLabel}>Budget</Text>
            <TouchableOpacity style={styles.monthBtn} onPress={() => setShowMonthPicker(true)}>
              <Text style={styles.monthBtnText}>{formatMonthLabel(selectedMonth)}</Text>
              <Text style={styles.monthArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {budget ? (
            <>
              <View style={styles.incomeRow}>
                <View style={styles.incomeBox}>
                  <Text style={styles.incomeLabel}>Budget dépenses</Text>
                  <Text style={styles.incomeValue}>{formatFCFA(budget.montant)}</Text>
                </View>
                <View style={styles.incomeBox}>
                  <Text style={styles.incomeLabel}>Entrées du mois</Text>
                  <Text style={[styles.incomeValue, styles.incomePositive]}>
                    +{formatFCFA(budget.totalEntrees ?? 0)}
                  </Text>
                </View>
              </View>
              <View style={styles.progressRow}>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.pctText}>{pct.toFixed(1)}%</Text>
              </View>
              <Text style={styles.spentText}>
                {formatFCFA(budget.totalDepense)} dépensés — Reste {formatFCFA(restant)}
              </Text>
              <TouchableOpacity style={styles.budgetEditBtn} onPress={() => { setNewBudget(String(budget.montant)); setShowBudgetModal(true); }}>
                <Text style={styles.budgetEditText}>Budget max : {formatFCFA(budget.montant)}</Text>
              </TouchableOpacity>

              <View style={styles.aiSection}>
                <Text style={styles.aiTitle}>🤖 Analyse intelligente</Text>
                {aiAnalyses.map((a, i) => (
                  <View key={i} style={[styles.aiCard, aiCardStyle(a.type)]}>
                    <Text style={styles.aiCardText}>{a.icon} {a.text}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.setBudgetBtn} onPress={() => setShowBudgetModal(true)}>
              <Text style={styles.setBudgetText}>📊 Définir le budget du mois</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/categories')}>
            <Text style={styles.actionBtnText}>🏷️ Catégories</Text>
            <Text style={styles.badge}>{categories.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addFab} onPress={() => router.push('/add-expense' as Href)}>
            <Text style={styles.addFabText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Par catégorie</Text>
          {stats?.topCategories.length ? (
            stats.topCategories.map((cat, i) => {
              const p = stats.totalMois > 0 ? (cat.total / stats.totalMois) * 100 : 0;
              const catMeta = categories.find((c) => c.code === cat.code);
              return (
                <View key={i} style={styles.catRow}>
                  <Text style={styles.catEmoji}>{catMeta?.icone ?? '📦'}</Text>
                  <View style={styles.catInfo}>
                    <Text style={styles.catName}>{cat.nom}</Text>
                    <View style={styles.catBarBg}>
                      <View style={[styles.catBarFill, { width: `${p}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.catAmount}>{Math.round(cat.total).toLocaleString('fr-FR')} F</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>Aucune dépense ce mois-ci</Text>
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={showBudgetModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Budget mensuel (FCFA)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={newBudget} onChangeText={setNewBudget} placeholder="Ex: 200000" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setShowBudgetModal(false)}>
                <Text>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={saveBudget}>
                <Text style={styles.btnSaveText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showMonthPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthPicker(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choisir le mois</Text>
            <FlatList
              data={getMonthsList()}
              keyExtractor={(item) => item.value}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const selected = item.value === mois;
                return (
                  <TouchableOpacity
                    style={[styles.monthItem, selected && styles.monthItemOn]}
                    onPress={() => {
                      setSelectedMonth(new Date(item.year, item.month, 1));
                      setShowMonthPicker(false);
                      setLoading(true);
                    }}
                  >
                    <Text style={[styles.monthItemText, selected && styles.monthItemTextOn]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function aiCardStyle(type: AIAnalysisCard['type']) {
  switch (type) {
    case 'danger':
      return styles.ai_danger;
    case 'warning':
      return styles.ai_warning;
    case 'success':
      return styles.ai_success;
    default:
      return styles.ai_info;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: theme.primary, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  logo: { width: 40, height: 40, borderRadius: 20 },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  scroll: { flex: 1 },
  budgetCard: { backgroundColor: theme.card, margin: 16, borderRadius: 16, padding: 16, elevation: 2 },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  incomeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  incomeBox: { flex: 1, backgroundColor: theme.background, borderRadius: 10, padding: 10 },
  incomeLabel: { fontSize: 11, color: theme.textMuted, marginBottom: 4 },
  incomeValue: { fontSize: 15, fontWeight: '700', color: theme.text },
  incomePositive: { color: theme.success },
  budgetLabel: { fontSize: 18, fontWeight: 'bold', color: theme.text },
  monthBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  monthBtnText: { color: theme.primary, fontWeight: '600' },
  monthArrow: { color: theme.primary, marginLeft: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBg: { flex: 1, height: 10, backgroundColor: theme.border, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.primary, borderRadius: 5 },
  pctText: { fontWeight: 'bold', color: theme.primary, width: 48, textAlign: 'right' },
  spentText: { marginTop: 8, color: theme.textMuted, fontSize: 14 },
  budgetEditBtn: { marginTop: 12, padding: 10, backgroundColor: '#EDE9FE', borderRadius: 8 },
  budgetEditText: { color: theme.primary, fontWeight: '600', textAlign: 'center' },
  setBudgetBtn: { padding: 20, alignItems: 'center' },
  setBudgetText: { color: theme.primary, fontSize: 16, fontWeight: '600' },
  aiSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 },
  aiTitle: { fontWeight: 'bold', marginBottom: 8, color: theme.text },
  aiCard: { padding: 10, borderRadius: 8, marginBottom: 8, backgroundColor: '#F3F4F6' },
  ai_danger: { backgroundColor: '#FEE2E2' },
  ai_warning: { backgroundColor: '#FEF3C7' },
  ai_success: { backgroundColor: '#D1FAE5' },
  ai_info: { backgroundColor: '#DBEAFE' },
  aiCardText: { color: theme.text, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  actionBtn: { backgroundColor: theme.card, padding: 16, borderRadius: 12, flex: 1, marginRight: 12, alignItems: 'center' },
  actionBtnText: { fontWeight: '600', color: theme.text },
  badge: { marginTop: 4, color: theme.primary, fontWeight: 'bold' },
  addFab: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
  addFabText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  section: { margin: 16, backgroundColor: theme.card, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: theme.text },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catEmoji: { fontSize: 24, width: 36 },
  catInfo: { flex: 1 },
  catName: { fontWeight: '600', color: theme.text },
  catBarBg: { height: 6, backgroundColor: theme.border, borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  catBarFill: { height: '100%', backgroundColor: theme.primary },
  catAmount: { fontWeight: 'bold', color: theme.text, marginLeft: 8 },
  empty: { color: theme.textMuted, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 12, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  btnCancel: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 8, backgroundColor: theme.border },
  btnSave: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 8, backgroundColor: theme.primary },
  btnSaveText: { color: '#FFF', fontWeight: 'bold' },
  monthItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  monthItemOn: { backgroundColor: '#EDE9FE' },
  monthItemText: { color: theme.text },
  monthItemTextOn: { color: theme.primary, fontWeight: 'bold' },
});
