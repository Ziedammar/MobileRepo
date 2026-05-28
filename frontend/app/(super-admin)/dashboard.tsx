import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { SuperAdminDashboard } from '@/src/types';

export default function SuperAdminDashboardScreen() {
  const [data, setData] = useState<SuperAdminDashboard | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [d, a] = await Promise.all([
        api.getSuperAdminDashboard(),
        api.getSuperAdminAnalytics().catch(() => null),
      ]);
      setData(d);
      setAnalytics(a);
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

  const stats = [
    { label: 'Utilisateurs', value: data?.usersCount ?? 0, icon: 'people-outline' as const, color: Colors.primary },
    { label: 'Restaurants', value: data?.storesCount ?? 0, icon: 'storefront-outline' as const, color: Colors.adminPrimary },
    { label: 'En attente', value: data?.pendingApprovals ?? 0, icon: 'time-outline' as const, color: Colors.warning },
    { label: 'Commandes auj.', value: data?.ordersToday ?? 0, icon: 'receipt-outline' as const, color: Colors.superAdminPrimary },
    { label: 'Livrées auj.', value: data?.deliveredToday ?? 0, icon: 'checkmark-circle-outline' as const, color: Colors.success },
    ...(analytics ? [
      { label: 'Paiements auj.', value: `${(analytics.paymentsToday ?? 0).toFixed(2)} DT`, icon: 'cash-outline' as const, color: Colors.livreurPrimary },
    ] : []),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Vue globale</Text>
          <Text style={styles.headerTitle}>Super Admin</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: Colors.superAdminPrimaryLight }]}>
          <Text style={[styles.badgeText, { color: Colors.superAdminPrimary }]}>SUPER ADMIN</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[Colors.superAdminPrimary]}
            tintColor={Colors.superAdminPrimary}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.color + '20' }]}>
                <Ionicons name={s.icon} size={20} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Users by role */}
        {data?.usersByRole && data.usersByRole.length > 0 && (
          <View style={styles.rolesCard}>
            <Text style={styles.sectionTitle}>Utilisateurs par rôle</Text>
            {data.usersByRole.map((r) => (
              <View key={r.role} style={styles.roleRow}>
                <Text style={styles.roleLabel}>{r.role}</Text>
                <View style={styles.roleBarWrap}>
                  <View
                    style={[
                      styles.roleBar,
                      {
                        width: `${Math.min(100, (r.count / (data.usersCount || 1)) * 100)}%`,
                        backgroundColor: Colors.superAdminPrimary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.roleCount}>{r.count}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSub: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textMuted },
  headerTitle: { fontFamily: Fonts.brandBlack, fontSize: 22, color: Colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
  badgeText: { fontFamily: Fonts.brandBold, fontSize: 11 },

  scroll: { padding: Spacing.lg, gap: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 6, ...Shadow.small },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: Fonts.brandBlack, fontSize: 22, color: Colors.text },
  statLabel: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textSecondary },

  rolesCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: 12, ...Shadow.small },
  sectionTitle: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleLabel: { fontFamily: Fonts.brandMedium, fontSize: 13, color: Colors.textSecondary, width: 90 },
  roleBarWrap: { flex: 1, height: 8, backgroundColor: Colors.backgroundGray, borderRadius: 4, overflow: 'hidden' },
  roleBar: { height: '100%', borderRadius: 4 },
  roleCount: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.text, width: 30, textAlign: 'right' },
});
