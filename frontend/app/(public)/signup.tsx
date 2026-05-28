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
import { api } from '@/src/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';

type Role = 'CLIENT' | 'ADMIN' | 'LIVREUR';

const ROLES: { role: Role; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: 'CLIENT', label: 'Client', desc: 'Commander et suivre des livraisons', icon: 'person-outline' },
  { role: 'ADMIN', label: 'Restaurant', desc: 'Gérer votre restaurant', icon: 'storefront-outline' },
  { role: 'LIVREUR', label: 'Livreur', desc: 'Effectuer des livraisons', icon: 'bicycle-outline' },
];

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CLIENT');
  const [storeName, setStoreName] = useState('');
  const [vehicle, setVehicle] = useState('Scooter');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir les champs obligatoires');
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        role,
        requestedStoreName: role === 'ADMIN' ? storeName : undefined,
        requestedVehicle: role === 'LIVREUR' ? vehicle : undefined,
      });
      if (res.requiresApproval) {
        Alert.alert(
          'Demande envoyée',
          'Votre compte est en attente d\'approbation par un administrateur.',
          [{ text: 'OK', onPress: () => router.replace('/(public)/signin') }],
        );
      } else {
        Alert.alert('Succès', 'Compte créé ! Vous pouvez maintenant vous connecter.', [
          { text: 'OK', onPress: () => router.replace('/(public)/signin') },
        ]);
      }
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Inscription échouée');
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
              <Ionicons name="person-add-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>Rejoignez LivraisonPro aujourd'hui</Text>
          </View>

          <Text style={styles.sectionTitle}>Je suis...</Text>
          <View style={styles.roleContainer}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.role}
                style={[styles.roleCard, role === r.role && styles.roleCardActive]}
                onPress={() => setRole(r.role)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={r.icon}
                  size={24}
                  color={role === r.role ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[styles.roleLabel, role === r.role && styles.roleLabelActive]}>
                  {r.label}
                </Text>
                <Text style={styles.roleDesc}>{r.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.form}>
            <Input
              label="Nom complet *"
              value={name}
              onChangeText={setName}
              placeholder="Votre nom"
              autoComplete="name"
              leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
            />
            <Input
              label="E-mail *"
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.com"
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
            />
            <Input
              label="Téléphone"
              value={phone}
              onChangeText={setPhone}
              placeholder="+216 XX XXX XXX"
              keyboardType="phone-pad"
              leftIcon={<Ionicons name="call-outline" size={18} color={Colors.textMuted} />}
            />
            <Input
              label="Mot de passe *"
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 8 caractères"
              secureTextEntry={!showPassword}
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

            {role === 'ADMIN' && (
              <Input
                label="Nom du restaurant"
                value={storeName}
                onChangeText={setStoreName}
                placeholder="Mon Restaurant"
                leftIcon={<Ionicons name="storefront-outline" size={18} color={Colors.textMuted} />}
              />
            )}

            {role === 'LIVREUR' && (
              <Input
                label="Véhicule"
                value={vehicle}
                onChangeText={setVehicle}
                placeholder="Ex: Scooter, Vélo, Voiture"
                leftIcon={<Ionicons name="bicycle-outline" size={18} color={Colors.textMuted} />}
              />
            )}

            <Button
              title="Créer mon compte"
              onPress={handleSignUp}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.signUpBtn}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.replace('/(public)/signin')}>
              <Text style={styles.footerLink}>Se connecter</Text>
            </TouchableOpacity>
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
    marginBottom: Spacing.xl,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Fonts.brandBlack,
    fontSize: 26,
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: Fonts.brand,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: Fonts.brandBold,
    fontSize: 15,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.xl,
  },
  roleCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundGray,
  },
  roleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  roleLabel: {
    fontFamily: Fonts.brandBold,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  roleLabelActive: { color: Colors.primary },
  roleDesc: {
    fontFamily: Fonts.brand,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  form: { marginBottom: Spacing.xxl },
  signUpBtn: { marginTop: Spacing.md },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary },
  footerLink: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.primary },
});
