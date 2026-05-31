import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { theme } from '@/constants/theme';
import { categoriesRepo, transactionsRepo } from '@/services/data';
import type { Category, Transaction } from '@/types/models';
import { formatFCFA } from '@/utils/format';

export default function ExpensesScreen() {
  const [depenses, setDepenses] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [montant, setMontant] = useState('');
  const [libelle, setLibelle] = useState('');
  const [categorie, setCategorie] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);

  const load = useCallback(() => {
    setDepenses(transactionsRepo.getAll().filter((t) => t.type === 'sortie'));
    setCategories(categoriesRepo.getAll());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEdit = (item: Transaction) => {
    setEditing(item);
    setMontant(String(item.montant));
    setLibelle(item.libelle);
    setCategorie(item.categorie);
    setDate(new Date(item.date));
    setEditModal(true);
  };

  const saveEdit = () => {
    if (!editing || !montant || isNaN(Number(montant))) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    transactionsRepo.update(editing.id, {
      montant: parseFloat(montant),
      libelle: libelle.trim() || 'Sans libellé',
      categorie,
      date: date.toISOString().split('T')[0],
    });
    setEditModal(false);
    load();
    Alert.alert('Succès', 'Dépense modifiée');
  };

  const deleteItem = (item: Transaction) => {
    Alert.alert('Supprimer', `Supprimer ${formatFCFA(item.montant)} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          transactionsRepo.delete(item.id);
          load();
        },
      },
    ]);
  };

  const catLabel = (code: string) => categories.find((c) => c.code === code)?.name ?? code;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes dépenses</Text>
      </View>
      <FlatList
        data={depenses}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={depenses.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={<Text style={styles.empty}>Aucune dépense enregistrée</Text>}
        renderItem={({ item }) => {
          const d = new Date(item.date);
          return (
            <TouchableOpacity style={styles.row} onPress={() => openEdit(item)} onLongPress={() => deleteItem(item)}>
              <View style={styles.dateCircle}>
                <Text style={styles.dateDay}>{d.getDate()}</Text>
                <Text style={styles.dateMon}>{d.toLocaleDateString('fr-FR', { month: 'short' })}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.libelle}</Text>
                <Text style={styles.rowSub}>{catLabel(item.categorie)}</Text>
              </View>
              <Text style={styles.rowAmount}>-{Math.round(item.montant).toLocaleString('fr-FR')} F</Text>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Modifier la dépense</Text>
            <TextInput style={styles.input} value={montant} onChangeText={setMontant} keyboardType="numeric" placeholder="Montant" />
            <TextInput style={styles.input} value={libelle} onChangeText={setLibelle} placeholder="Description" />
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.catWrap}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.catChip, categorie === c.code && styles.catChipOn]}
                  onPress={() => setCategorie(c.code)}
                >
                  <Text>{c.icone} {c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.input} onPress={() => setShowDate(true)}>
              <Text>{date.toLocaleDateString('fr-FR')}</Text>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker
                value={date}
                mode="date"
                onChange={(_, d) => {
                  setShowDate(Platform.OS === 'ios');
                  if (d) setDate(d);
                }}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setEditModal(false)}>
                <Text>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={saveEdit}>
                <Text style={styles.btnSaveText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: theme.primary, padding: 16 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', color: theme.textMuted, marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 12 },
  dateCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dateDay: { fontWeight: 'bold', color: theme.primary },
  dateMon: { fontSize: 10, color: theme.primary },
  rowBody: { flex: 1 },
  rowTitle: { fontWeight: '600', color: theme.text },
  rowSub: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  rowAmount: { fontWeight: 'bold', color: theme.danger },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 12, marginBottom: 10 },
  label: { fontWeight: '600', marginBottom: 6 },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  catChip: { padding: 8, borderRadius: 8, backgroundColor: theme.background },
  catChipOn: { backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: theme.primary },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnCancel: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 8, backgroundColor: theme.border },
  btnSave: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 8, backgroundColor: theme.primary },
  btnSaveText: { color: '#FFF', fontWeight: 'bold' },
});
