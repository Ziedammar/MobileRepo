import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import type { PaymentTransaction } from '@/src/types';

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  PAID: Colors.success,
  FAILED: Colors.error,
  REFUNDED: Colors.primary,
};

export default function PaymentHistoryScreen() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPaymentsHistory().then(setTransactions).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historique des paiements</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: (STATUS_COLORS[item.status] ?? Colors.primary) + '20' }]}>
                <Ionicons
                  name={item.status === 'PAID' ? 'checkmark-circle-outline' : item.status === 'FAILED' ? 'close-circle-outline' : 'time-outline'}
                  size={22}
                  color={STATUS_COLORS[item.status] ?? Colors.primary}
                />
              </View>
              <View style={styles.info}>
                <Text style={styles.provider}>{item.provider}</Text>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.amount}>{item.amount.toFixed(2)} {item.currency}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? Colors.primary) + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? Colors.primary }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucune transaction</Text>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  provider: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text },
  date: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontFamily: Fonts.brandBold, fontSize: 10 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
});
