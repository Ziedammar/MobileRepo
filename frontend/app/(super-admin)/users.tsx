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
import type { UserRole } from '@/src/types';

type User = {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  accessStatus: string;
};

const ROLE_COLORS: Record<string, string> = {
  CLIENT: Colors.primary,
  ADMIN: Colors.adminPrimary,
  LIVREUR: Colors.livreurPrimary,
  SUPER_ADMIN: Colors.superAdminPrimary,
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: Colors.success,
  PENDING_APPROVAL: Colors.warning,
  REJECTED: Colors.error,
  SUSPENDED: Colors.textMuted,
};

export default function SuperAdminUsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getSuperAdminUsers();
      setUsers(data as User[]);
    } catch {
      //
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdateStatus = (user: User) => {
    const statuses: Array<{ label: string; value: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' }> = [
      { label: 'Activer', value: 'ACTIVE' },
      { label: 'Suspendre', value: 'SUSPENDED' },
      { label: 'Rejeter', value: 'REJECTED' },
    ];

    Alert.alert(
      `Modifier ${user.name}`,
      'Changer le statut d\'accès:',
      [
        ...statuses.map((s) => ({
          text: s.label,
          onPress: async () => {
            try {
              await api.updateSuperAdminUserAccessStatus(user.id, s.value);
              fetchData(true);
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Mise à jour échouée');
            }
          },
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ],
    );
  };

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
        <Text style={styles.headerTitle}>Utilisateurs ({users.length})</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[Colors.superAdminPrimary]}
            tintColor={Colors.superAdminPrimary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => handleUpdateStatus(item)}
            activeOpacity={0.8}
          >
            <View style={[styles.avatar, { backgroundColor: (ROLE_COLORS[item.role] ?? Colors.primary) + '20' }]}>
              <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] ?? Colors.primary }]}>
                {item.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.userEmail}>{item.email ?? '—'}</Text>
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: (ROLE_COLORS[item.role] ?? Colors.primary) + '20' }]}>
                  <Text style={[styles.badgeText, { color: ROLE_COLORS[item.role] ?? Colors.primary }]}>
                    {item.role}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[item.accessStatus] ?? Colors.primary) + '20' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[item.accessStatus] ?? Colors.primary }]}>
                    {item.accessStatus}
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color={Colors.border} />
            <Text style={styles.emptyTitle}>Aucun utilisateur</Text>
          </View>
        }
        contentContainerStyle={{ padding: Spacing.lg, gap: 10 }}
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

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.small,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.brandBold, fontSize: 16 },
  userInfo: { flex: 1 },
  userName: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text },
  userEmail: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  badgeText: { fontFamily: Fonts.brandBold, fontSize: 10 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
});
