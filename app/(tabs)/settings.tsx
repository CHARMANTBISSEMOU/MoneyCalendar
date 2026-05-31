import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Href, useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { COMPANY_NAME } from '@/constants/brand';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.appName}>MoneyCalendar</Text>
          <Text style={styles.sub}>Gestion locale — {COMPANY_NAME}</Text>
        </View>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/(tabs)/chat')}>
          <Text style={styles.rowIcon}>🤖</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Money AI</Text>
            <Text style={styles.rowSub}>Saisir une dépense en langage naturel</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/(tabs)/categories')}>
          <Text style={styles.rowIcon}>🏷️</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Catégories</Text>
            <Text style={styles.rowSub}>Gérer vos catégories de dépenses</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/(tabs)/reports' as Href)}>
          <Text style={styles.rowIcon}>📄</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Rapports PDF</Text>
            <Text style={styles.rowSub}>Exporter vos dépenses du mois</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Mode hors-ligne</Text>
          <Text style={styles.infoText}>
            Toutes vos données sont stockées uniquement sur cet appareil (SQLite). Aucune synchronisation cloud.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: { backgroundColor: theme.primary, padding: 16 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  content: { padding: 16 },
  profileCard: { backgroundColor: theme.card, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  logo: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  appName: { fontSize: 22, fontWeight: 'bold', color: theme.text },
  sub: { color: theme.textMuted, marginTop: 4, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 10 },
  rowIcon: { fontSize: 28, marginRight: 14 },
  rowBody: { flex: 1 },
  rowTitle: { fontWeight: '600', fontSize: 16, color: theme.text },
  rowSub: { color: theme.textMuted, fontSize: 13, marginTop: 2 },
  infoBox: { backgroundColor: '#EDE9FE', padding: 16, borderRadius: 12, marginTop: 12 },
  infoTitle: { fontWeight: 'bold', color: theme.primary, marginBottom: 6 },
  infoText: { color: theme.text, lineHeight: 20, fontSize: 14 },
});
