import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '@/store/cart';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';

export default function CartScreen() {
  const { items, updateQuantity, removeItem, clearCart, totalPrice, storeName } = useCartStore();
  const [address, setAddress] = useState('Les Berges du Lac, Tunis');
  const DELIVERY_FEE = 2.5;
  const total = totalPrice() + DELIVERY_FEE;

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="bag-outline" size={64} color={Colors.border} />
        </View>
        <Text style={styles.emptyTitle}>Votre panier est vide</Text>
        <Text style={styles.emptySubtitle}>Ajoutez des articles depuis un restaurant</Text>
        <Button
          title="Explorer les restaurants"
          onPress={() => router.push('/(client)/')}
          style={styles.exploreBtn}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon panier</Text>
        {storeName && <Text style={styles.storeName}>{storeName}</Text>}
        <TouchableOpacity onPress={() => {
          Alert.alert('Vider le panier', 'Supprimer tous les articles ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Vider', style: 'destructive', onPress: clearCart },
          ]);
        }}>
          <Text style={styles.clearText}>Vider</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Image
              source={{ uri: item.product.imageUrl || 'https://via.placeholder.com/60' }}
              style={styles.itemImage}
            />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.product.name}</Text>
              <Text style={styles.itemPrice}>{(item.product.price * item.quantity).toFixed(2)} DT</Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
              >
                <Ionicons name="remove" size={16} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
              >
                <Ionicons name="add" size={16} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {/* Delivery address */}
            <View style={styles.addressCard}>
              <Ionicons name="location-outline" size={20} color={Colors.primary} />
              <View style={styles.addressInfo}>
                <Text style={styles.addressLabel}>Adresse de livraison</Text>
                <TextInput
                  style={styles.addressInput}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Entrez votre adresse"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            {/* Summary */}
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Récapitulatif</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sous-total</Text>
                <Text style={styles.summaryValue}>{totalPrice().toFixed(2)} DT</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Frais de livraison</Text>
                <Text style={styles.summaryValue}>{DELIVERY_FEE.toFixed(2)} DT</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{total.toFixed(2)} DT</Text>
              </View>
            </View>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      <View style={styles.checkoutWrap}>
        <Button
          title={`Commander • ${total.toFixed(2)} DT`}
          onPress={() => router.push({ pathname: '/(client)/checkout', params: { address } })}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl, gap: 12 },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.backgroundGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontFamily: Fonts.brandBlack, fontSize: 22, color: Colors.text },
  emptySubtitle: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  exploreBtn: { marginTop: Spacing.xl, paddingHorizontal: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: Fonts.brandBlack, fontSize: 20, color: Colors.text, flex: 1 },
  storeName: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.primary, marginRight: 8 },
  clearText: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.error },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 12,
    ...Shadow.small,
  },
  itemImage: { width: 60, height: 60, borderRadius: BorderRadius.md },
  itemInfo: { flex: 1 },
  itemName: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text, marginBottom: 4 },
  itemPrice: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.primary },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text, minWidth: 16, textAlign: 'center' },

  footer: { padding: Spacing.lg, gap: 16 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addressInfo: { flex: 1 },
  addressLabel: { fontFamily: Fonts.brandMedium, fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  addressInput: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.text },

  summary: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 },
  totalLabel: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
  totalValue: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.primary },

  checkoutWrap: {
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
