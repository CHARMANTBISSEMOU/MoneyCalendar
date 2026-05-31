import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  analyzeTransactionWithAI,
  type AIPlannedExpense,
  type AICreanceAction,
  type SuggestedCategory,
} from '@/services/aiService';
import { categoriesRepo, creancesRepo, plannedExpensesRepo, transactionsRepo } from '@/services/data';
import { log } from '@/utils/logger';
import { theme } from '@/constants/theme';
import type { CategoryType } from '@/types/models';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  transaction?: {
    categorie: string;
    beneficiaire?: string;
    libelle: string;
    montant: number;
    type: string;
    tag_non_planifie?: boolean;
    planifie?: boolean;
  };
  creance?: AICreanceAction;
  depensePlanifiee?: AIPlannedExpense;
  suggestedCategory?: SuggestedCategory;
  categoryAdded?: boolean;
  saved?: boolean;
  plannedSaved?: boolean;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      scrollToBottom
    );
    return () => showSub.remove();
  }, [scrollToBottom]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), text: inputText, sender: 'user' };
    log.info('Chat', 'Message utilisateur', { text: inputText });
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);
    scrollToBottom();

    try {
      const aiResponse = await analyzeTransactionWithAI(userMessage.text);
      const code = aiResponse.transaction?.categorie;
      let suggested = aiResponse.nouvelle_categorie ?? undefined;

      if (!suggested && code && !categoriesRepo.getByCode(code)) {
        suggested = {
          code,
          name: code.replace(/_/g, ' '),
          type: 'personnelle',
          icone: '📦',
          raison: 'Catégorie recommandée pour mieux classer cette opération.',
        };
      }

      const showSuggestion = !!(suggested && !categoriesRepo.getByCode(suggested.code));

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: aiResponse.message,
          transaction: aiResponse.transaction,
          creance: aiResponse.creance,
          depensePlanifiee: aiResponse.depense_planifiee ?? undefined,
          suggestedCategory: showSuggestion ? suggested : undefined,
          sender: 'ai',
          saved: false,
          plannedSaved: false,
          categoryAdded: false,
        },
      ]);
    } catch (error) {
      log.error('Chat', 'Erreur IA', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: error instanceof Error ? error.message : "Erreur de connexion à l'IA.",
          sender: 'ai',
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const addSuggestedCategory = (msgId: string, suggested: SuggestedCategory) => {
    try {
      const type = (['personnelle', 'tiers', 'speciale'].includes(suggested.type)
        ? suggested.type
        : 'personnelle') as CategoryType;

      categoriesRepo.create(suggested.code, suggested.name, type, suggested.icone ?? '📦');
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, categoryAdded: true, suggestedCategory: suggested } : m))
      );
      Alert.alert('Catégorie créée', `"${suggested.name}" (${suggested.code}) est disponible.`);
    } catch {
      Alert.alert('Erreur', 'Impossible de créer cette catégorie (code peut-être déjà utilisé).');
    }
  };

  const applyCreanceAction = (
    creance: AICreanceAction | undefined,
    transaction: ChatMessage['transaction']
  ): string | null => {
    if (!creance || creance.action === 'aucun') return null;

    const debiteur = creance.debiteur ?? transaction?.beneficiaire;
    const montant = creance.montant ?? transaction?.montant;
    if (!debiteur || !montant) return null;

    if (creance.action === 'nouveau_pret') {
      return creancesRepo.create({
        debiteur,
        montant,
        date_rappel: creance.date_rappel,
        motif: creance.motif,
      });
    }

    if (creance.action === 'remboursement') {
      const updated = creancesRepo.applyRepaymentByDebiteur(debiteur, montant);
      if (!updated) {
        Alert.alert(
          'Prêt introuvable',
          `Aucune dette ouverte pour « ${debiteur} ». Enregistrez d'abord le prêt initial.`
        );
        return null;
      }
      return updated.id;
    }
    return null;
  };

  const saveTransaction = (msg: ChatMessage) => {
    const { transaction, creance, depensePlanifiee } = msg;
    if (!transaction && !depensePlanifiee) return;

    if (depensePlanifiee && !msg.plannedSaved) {
      const catP = categoriesRepo.getByCode(depensePlanifiee.categorie);
      if (!catP) {
        Alert.alert('Catégorie manquante', `Créez la catégorie « ${depensePlanifiee.categorie} » d'abord.`);
        return;
      }
      try {
        plannedExpensesRepo.create(depensePlanifiee);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, plannedSaved: true } : m)));
      } catch (error) {
        log.error('Chat', 'Échec planification', error);
        Alert.alert('Erreur', 'Impossible d enregistrer la dépense planifiée');
        return;
      }
    }

    if (!transaction) {
      Alert.alert('Succès', 'Dépense planifiée enregistrée — rappel à la date prévue.');
      return;
    }

    const cat = categoriesRepo.getByCode(transaction.categorie);
    if (!cat) {
      Alert.alert(
        'Catégorie manquante',
        `Créez d'abord la catégorie "${transaction.categorie}" via le bouton proposé par l'IA.`
      );
      return;
    }

    try {
      const creanceId = applyCreanceAction(creance, transaction);
      transactionsRepo.create({
        montant: transaction.montant,
        libelle: transaction.libelle,
        categorie: transaction.categorie,
        date: new Date().toISOString().split('T')[0],
        beneficiaire: transaction.beneficiaire,
        tag_non_planifie: transaction.tag_non_planifie,
        planifie: transaction.planifie,
        type: transaction.type ?? 'sortie',
        creance_id: creanceId,
      });
      log.info('Chat', 'Transaction enregistrée', { transaction, creanceId });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, saved: true, plannedSaved: true } : m)));
      let successMsg = 'Transaction enregistrée';
      if (creance?.action === 'nouveau_pret') successMsg += ' — prêt suivi';
      if (creance?.action === 'remboursement' && creanceId) {
        const c = creancesRepo.getById(creanceId);
        if (c?.statut === 'soldee') successMsg += ` — ${c.debiteur} a soldé sa dette`;
        else if (c) successMsg += ` — reste ${c.montant_restant.toLocaleString('fr-FR')} FCFA`;
      }
      Alert.alert('Succès', successMsg);
    } catch (error) {
      log.error('Chat', 'Échec sauvegarde', error);
      Alert.alert('Erreur', "Impossible d'enregistrer");
    }
  };

  const catName = (code: string) => categoriesRepo.getByCode(code)?.name ?? code;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Money AI</Text>
        <Text style={styles.sub}>
          Ex: Prêt à Paul 50000 · Paul rembourse 20000 · Salaire 150000 · Prévoir loyer 80000 le 05/06
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToBottom}
        >
          {messages.length === 0 && (
            <Text style={styles.placeholder}>
              Décrivez une dépense, un prêt ou un revenu. L'IA peut proposer une nouvelle catégorie si besoin.
            </Text>
          )}
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.bubbleWrap, msg.sender === 'user' ? styles.userWrap : styles.aiWrap]}>
              <View style={[styles.bubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.bubbleText, msg.sender === 'user' && styles.userBubbleText]}>{msg.text}</Text>

                {msg.suggestedCategory && !msg.categoryAdded && (
                  <View style={styles.suggestCard}>
                    <Text style={styles.suggestTitle}>🏷️ Nouvelle catégorie suggérée</Text>
                    <Text style={styles.suggestName}>
                      {msg.suggestedCategory.icone ?? '📦'} {msg.suggestedCategory.name}{' '}
                      <Text style={styles.suggestCode}>({msg.suggestedCategory.code})</Text>
                    </Text>
                    {msg.suggestedCategory.raison ? (
                      <Text style={styles.suggestReason}>{msg.suggestedCategory.raison}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={styles.suggestBtn}
                      onPress={() => addSuggestedCategory(msg.id, msg.suggestedCategory!)}
                    >
                      <Text style={styles.suggestBtnText}>Ajouter cette catégorie</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {msg.suggestedCategory && msg.categoryAdded && (
                  <View style={styles.addedTag}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                    <Text style={styles.addedTagText}>Catégorie « {msg.suggestedCategory.name} » ajoutée</Text>
                  </View>
                )}

                {msg.depensePlanifiee && (
                  <View style={styles.planCard}>
                    <Text style={styles.planTitle}>📌 Dépense planifiée</Text>
                    <Text style={styles.planText}>
                      {msg.depensePlanifiee.libelle} — {msg.depensePlanifiee.montant.toLocaleString('fr-FR')} FCFA
                    </Text>
                    <Text style={styles.planText}>Date : {msg.depensePlanifiee.date_prevue}</Text>
                    {msg.plannedSaved && (
                      <Text style={styles.addedTagText}>Planification enregistrée</Text>
                    )}
                  </View>
                )}

                {msg.creance && msg.creance.action !== 'aucun' && (
                  <View style={styles.planCard}>
                    <Text style={styles.planTitle}>
                      {msg.creance.action === 'nouveau_pret' ? '🤝 Nouveau prêt' : '💰 Remboursement'}
                    </Text>
                    <Text style={styles.planText}>
                      {msg.creance.debiteur} — {msg.creance.montant?.toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                )}

                {msg.transaction && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{msg.transaction.libelle}</Text>
                    <Text style={styles.cardAmount}>
                      {msg.transaction.type === 'entree' ? '+' : ''}
                      {msg.transaction.montant?.toLocaleString('fr-FR')} FCFA
                      {msg.transaction.type === 'entree' ? ' (entrée)' : ''}
                    </Text>
                    <Text style={styles.cardCat}>
                      {catName(msg.transaction.categorie)}
                      {!categoriesRepo.getByCode(msg.transaction.categorie) ? ' (à créer)' : ''}
                    </Text>
                    {msg.transaction.tag_non_planifie && (
                      <Text style={styles.alertTag}>NON PLANIFIÉ</Text>
                    )}
                    {!msg.saved ? (
                      <TouchableOpacity
                        style={[
                          styles.confirmBtn,
                          !categoriesRepo.getByCode(msg.transaction.categorie) && styles.confirmBtnDisabled,
                        ]}
                        onPress={() => saveTransaction(msg)}
                      >
                        <Text style={styles.confirmText}>Confirmer & Enregistrer</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.savedRow}>
                        <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                        <Text style={styles.savedText}>Enregistré</Text>
                      </View>
                    )}
                  </View>
                )}

                {!msg.transaction && msg.depensePlanifiee && !msg.plannedSaved && (
                  <TouchableOpacity style={styles.confirmBtn} onPress={() => saveTransaction(msg)}>
                    <Text style={styles.confirmText}>Enregistrer la planification</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          {loading && <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />}
        </ScrollView>

        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Nouvelle transaction..."
            placeholderTextColor={theme.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={sendMessage}
            onFocus={scrollToBottom}
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={loading}>
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1 },
  header: { backgroundColor: theme.primary, padding: 16 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  sub: { color: '#E9D5FF', fontSize: 13, marginTop: 4 },
  chat: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 12, flexGrow: 1 },
  placeholder: { color: theme.textMuted, textAlign: 'center', marginTop: 40, lineHeight: 22 },
  bubbleWrap: { marginBottom: 12, flexDirection: 'row' },
  userWrap: { justifyContent: 'flex-end' },
  aiWrap: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '88%', padding: 12, borderRadius: 16 },
  userBubble: { backgroundColor: theme.primary },
  aiBubble: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  bubbleText: { color: theme.text, lineHeight: 20 },
  userBubbleText: { color: '#FFF' },
  suggestCard: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  suggestTitle: { fontWeight: 'bold', color: '#92400E', marginBottom: 6 },
  suggestName: { fontSize: 15, fontWeight: '600', color: theme.text },
  suggestCode: { color: theme.textMuted, fontWeight: 'normal', fontSize: 13 },
  suggestReason: { color: theme.textMuted, fontSize: 13, marginTop: 6, lineHeight: 18 },
  suggestBtn: {
    backgroundColor: '#F59E0B',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  suggestBtnText: { color: '#FFF', fontWeight: 'bold' },
  addedTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  addedTagText: { color: theme.success, fontWeight: '600', fontSize: 13 },
  planCard: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  planTitle: { fontWeight: 'bold', color: '#0369A1', marginBottom: 4 },
  planText: { color: theme.text, fontSize: 14 },
  card: { marginTop: 10, padding: 12, backgroundColor: theme.background, borderRadius: 10 },
  cardTitle: { fontWeight: 'bold', fontSize: 16 },
  cardAmount: { color: theme.primary, fontSize: 18, fontWeight: 'bold', marginVertical: 6 },
  cardCat: { color: theme.textMuted },
  alertTag: { color: theme.danger, fontWeight: 'bold', marginTop: 6, fontSize: 12 },
  confirmBtn: { backgroundColor: theme.primary, padding: 12, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: '#FFF', fontWeight: 'bold' },
  savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  savedText: { color: theme.success, fontWeight: 'bold' },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: theme.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderWidth: 1,
    borderColor: theme.border,
    maxHeight: 120,
    fontSize: 16,
    color: theme.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: Platform.OS === 'ios' ? 2 : 0,
  },
});
