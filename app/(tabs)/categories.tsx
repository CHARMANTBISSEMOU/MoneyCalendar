import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { categoriesRepo } from '@/services/data';
import type { Category } from '@/types/models';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📦');
  const [isAdding, setIsAdding] = useState(false);

  const fetchCategories = () => setCategories(categoriesRepo.getAll());

  useFocusEffect(useCallback(() => { fetchCategories(); }, []));

  const handleAdd = () => {
    if (!newCode.trim() || !newName.trim()) {
      Alert.alert('Erreur', 'Code et nom requis');
      return;
    }
    try {
      categoriesRepo.create(newCode.trim(), newName.trim(), 'personnelle', newIcon || '📦');
      setNewCode('');
      setNewName('');
      setNewIcon('📦');
      setIsAdding(false);
      fetchCategories();
    } catch {
      Alert.alert('Erreur', 'Ce code existe déjà');
    }
  };

  const handleDelete = (code: string) => {
    Alert.alert('Supprimer', 'Supprimer cette catégorie ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          try {
            categoriesRepo.delete(code);
            fetchCategories();
          } catch {
            Alert.alert('Erreur', 'Catégorie utilisée par des transactions');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Catégories</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(!isAdding)}>
          <Ionicons name={isAdding ? 'close' : 'add'} size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {isAdding && (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Code (ex: LOISIRS)" value={newCode} onChangeText={setNewCode} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="Nom" value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="Emoji" value={newIcon} onChangeText={setNewIcon} maxLength={2} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
            <Text style={styles.saveBtnText}>Ajouter</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={categories}
        keyExtractor={(item) => item.code}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.emoji}>{item.icone ?? '📦'}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.code}>{item.code} · {item.type}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.code)}>
              <Ionicons name="trash-outline" size={22} color={theme.danger} />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: { backgroundColor: theme.primary, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  form: { padding: 16, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border },
  input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: theme.background },
  saveBtn: { backgroundColor: theme.primary, padding: 12, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 14, borderRadius: 12, marginBottom: 8 },
  emoji: { fontSize: 28, marginRight: 12 },
  rowBody: { flex: 1 },
  name: { fontWeight: '600', fontSize: 16, color: theme.text },
  code: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
});
