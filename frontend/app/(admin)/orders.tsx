import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { AdminOrder, Courier } from '@/src/types';

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  ACCEPTED: Colors.primary,
  PREPARING: Colors.primary,
  READY: Colors.primaryDark,
  PICKED_UP: Colors.primary,
  ON_THE_WAY: Colors.primary,
  DELIVERED: Colors.success,
  REFUSED: Colors.error,
  CANCELLED: Colors.error,
};

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [o, c] = await Promise.all([api.getAdminOrders(), api.getAdminCouriers().catch(() => [])]);
      setOrders(o);
      setCouriers(c);
    } catch {
      //
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDecide = (order: AdminOrder, decision: 'accept' | 'refuse') => {
    if (decision === 'accept') {
      const availableCouriers = couriers.filter((c) => c.isAvailable);
      if (availableCouriers.length === 0) {
        Alert.alert(
          'Accepter la commande',
          'Aucun livreur disponible. Accepter quand même ?',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Accepter',
              onPress: async () => {
                try {
                  await api.adminDecideOrder(order.id, { decision: 'accept' });
                  fetchData(true);
                } catch (e) {
                  Alert.alert('Erreur', e instanceof Error ? e.message : 'Décision échouée');
                }
              },
            },
          ],
        );
      } else {
        Alert.alert(
          'Choisir un livreur',
          'Sélectionnez un livreur:',
          [
            ...availableCouriers.map((c) => ({
              text: `${c.name} (${c.vehicle})`,
              onPress: async () => {
                try {
                  await api.adminDecideOrder(order.id, { decision: 'accept', courierId: c.id });
                  fetchData(true);
                } catch (e) {
                  Alert.alert('Erreur', e instanceof Error ? e.message : 'Décision échouée');
                }
              },
            })),
            { text: 'Annuler', style: 'cancel' as const },
          ],
        );
      }
    } else {
      Alert.prompt(
        'Refuser la commande',
        'Raison du refus (optionnel):',
        async (note) => {
          try {
            await api.adminDecideOrder(order.id, { decision: 'refuse', note: note ?? '' });
            fetchData(true);
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Décision échouée');
          }
        },
        'plain-text',
        '',
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.adminPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commandes</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{orders.length}</Text>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[Colors.adminPrimary]}
            tintColor={Colors.adminPrimary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? Colors.primary) + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? Colors.primary }]}>
                  {item.status}
                </Text>
              </View>
            </View>
            <View style={styles.orderInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.infoText}>{item.user.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.infoText}>{item.total.toFixed(2)} DT</Text>
                <Text style={styles.paymentStatus}>• {item.paymentStatus}</Text>
              </View>
              {item.courier && (
                <View style={styles.infoRow}>
                  <Ionicons name="bicycle-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.infoText}>{item.courier.name} ({item.courier.vehicle})</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.infoText}>
                  {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>

            {item.status === 'PENDING' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.acceptBtn]}
                  onPress={() => handleDecide(item, 'accept')}
                >
                  <Ionicons name="checkmark" size={16} color={Colors.white} />
                  <Text style={styles.acceptText}>Accepter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.refuseBtn]}
                  onPress={() => handleDecide(item, 'refuse')}
                >
                  <Ionicons name="close" size={16} color={Colors.error} />
                  <Text style={styles.refuseText}>Refuser</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={56} color={Colors.border} />
            <Text style={styles.emptyTitle}>Aucune commande</Text>
          </View>
        }
        contentContainerStyle={{ padding: Spacing.lg, gap: 12 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { flex: 1, fontFamily: Fonts.brandBlack, fontSize: 20, color: Colors.text },
  countBadge: { backgroundColor: Colors.adminPrimaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  countText: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.adminPrimary },

  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.small,
  },
  orderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontFamily: Fonts.brandBold, fontSize: 11 },
  orderInfo: { gap: 5, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary },
  paymentStatus: { fontFamily: Fonts.brandMedium, fontSize: 12, color: Colors.success },

  actionRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  acceptBtn: { backgroundColor: Colors.success },
  refuseBtn: { backgroundColor: Colors.errorLight, borderWidth: 1, borderColor: Colors.error },
  acceptText: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.white },
  refuseText: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.error },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
});
