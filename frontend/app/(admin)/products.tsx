import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { Product } from '@/src/types';

export default function AdminProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = () => {
    setLoading(true);
    api.getAdminProducts().then(setProducts).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleToggleAvailability = async (product: Product) => {
    try {
      await api.updateAdminProduct(product.id, { isAvailable: !product.isAvailable });
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p)
      );
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Mise à jour échouée');
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      'Supprimer',
      `Supprimer "${product.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAdminProduct(product.id);
              setProducts((prev) => prev.filter((p) => p.id !== product.id));
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Suppression échouée');
            }
          },
        },
      ],
    );
  };

  const handleAdd = () => {
    Alert.alert('Ajouter un produit', 'Cette fonctionnalité sera disponible prochainement.');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.adminPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Produits</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Ionicons name="add" size={20} color={Colors.white} />
          <Text style={styles.addText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <Image
              source={{ uri: item.imageUrl || 'https://via.placeholder.com/60' }}
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.productCategory}>{item.category ?? '—'}</Text>
              <Text style={styles.productPrice}>{item.price.toFixed(2)} DT</Text>
              {item.stock !== undefined && (
                <Text style={styles.productStock}>Stock: {item.stock}</Text>
              )}
            </View>
            <View style={styles.productActions}>
              <Switch
                value={item.isAvailable ?? true}
                onValueChange={() => handleToggleAvailability(item)}
                trackColor={{ false: Colors.border, true: Colors.success }}
                thumbColor={Colors.white}
              />
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={56} color={Colors.border} />
            <Text style={styles.emptyTitle}>Aucun produit</Text>
            <TouchableOpacity style={styles.addEmptyBtn} onPress={handleAdd}>
              <Text style={styles.addEmptyText}>Ajouter votre premier produit</Text>
            </TouchableOpacity>
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
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: Fonts.brandBlack, fontSize: 20, color: Colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.adminPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  addText: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.white },

  productCard: {
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
  productImage: { width: 64, height: 64, borderRadius: BorderRadius.md },
  productInfo: { flex: 1 },
  productName: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text },
  productCategory: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  productPrice: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.primary, marginTop: 2 },
  productStock: { fontFamily: Fonts.brand, fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  productActions: { alignItems: 'center', gap: 10 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
  addEmptyBtn: {
    backgroundColor: Colors.adminPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  addEmptyText: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.white },
});
