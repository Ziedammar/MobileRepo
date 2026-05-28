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

type PendingUser = {
  id: string;
  name: string;
  email: string | null;
  role: 'ADMIN' | 'LIVREUR';
  accessStatus: 'PENDING_APPROVAL';
  requestedStoreName: string | null;
  requestedVehicle: string | null;
};

export default function ValidationsScreen() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getSuperAdminPendingUsers();
      setUsers(data as PendingUser[]);
    } catch {
      //
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleReview = (user: PendingUser, action: 'approve' | 'reject') => {
    if (action === 'approve') {
      Alert.alert(
        `Approuver ${user.name}`,
        user.role === 'ADMIN'
          ? `Approuver comme admin du restaurant "${user.requestedStoreName || 'nouveau'}" ?`
          : `Approuver comme livreur (${user.requestedVehicle || 'inconnu'}) ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Approuver',
            onPress: async () => {
              try {
                await api.reviewPendingUser(user.id, {
                  action: 'approve',
                  storeName: user.requestedStoreName ?? undefined,
                  vehicle: user.requestedVehicle ?? undefined,
                });
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
        `Rejeter ${user.name}`,
        'Cette action est irréversible.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Rejeter',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.reviewPendingUser(user.id, { action: 'reject' });
                fetchData(true);
              } catch (e) {
                Alert.alert('Erreur', e instanceof Error ? e.message : 'Décision échouée');
              }
            },
          },
        ],
      );
    }
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
        <Text style={styles.headerTitle}>Validations en attente</Text>
        {users.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{users.length}</Text>
          </View>
        )}
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
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userEmail}>{item.email ?? '—'}</Text>
                <View style={styles.roleBadge}>
                  <Ionicons
                    name={item.role === 'ADMIN' ? 'storefront-outline' : 'bicycle-outline'}
                    size={12}
                    color={Colors.warning}
                  />
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
                {item.requestedStoreName && (
                  <Text style={styles.requestText}>Restaurant: {item.requestedStoreName}</Text>
                )}
                {item.requestedVehicle && (
                  <Text style={styles.requestText}>Véhicule: {item.requestedVehicle}</Text>
                )}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => handleReview(item, 'approve')}
              >
                <Ionicons name="checkmark" size={16} color={Colors.white} />
                <Text style={styles.approveBtnText}>Approuver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => handleReview(item, 'reject')}
              >
                <Ionicons name="close" size={16} color={Colors.error} />
                <Text style={styles.rejectBtnText}>Rejeter</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={64} color={Colors.success} />
            <Text style={styles.emptyTitle}>Aucune validation en attente</Text>
            <Text style={styles.emptyText}>Toutes les demandes ont été traitées</Text>
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
  countBadge: { backgroundColor: Colors.warningLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  countText: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.warning },

  userCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.small,
  },
  userInfo: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.warning },
  userDetails: { flex: 1, gap: 2 },
  userName: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  userEmail: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textSecondary },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  roleText: { fontFamily: Fonts.brandBold, fontSize: 11, color: Colors.warning },
  requestText: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textSecondary },

  actions: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.success,
  },
  approveBtnText: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.white },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md,
    backgroundColor: Colors.errorLight, borderWidth: 1, borderColor: Colors.error,
  },
  rejectBtnText: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.error },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
