import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { useCartStore } from '@/store/cart';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';

type PaymentMethod = 'CARD' | 'CASH';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'CARD', label: 'Carte bancaire', icon: 'card-outline' },
  { id: 'CASH', label: 'Espèces à la livraison', icon: 'cash-outline' },
];

export default function CheckoutScreen() {
  const { address } = useLocalSearchParams<{ address?: string }>();
  const { items, storeId, totalPrice, clearCart } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [loading, setLoading] = useState(false);
  const DELIVERY_FEE = 2.5;

  const handleCheckout = async () => {
    if (!storeId || items.length === 0) {
      Alert.alert('Erreur', 'Panier vide');
      return;
    }
    setLoading(true);
    try {
      const order = await api.createOrder({
        storeId,
        addressText: address || 'Les Berges du Lac, Tunis',
        addressLat: 36.8065,
        addressLng: 10.1815,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      });

      if (order.paymentRequired && paymentMethod === 'CARD') {
        await api.payOrder(order.id, { provider: 'CARD', cardLast4: '4242' });
      }

      clearCart();
      Alert.alert('Commande passée !', `Votre commande #${order.id.slice(0, 8)} a été enregistrée.`, [
        {
          text: 'Suivre ma commande',
          onPress: () => router.replace(`/(client)/order/${order.id}`),
        },
      ]);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Commande échouée');
    } finally {
      setLoading(false);
    }
  };

  const total = totalPrice() + DELIVERY_FEE;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Passer la commande</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Delivery address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Adresse de livraison</Text>
          <View style={styles.addressCard}>
            <Ionicons name="location" size={18} color={Colors.primary} />
            <Text style={styles.addressText}>{address || 'Les Berges du Lac, Tunis'}</Text>
          </View>
        </View>

        {/* Order items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛍 Articles commandés</Text>
          {items.map((item) => (
            <View key={item.product.id} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}×</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
              <Text style={styles.itemPrice}>{(item.product.price * item.quantity).toFixed(2)} DT</Text>
            </View>
          ))}
        </View>

        {/* Payment method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Mode de paiement</Text>
          {PAYMENT_METHODS.map((pm) => (
            <TouchableOpacity
              key={pm.id}
              style={[styles.pmCard, paymentMethod === pm.id && styles.pmCardActive]}
              onPress={() => setPaymentMethod(pm.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={pm.icon}
                size={22}
                color={paymentMethod === pm.id ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.pmLabel, paymentMethod === pm.id && styles.pmLabelActive]}>
                {pm.label}
              </Text>
              <View style={[styles.radio, paymentMethod === pm.id && styles.radioActive]}>
                {paymentMethod === pm.id && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Order summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Récapitulatif</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>{totalPrice().toFixed(2)} DT</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de livraison</Text>
            <Text style={styles.summaryValue}>{DELIVERY_FEE.toFixed(2)} DT</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{total.toFixed(2)} DT</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.confirmWrap}>
        <Button
          title={`Confirmer • ${total.toFixed(2)} DT`}
          onPress={handleCheckout}
          loading={loading}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },

  scroll: { padding: Spacing.lg, gap: 16 },

  section: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text, marginBottom: Spacing.md },

  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  addressText: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text, flex: 1 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  itemQty: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.primary, width: 28 },
  itemName: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.text, flex: 1 },
  itemPrice: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text },

  pmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 8,
    backgroundColor: Colors.backgroundGray,
  },
  pmCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  pmLabel: { flex: 1, fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.textSecondary },
  pmLabelActive: { color: Colors.text },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  summaryTitle: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  totalLabel: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
  totalValue: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.primary },

  confirmWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadow.large,
  },
});
