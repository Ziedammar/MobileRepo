import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';

export default function SignIn() {
  const [email, setEmail] = useState('client@livraisonpro.app');
  const [password, setPassword] = useState('Client123!');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login({ email: email.trim(), password });
      if (res.token) {
        setAuthToken(res.token);
        setRefreshToken(res.refreshToken ?? null);
        setAuth(res.token, res.refreshToken ?? null, res.user);

        const role = res.user.role;
        if (role === 'SUPER_ADMIN') router.replace('/(super-admin)/dashboard');
        else if (role === 'ADMIN') router.replace('/(admin)/dashboard');
        else if (role === 'LIVREUR') router.replace('/(livreur)/orders');
        else router.replace('/(client)/');
      } else if (res.requiresApproval) {
        Alert.alert(
          'Compte en attente',
          res.message || 'Votre compte est en attente de validation.',
        );
      }
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Connexion échouée');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const res = await api.authGuest({ name: 'Invité', phone: undefined });
      if (res.token) {
        setAuthToken(res.token);
        setRefreshToken(res.refreshToken ?? null);
        setAuth(res.token, res.refreshToken ?? null, res.user);
        router.replace('/(client)/');
      }
    } catch (e) {
      Alert.alert('Erreur', 'Connexion invité échouée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoIcon}>
              <Ionicons name="bicycle" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Bon retour !</Text>
            <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
            />

            <Input
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              placeholder="Votre mot de passe"
              secureTextEntry={!showPassword}
              autoComplete="password"
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              }
            />

            <Button
              title="Se connecter"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.loginBtn}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Continuer en tant qu'invité"
              onPress={handleGuestLogin}
              variant="outline"
              fullWidth
              size="lg"
              loading={loading}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas encore de compte ? </Text>
            <TouchableOpacity onPress={() => router.replace('/(public)/signup')}>
              <Text style={styles.footerLink}>S'inscrire</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickAccess}>
            <Text style={styles.quickTitle}>Accès rapide (démo)</Text>
            {[
              { email: 'client@livraisonpro.app', password: 'Client123!', label: 'Client', color: Colors.primary },
              { email: 'admin@livraisonpro.app', password: 'Admin123!', label: 'Admin', color: Colors.adminPrimary },
              { email: 'livreur@livraisonpro.app', password: 'Livreur123!', label: 'Livreur', color: Colors.livreurPrimary },
              { email: 'superadmin@livraisonpro.app', password: 'Super123!', label: 'Super Admin', color: Colors.superAdminPrimary },
            ].map((acc) => (
              <TouchableOpacity
                key={acc.email}
                style={[styles.quickBtn, { borderColor: acc.color }]}
                onPress={() => {
                  setEmail(acc.email);
                  setPassword(acc.password);
                }}
              >
                <Text style={[styles.quickBtnText, { color: acc.color }]}>{acc.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: 40 },
  back: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Fonts.brandBlack,
    fontSize: 28,
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: Fonts.brand,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  form: {
    marginBottom: Spacing.xxl,
  },
  loginBtn: {
    marginTop: Spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textMuted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  footerText: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary },
  footerLink: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.primary },
  quickAccess: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xl,
    gap: 8,
  },
  quickTitle: {
    fontFamily: Fonts.brandMedium,
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
    textAlign: 'center',
  },
  quickBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickBtnText: {
    fontFamily: Fonts.brandMedium,
    fontSize: 13,
  },
});
