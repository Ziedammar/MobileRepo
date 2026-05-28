import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import type { UserPaymentMethod, PaymentMethodType } from '@/src/types';

const PM_ICONS: Record<PaymentMethodType, keyof typeof Ionicons.glyphMap> = {
  CARD: 'card-outline',
  CASH: 'cash-outline',
  APPLE_PAY: 'logo-apple',
  GOOGLE_PAY: 'logo-google',
};

const PM_COLORS: Record<PaymentMethodType, string> = {
  CARD: '#4285F4',
  CASH: Colors.success,
  APPLE_PAY: Colors.dark,
  GOOGLE_PAY: '#EA4335',
};

export default function PaymentMethodsScreen() {
  const [methods, setMethods] = useState<UserPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMethods = () => {
    setLoading(true);
    api.getPaymentMethods().then(setMethods).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleAdd = () => {
    Alert.prompt(
      'Ajouter une carte',
      'Numéro de carte (4 derniers chiffres)',
      async (last4) => {
        if (!last4) return;
        try {
          await api.addPaymentMethod({
            type: 'CARD',
            label: `Visa ****${last4}`,
            last4,
            isDefault: methods.length === 0,
          });
          fetchMethods();
        } catch (e) {
          Alert.alert('Erreur', e instanceof Error ? e.message : 'Ajout échoué');
        }
      },
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moyens de paiement</Text>
        <TouchableOpacity onPress={handleAdd} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={methods}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: (PM_COLORS[item.type] ?? Colors.primary) + '20' }]}>
                <Ionicons
                  name={PM_ICONS[item.type] ?? 'card-outline'}
                  size={24}
                  color={PM_COLORS[item.type] ?? Colors.primary}
                />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>{item.label}</Text>
                {item.last4 && <Text style={styles.last4}>•••• {item.last4}</Text>}
              </View>
              {item.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultText}>Par défaut</Text>
                </View>
              )}
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity style={styles.addCard} onPress={handleAdd}>
              <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
              <Text style={styles.addText}>Ajouter un moyen de paiement</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="card-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucun moyen de paiement</Text>
              <Text style={styles.emptyText}>Ajoutez une carte pour payer facilement</Text>
            </View>
          }
          contentContainerStyle={{ padding: Spacing.lg, gap: 12 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { flex: 1, fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text, marginLeft: 12 },
  addBtn: { padding: 4 },

  card: {
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
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  label: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  last4: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary },
  defaultBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  defaultText: { fontFamily: Fonts.brandBold, fontSize: 11, color: Colors.primary },

  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addText: { fontFamily: Fonts.brandMedium, fontSize: 15, color: Colors.primary },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
  emptyText: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
