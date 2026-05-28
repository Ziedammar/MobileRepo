import React from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, setAuthToken, setRefreshToken } from '@/src/api';
import { useAuthStore } from '@/store/auth';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';

export default function SuperAdminProfile() {
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Déconnexion', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          try { await api.logout(); } catch {}
          setAuthToken(null); setRefreshToken(null); clearAuth();
          router.replace('/(public)/landing');
        },
      },
    ]);
  };

  const initials = (user?.name ?? 'SA').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        <View style={[styles.headerBg, { backgroundColor: Colors.superAdminPrimary }]}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>SUPER ADMINISTRATEUR</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          {[
            { icon: 'analytics-outline' as const, label: 'Analytics', onPress: () => {} },
            { icon: 'list-outline' as const, label: 'Logs système', onPress: () => {} },
            { icon: 'settings-outline' as const, label: 'Paramètres globaux', onPress: () => {} },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={styles.menuRow} onPress={item.onPress}>
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon} size={20} color={Colors.superAdminPrimary} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

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
  headerBg: { alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.xxxl },
  avatarWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, borderWidth: 3, borderColor: Colors.white },
  avatarText: { fontFamily: Fonts.brandBlack, fontSize: 28, color: Colors.white },
  userName: { fontFamily: Fonts.brandBlack, fontSize: 22, color: Colors.white, marginBottom: 4 },
  userEmail: { fontFamily: Fonts.brand, fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 10 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  roleText: { fontFamily: Fonts.brandBold, fontSize: 11, color: Colors.white },
  menuCard: { margin: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: 12 },
  menuIcon: { width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: Colors.superAdminPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontFamily: Fonts.brandMedium, fontSize: 15, color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 68 },
  logoutBtn: { marginHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.error, backgroundColor: Colors.errorLight },
  logoutText: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.error },
});
