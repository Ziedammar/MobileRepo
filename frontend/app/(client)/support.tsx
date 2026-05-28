import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { SupportTicket } from '@/src/types';

type Tab = 'faq' | 'tickets';

export default function SupportScreen() {
  const [tab, setTab] = useState<Tab>('faq');
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [f, t] = await Promise.all([
          api.getSupportFaqs().catch(() => []),
          api.getSupportTickets().catch(() => []),
        ]);
        setFaqs(f);
        setTickets(t);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le sujet et le message');
      return;
    }
    setCreating(true);
    try {
      const ticket = await api.createSupportTicket({ subject: newSubject.trim(), message: newMessage.trim() });
      setTickets((prev) => [ticket, ...prev]);
      setNewSubject('');
      setNewMessage('');
      setTab('tickets');
      Alert.alert('Ticket créé', 'Votre demande a été envoyée. Nous vous répondrons rapidement.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Création échouée');
    } finally {
      setCreating(false);
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    OPEN: Colors.warning,
    IN_PROGRESS: Colors.primary,
    RESOLVED: Colors.success,
    CLOSED: Colors.textMuted,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support & Aide</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['faq', 'tickets'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'faq' ? 'FAQ' : 'Mes tickets'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : tab === 'faq' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionTitle}>Questions fréquentes</Text>
          {faqs.map((faq, i) => (
            <TouchableOpacity
              key={i}
              style={styles.faqCard}
              onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQ}>{faq.question}</Text>
                <Ionicons
                  name={expandedFaq === i ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.textMuted}
                />
              </View>
              {expandedFaq === i && (
                <Text style={styles.faqA}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))}

          {/* New ticket form */}
          <Text style={styles.sectionTitle}>Créer un ticket</Text>
          <View style={styles.newTicketCard}>
            <TextInput
              style={styles.subjectInput}
              value={newSubject}
              onChangeText={setNewSubject}
              placeholder="Sujet de votre demande"
              placeholderTextColor={Colors.textMuted}
            />
            <TextInput
              style={styles.messageInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Décrivez votre problème..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreateTicket}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitText}>Envoyer</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <View style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketSubject} numberOfLines={1}>{item.subject}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? Colors.primary) + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? Colors.primary }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.ticketDate}>
                {new Date(item.createdAt).toLocaleDateString('fr-FR')}
              </Text>
              {item.messages.slice(-1).map((m) => (
                <Text key={m.id} style={styles.ticketMsg} numberOfLines={2}>
                  {m.senderRole}: {m.message}
                </Text>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="help-circle-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucun ticket</Text>
              <Text style={styles.emptyText}>Créez un ticket depuis l'onglet FAQ</Text>
            </View>
          }
          contentContainerStyle={{ padding: Spacing.lg, gap: 12 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },

  tabs: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundGray,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  tabText: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontFamily: Fonts.brandBold },

  scroll: { padding: Spacing.lg, gap: 12 },
  sectionTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text, marginTop: 8 },

  faqCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  faqQ: { flex: 1, fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  faqA: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary, marginTop: 8 },

  newTicketCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  subjectInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontFamily: Fonts.brand,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.backgroundGray,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontFamily: Fonts.brand,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.backgroundGray,
    minHeight: 100,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  submitText: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.white },

  ticketCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketSubject: { flex: 1, fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text },
  ticketDate: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textMuted },
  ticketMsg: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontFamily: Fonts.brandBold, fontSize: 10 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
  emptyText: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
});
