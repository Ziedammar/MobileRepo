import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { OrderDetails } from '@/src/types';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: Colors.warning },
  ACCEPTED: { label: 'Acceptée', color: Colors.primary },
  PREPARING: { label: 'En préparation', color: Colors.primary },
  READY: { label: 'Prête', color: Colors.primaryDark },
  PICKED_UP: { label: 'En route', color: Colors.primary },
  ON_THE_WAY: { label: 'En livraison', color: Colors.primary },
  DELIVERED: { label: 'Livrée', color: Colors.success },
  REFUSED: { label: 'Refusée', color: Colors.error },
  CANCELLED: { label: 'Annulée', color: Colors.error },
};

// We'll use ride history + fake order list from getHome
// For actual orders we'd need a getMyOrders endpoint
// For now show a mix of rides and recent activity

export default function OrdersScreen() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const rideHist = await api.getRideHistory().catch(() => []);
      setRides(rideHist);
    } catch {
      //
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes activités</Text>
      </View>

      <FlatList
        data={rides}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/(client)/ride/tracking', params: { rideId: item.id } })}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="car-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.info}>
              <Text style={styles.dest} numberOfLines={1}>{item.destinationAddress}</Text>
              <Text style={styles.meta}>
                {item.serviceType} • {item.distanceKm?.toFixed(1) ?? '?'} km •{' '}
                {new Date(item.createdAt).toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <Text style={styles.price}>{(item.finalPrice ?? item.estimatedPrice)?.toFixed(2) ?? '?'} DT</Text>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <View style={styles.tabsRow}>
            <TouchableOpacity style={[styles.tab, styles.tabActive]}>
              <Text style={styles.tabTextActive}>Trajets</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => {}}>
              <Text style={styles.tabText}>Livraisons</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={56} color={Colors.border} />
            <Text style={styles.emptyTitle}>Aucune activité</Text>
            <Text style={styles.emptyText}>Vos commandes et trajets apparaîtront ici</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: Fonts.brandBlack, fontSize: 22, color: Colors.text },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundGray,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  tabText: { fontFamily: Fonts.brandMedium, fontSize: 13, color: Colors.textSecondary },
  tabTextActive: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.primary },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.small,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  dest: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text },
  meta: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  price: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.primary },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
