import React from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, setAuthToken, setRefreshToken } from '@/src/api';
import { useAuthStore } from '@/store/auth';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc?: string;
  onPress: () => void;
  color?: string;
};

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.logout();
          } catch {
            //
          }
          setAuthToken(null);
          setRefreshToken(null);
          clearAuth();
          router.replace('/(public)/landing');
        },
      },
    ]);
  };

  const menuItems: MenuItem[] = [
    {
      icon: 'car-outline',
      label: 'Historique des trajets',
      desc: 'Voir tous vos trajets',
      onPress: () => router.push('/(client)/ride/history'),
    },
    {
      icon: 'card-outline',
      label: 'Moyens de paiement',
      desc: 'Gérer vos cartes et modes de paiement',
      onPress: () => router.push('/(client)/payment-methods'),
    },
    {
      icon: 'time-outline',
      label: 'Historique des paiements',
      desc: 'Vos transactions',
      onPress: () => router.push('/(client)/payment-history'),
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      desc: 'Gérer vos notifications',
      onPress: () => router.push('/(client)/notifications'),
    },
    {
      icon: 'help-circle-outline',
      label: 'Support & FAQ',
      desc: 'Aide et questions fréquentes',
      onPress: () => router.push('/(client)/support'),
    },
  ];

  const initials = (user?.name ?? 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerBg}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.name ?? 'Utilisateur'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role ?? 'CLIENT'}</Text>
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={styles.menuRow} onPress={item.onPress} activeOpacity={0.7}>
                <View style={[styles.menuIcon, { backgroundColor: (item.color ?? Colors.primary) + '15' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color ?? Colors.primary} />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.desc && <Text style={styles.menuDesc}>{item.desc}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              {i < menuItems.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* App info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>2.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID utilisateur</Text>
            <Text style={[styles.infoValue, { width: 120, textAlign: 'right' }]} numberOfLines={1}>
              {user?.id?.slice(0, 12) ?? '—'}...
            </Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  scroll: { paddingBottom: 40 },

  headerBg: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  avatarText: { fontFamily: Fonts.brandBlack, fontSize: 28, color: Colors.white },
  userName: { fontFamily: Fonts.brandBlack, fontSize: 22, color: Colors.white, marginBottom: 4 },
  userEmail: { fontFamily: Fonts.brand, fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 10 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  roleText: { fontFamily: Fonts.brandBold, fontSize: 12, color: Colors.white },

  menuCard: {
    margin: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.small,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: { flex: 1 },
  menuLabel: { fontFamily: Fonts.brandMedium, fontSize: 15, color: Colors.text },
  menuDesc: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 68 },

  infoCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  infoLabel: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },

  logoutBtn: {
    marginHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  logoutText: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.error },
});
