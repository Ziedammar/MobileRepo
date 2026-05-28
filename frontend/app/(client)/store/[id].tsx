import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { useCartStore } from '@/store/cart';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { Product, StoreDetails } from '@/src/types';

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [store, setStore] = useState<StoreDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const { addItem, totalItems, items } = useCartStore();

  useEffect(() => {
    if (!id) return;
    api
      .getStore(id)
      .then(setStore)
      .catch(() => Alert.alert('Erreur', 'Impossible de charger le restaurant'))
      .finally(() => setLoading(false));
  }, [id]);

  const categories = store
    ? ['Tous', ...new Set(store.products.map((p) => p.category ?? 'Autre'))]
    : [];

  const filteredProducts = (store?.products ?? []).filter(
    (p) => selectedCategory === 'Tous' || p.category === selectedCategory,
  );

  const cartCount = totalItems();

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!store) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.errorText}>Restaurant introuvable</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }



  return (
    <View style={styles.container}>
      {/* Animated header */}
      <View style={[styles.animHeader]}>
        <SafeAreaView>
          <View style={styles.animHeaderInner}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.animHeaderTitle} numberOfLines={1}>{store.name}</Text>
            <View style={{ width: 36 }} />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        stickyHeaderIndices={[1]}
      >
        {/* Hero image */}
        <View style={styles.hero}>
          <Image
            source={{ uri: store.imageUrl || 'https://via.placeholder.com/600x300' }}
            style={styles.heroImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.heroGradient}
          />
          <SafeAreaView style={styles.heroContent}>
            <TouchableOpacity style={styles.backBtnHero} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={Colors.white} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Store info */}
        <View style={styles.storeInfo}>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeCategory}>{store.category}</Text>
          <Text style={styles.storeDesc} numberOfLines={2}>{store.description}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={14} color="#F5A623" />
              <Text style={styles.metaText}>{store.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.dot}>•</Text>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.metaText}>{store.etaMinutes}–{store.etaMinutes + 10} min</Text>
            </View>
            <Text style={styles.dot}>•</Text>
            <View style={styles.metaItem}>
              <Ionicons name="bicycle-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.metaText}>
                {store.deliveryFee === 0 ? 'Gratuit' : `${store.deliveryFee.toFixed(2)} DT`}
              </Text>
            </View>
          </View>
        </View>

        {/* Category tabs - sticky */}
        <View style={styles.categoryTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catTab, selectedCategory === cat && styles.catTabActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.catTabText, selectedCategory === cat && styles.catTabTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Products */}
        <View style={styles.productsSection}>
          {filteredProducts.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              storeId={store.id}
              storeName={store.name}
              quantity={items.find((i) => i.product.id === product.id)?.quantity ?? 0}
              onAdd={() => addItem(product, store.id, store.name)}
              onRemove={() => useCartStore.getState().updateQuantity(product.id, (items.find((i) => i.product.id === product.id)?.quantity ?? 1) - 1)}
            />
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Cart button */}
      {cartCount > 0 && (
        <View style={styles.cartBtnWrap}>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => router.push('/(client)/cart')}
            activeOpacity={0.9}
          >
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
            <Text style={styles.cartBtnText}>Voir le panier</Text>
            <Text style={styles.cartBtnPrice}>
              {useCartStore.getState().totalPrice().toFixed(2)} DT
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

type ProductRowProps = {
  product: Product;
  storeId: string;
  storeName: string;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
};

function ProductRow({ product, quantity, onAdd, onRemove }: ProductRowProps) {
  return (
    <View style={styles.productRow}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productDesc} numberOfLines={2}>{product.description}</Text>
        <Text style={styles.productPrice}>{product.price.toFixed(2)} DT</Text>
      </View>
      <View style={styles.productRight}>
        <Image
          source={{ uri: product.imageUrl || 'https://via.placeholder.com/80' }}
          style={styles.productImage}
        />
        {quantity > 0 ? (
          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={onRemove}>
              <Ionicons name="remove" size={16} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={onAdd}>
              <Ionicons name="add" size={16} color={Colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
            <Ionicons name="add" size={20} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
  backLink: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.primary, marginTop: 8 },

  animHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.small,
  },
  animHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  animHeaderTitle: {
    flex: 1,
    fontFamily: Fonts.brandBold,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },

  hero: { height: 240, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  heroContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  backBtnHero: {
    margin: Spacing.lg,
    marginTop: Spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundGray,
    alignItems: 'center',
    justifyContent: 'center',
  },

  storeInfo: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
  },
  storeName: { fontFamily: Fonts.brandBlack, fontSize: 22, color: Colors.text, marginBottom: 4 },
  storeCategory: { fontFamily: Fonts.brandMedium, fontSize: 13, color: Colors.primary, marginBottom: 6 },
  storeDesc: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontFamily: Fonts.brandMedium, fontSize: 13, color: Colors.textSecondary },
  dot: { color: Colors.textMuted, fontSize: 12 },

  categoryTabs: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryScroll: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: 8 },
  catTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catTabActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  catTabText: { fontFamily: Fonts.brandMedium, fontSize: 13, color: Colors.textSecondary },
  catTabTextActive: { color: Colors.primary },

  productsSection: { padding: Spacing.lg, gap: 16 },

  productRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.small,
  },
  productInfo: { flex: 1 },
  productName: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text, marginBottom: 4 },
  productDesc: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  productPrice: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.primary },

  productRight: { alignItems: 'center', gap: 8 },
  productImage: { width: 80, height: 80, borderRadius: BorderRadius.md },

  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text, minWidth: 16, textAlign: 'center' },

  cartBtnWrap: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  cartBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadow.large,
  },
  cartBadge: {
    backgroundColor: Colors.white,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cartBadgeText: { fontFamily: Fonts.brandBold, fontSize: 12, color: Colors.primary },
  cartBtnText: { flex: 1, fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.white },
  cartBtnPrice: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.white },
});
