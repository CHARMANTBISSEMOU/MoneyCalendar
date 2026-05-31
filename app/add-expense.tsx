import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '@/constants/theme';
import { categoriesRepo, transactionsRepo } from '@/services/data';

export default function AddExpenseScreen() {
  const router = useRouter();
  const categories = categoriesRepo.getAll();
  const [montant, setMontant] = useState('');
  const [libelle, setLibelle] = useState('');
  const [categorie, setCategorie] = useState(categories[0]?.code ?? 'DIVERS');
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);

  const save = () => {
    const amount = parseFloat(montant);
    if (!montant || isNaN(amount) || amount <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (!libelle.trim()) {
      Alert.alert('Erreur', 'Description requise');
      return;
    }
    transactionsRepo.create({
      montant: amount,
      libelle: libelle.trim(),
      categorie,
      date: date.toISOString().split('T')[0],
      type: 'sortie',
    });
    Alert.alert('Succès', 'Dépense enregistrée', [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Nouvelle dépense', headerStyle: { backgroundColor: theme.primary }, headerTintColor: '#FFF' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Montant (FCFA)</Text>
        <TextInput style={styles.input} value={montant} onChangeText={setMontant} keyboardType="numeric" placeholder="15000" />

        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.input} value={libelle} onChangeText={setLibelle} placeholder="Ex: Courses marché" />

        <Text style={styles.label}>Catégorie</Text>
        <View style={styles.catWrap}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.code}
              style={[styles.catChip, categorie === c.code && styles.catChipOn]}
              onPress={() => setCategorie(c.code)}
            >
              <Text style={categorie === c.code ? styles.catChipTextOn : undefined}>
                {c.icone} {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowDate(true)}>
          <Text>{date.toLocaleDateString('fr-FR')}</Text>
        </TouchableOpacity>
        {showDate && (
          <DateTimePicker
            value={date}
            mode="date"
            onChange={(_, d) => {
              if (Platform.OS === 'android') setShowDate(false);
              if (d) setDate(d);
            }}
          />
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>Enregistrer</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20 },
  label: { fontWeight: '600', marginBottom: 6, color: theme.text },
  input: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 14, marginBottom: 16 },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catChip: { padding: 10, borderRadius: 8, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  catChipOn: { backgroundColor: '#EDE9FE', borderColor: theme.primary },
  catChipTextOn: { color: theme.primary, fontWeight: '600' },
  saveBtn: { backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
