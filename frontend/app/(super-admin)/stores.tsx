import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';

type Store = {
  id: string;
  name: string;
  category: string;
  adminUser: { id: string; name: string; email: string | null } | null;
  _count: { products: number; orders: number; couriers: number };
};

export default function SuperAdminStoresScreen() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getSuperAdminStores();
      setStores(data as Store[]);
    } catch {
      //
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.superAdminPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Restaurants ({stores.length})</Text>
      </View>

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[Colors.superAdminPrimary]}
            tintColor={Colors.superAdminPrimary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.storeCard}>
            <View style={styles.storeHeader}>
              <View style={styles.storeIcon}>
                <Ionicons name="storefront-outline" size={22} color={Colors.adminPrimary} />
              </View>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{item.name}</Text>
                <Text style={styles.storeCategory}>{item.category}</Text>
                {item.adminUser && (
                  <Text style={styles.adminName}>Admin: {item.adminUser.name}</Text>
                )}
              </View>
            </View>
            <View style={styles.statsRow}>
              {[
                { label: 'Produits', value: item._count.products, icon: 'cube-outline' as const },
                { label: 'Commandes', value: item._count.orders, icon: 'receipt-outline' as const },
                { label: 'Livreurs', value: item._count.couriers, icon: 'bicycle-outline' as const },
              ].map((stat) => (
                <View key={stat.label} style={styles.statItem}>
                  <Ionicons name={stat.icon} size={14} color={Colors.textMuted} />
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={56} color={Colors.border} />
            <Text style={styles.emptyTitle}>Aucun restaurant</Text>
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
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: Fonts.brandBlack, fontSize: 20, color: Colors.text },

  storeCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.small,
  },
  storeHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  storeIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.adminPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  storeInfo: { flex: 1 },
  storeName: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  storeCategory: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textSecondary },
  adminName: { fontFamily: Fonts.brandMedium, fontSize: 12, color: Colors.adminPrimary, marginTop: 2 },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, gap: 8 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text },
  statLabel: { fontFamily: Fonts.brand, fontSize: 10, color: Colors.textMuted },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
});
