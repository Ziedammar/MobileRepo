import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, getAdminDashboardWsUrl } from '@/src/api';
import { useAuthStore } from '@/store/auth';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { AdminDashboardResponse } from '@/src/types';

type StatCard = {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await api.getAdminDashboard();
      setData(d);
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

  useEffect(() => {
    if (!token) return;
    try {
      const ws = new WebSocket(getAdminDashboardWsUrl(token));
      wsRef.current = ws;
      ws.onmessage = () => fetchData(true);
      ws.onerror = () => {};
      return () => ws.close();
    } catch {
      return undefined;
    }
  }, [token]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.adminPrimary} />
      </SafeAreaView>
    );
  }

  const stats: StatCard[] = data
    ? [
        { label: 'Total commandes', value: data.stats.totalOrders, icon: 'receipt-outline', color: Colors.primary },
        { label: 'En attente', value: data.stats.pendingOrders, icon: 'time-outline', color: Colors.warning },
        { label: 'Livrées aujourd\'hui', value: data.stats.deliveredToday, icon: 'checkmark-circle-outline', color: Colors.success },
        { label: 'Revenu aujourd\'hui', value: `${data.stats.revenueToday.toFixed(2)} DT`, icon: 'cash-outline', color: Colors.adminPrimary },
        { label: 'Livreurs dispo', value: data.stats.availableCouriers, icon: 'bicycle-outline', color: Colors.livreurPrimary },
        { label: 'Livreurs occupés', value: data.stats.busyCouriers, icon: 'bicycle', color: Colors.textSecondary },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Tableau de bord</Text>
          <Text style={styles.headerTitle}>{data?.store?.name ?? 'Mon Restaurant'}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: Colors.adminPrimaryLight }]}>
          <Text style={[styles.roleText, { color: Colors.adminPrimary }]}>ADMIN</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[Colors.adminPrimary]}
            tintColor={Colors.adminPrimary}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        {/* Stats grid */}
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

        {/* Chart placeholder */}
        {data && data.stats.chart.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Commandes (7 derniers jours)</Text>
            <View style={styles.chartBars}>
              {data.stats.chart.map((c, i) => {
                const maxOrders = Math.max(...data.stats.chart.map((x) => x.orders), 1);
                const height = Math.max(4, (c.orders / maxOrders) * 100);
                return (
                  <View key={i} style={styles.barWrap}>
                    <View style={[styles.bar, { height, backgroundColor: Colors.adminPrimary + (i === data.stats.chart.length - 1 ? 'FF' : '60') }]} />
                    <Text style={styles.barLabel}>{c.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          {[
            { label: 'Gérer les commandes', icon: 'receipt-outline' as const, badge: data?.stats.pendingOrders },
            { label: 'Gérer les produits', icon: 'cube-outline' as const },
            { label: 'Gérer les livreurs', icon: 'bicycle-outline' as const },
          ].map((action, i) => (
            <TouchableOpacity key={i} style={styles.actionRow}>
              <View style={[styles.actionIcon, { backgroundColor: Colors.adminPrimaryLight }]}>
                <Ionicons name={action.icon} size={20} color={Colors.adminPrimary} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
              {action.badge ? (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{action.badge}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
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
  headerSubtitle: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textMuted },
  headerTitle: { fontFamily: Fonts.brandBlack, fontSize: 20, color: Colors.text },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
  roleText: { fontFamily: Fonts.brandBold, fontSize: 11 },

  scroll: { padding: Spacing.lg, gap: 16 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    ...Shadow.small,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontFamily: Fonts.brandBlack, fontSize: 22, color: Colors.text },
  statLabel: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textSecondary },

  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.small,
  },
  chartTitle: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text, marginBottom: Spacing.md },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 },
  barWrap: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { fontFamily: Fonts.brand, fontSize: 10, color: Colors.textMuted },

  quickActionsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    ...Shadow.small,
  },
  sectionTitle: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text, marginBottom: 8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flex: 1, fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  actionBadge: { backgroundColor: Colors.error, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  actionBadgeText: { fontFamily: Fonts.brandBold, fontSize: 11, color: Colors.white },
});
