import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { LivreurOrdersResponse } from '@/src/types';

const STATUS_STEPS: Record<string, { next: 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED' | null; label: string; action: string }> = {
  ACCEPTED: { next: 'PICKED_UP', label: 'Acceptée', action: 'Marquer comme récupéré' },
  PICKED_UP: { next: 'ON_THE_WAY', label: 'Récupéré', action: 'Démarrer la livraison' },
  ON_THE_WAY: { next: 'DELIVERED', label: 'En route', action: 'Marquer comme livré' },
  DELIVERED: { next: null, label: 'Livré', action: '' },
};

export default function LivreurOrdersScreen() {
  const [data, setData] = useState<LivreurOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await api.getLivreurOrders();
      setData(d);
      setIsAvailable(d.courier.isAvailable);
    } catch {
      //
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdateStatus = async (orderId: string, status: 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED') => {
    setUpdatingId(orderId);
    try {
      await api.updateLivreurOrderStatus(orderId, status);
      fetchData(true);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Mise à jour échouée');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleAvailability = async (value: boolean) => {
    setIsAvailable(value);
    if (!data?.courier?.id) return;
    try {
      await api.setCourierAvailability(data.courier.id, value);
    } catch {
      setIsAvailable(!value);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.livreurPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Availability toggle */}
      <View style={[styles.availabilityBar, { backgroundColor: isAvailable ? Colors.livreurPrimaryLight : Colors.backgroundGray }]}>
        <View style={styles.availabilityLeft}>
          <View style={[styles.statusDot, { backgroundColor: isAvailable ? Colors.livreurPrimary : Colors.textMuted }]} />
          <Text style={styles.availabilityText}>
            {isAvailable ? 'Disponible pour livraisons' : 'Hors ligne'}
          </Text>
        </View>
        <Switch
          value={isAvailable}
          onValueChange={handleToggleAvailability}
          trackColor={{ false: Colors.border, true: Colors.livreurPrimary }}
          thumbColor={Colors.white}
        />
      </View>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes courses</Text>
        {data?.courier && (
          <Text style={styles.courierName}>{data.courier.name} • {data.courier.vehicle}</Text>
        )}
      </View>

      <FlatList
        data={data?.orders ?? []}
        keyExtractor={(o) => o.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[Colors.livreurPrimary]}
            tintColor={Colors.livreurPrimary}
          />
        }
        renderItem={({ item }) => {
          const step = STATUS_STEPS[item.status];
          return (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
                  <Text style={styles.storeName}>{item.store.name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: Colors.livreurPrimaryLight }]}>
                  <Text style={[styles.statusText, { color: Colors.livreurPrimary }]}>
                    {step?.label ?? item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.infoText} numberOfLines={1}>{item.addressText}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.infoText}>{item.total.toFixed(2)} DT</Text>
              </View>

              {step && step.next && (
                <TouchableOpacity
                  style={[styles.actionBtn, updatingId === item.id && styles.actionBtnLoading]}
                  onPress={() => step.next && handleUpdateStatus(item.id, step.next)}
                  disabled={updatingId === item.id}
                >
                  {updatingId === item.id ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />
                      <Text style={styles.actionBtnText}>{step.action}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bicycle-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>Aucune course assignée</Text>
            <Text style={styles.emptyText}>
              {isAvailable ? 'En attente de nouvelles courses...' : 'Activez votre disponibilité pour recevoir des courses'}
            </Text>
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
  availabilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  availabilityLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  availabilityText: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },

  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: Fonts.brandBlack, fontSize: 20, color: Colors.text },
  courierName: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.livreurPrimary, marginTop: 2 },

  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    ...Shadow.small,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  storeName: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.livreurPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  statusText: { fontFamily: Fonts.brandBold, fontSize: 12 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary, flex: 1 },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.livreurPrimary,
    padding: 12,
    borderRadius: BorderRadius.md,
    marginTop: 4,
  },
  actionBtnLoading: { opacity: 0.7 },
  actionBtnText: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.white },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },
});
