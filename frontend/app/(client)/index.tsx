import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { useAuthStore } from '@/store/auth';
import { StoreCard } from '@/components/StoreCard';
import { CategoryPills } from '@/components/CategoryPill';
import { ServiceToggle } from '@/components/ServiceToggle';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { HomeResponse, StoreSummary } from '@/src/types';

const QUICK_SERVICES = [
  { key: 'food', label: 'Food', icon: 'restaurant-outline' as const, mode: 'delivery' as const },
  { key: 'market', label: 'Courses', icon: 'cart-outline' as const, mode: 'delivery' as const },
  { key: 'rides', label: 'Trajets', icon: 'car-outline' as const, mode: 'rides' as const },
  { key: 'pharmacy', label: 'Pharmacie', icon: 'medical-outline' as const, mode: 'delivery' as const },
];

const PROMO_BANNERS = [
  { title: '🎉 Livraison gratuite', desc: 'Sur votre première commande', color: '#01BEE5' },
  { title: '🚗 Trajet -20%', desc: 'Code promo: RIDE20', color: '#6C63FF' },
  { title: '🍕 -15% partout', desc: 'Restaurants partenaires', color: '#00AA12' },
];

export default function HomeScreen() {
  const [serviceMode, setServiceMode] = useState<'delivery' | 'rides'>('delivery');
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [promoIndex, setPromoIndex] = useState(0);
  const user = useAuthStore((s) => s.user);

  const fetchHome = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getHome();
      setHome(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  const filteredStores: StoreSummary[] = (home?.stores ?? []).filter((s) => {
    const matchCat =
      selectedCategory === 'Tous' ||
      s.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  const headerName = user?.name?.split(' ')[0] ?? 'vous';

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={serviceMode === 'delivery' ? filteredStores : []}
        keyExtractor={(s: import('@/src/types').StoreSummary) => s.id}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            onPress={() => router.push(`/(client)/store/${item.id}`)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchHome(true);
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Top bar */}
            <View style={styles.topBar}>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={16} color={Colors.primary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  Les Berges du Lac, Tunis
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
              </View>
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => router.push('/(client)/notifications')}
              >
                <Ionicons name="notifications-outline" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Greeting */}
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>
                Bonjour, {headerName} 👋
              </Text>
            </View>

            {/* Search */}
            <TouchableOpacity
              style={styles.searchBar}
              onPress={() => router.push('/(client)/search')}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.searchPlaceholder}>
                Restaurants, plats, épicerie...
              </Text>
            </TouchableOpacity>

            {/* Service toggle */}
            <ServiceToggle mode={serviceMode} onChange={setServiceMode} />

            {serviceMode === 'rides' ? (
              <RidesHomeSection />
            ) : (
              <>
                {/* Quick services */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickRow}
                >
                  {QUICK_SERVICES.map((svc) => (
                    <TouchableOpacity
                      key={svc.key}
                      style={styles.quickItem}
                      onPress={() => {
                        if (svc.mode === 'rides') setServiceMode('rides');
                      }}
                    >
                      <View style={styles.quickIcon}>
                        <Ionicons name={svc.icon} size={22} color={Colors.primary} />
                      </View>
                      <Text style={styles.quickLabel}>{svc.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Promo banner */}
                <TouchableOpacity
                  style={[styles.promoBanner, { backgroundColor: PROMO_BANNERS[promoIndex].color }]}
                  activeOpacity={0.85}
                >
                  <View>
                    <Text style={styles.promoTitle}>{PROMO_BANNERS[promoIndex].title}</Text>
                    <Text style={styles.promoDesc}>{PROMO_BANNERS[promoIndex].desc}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                </TouchableOpacity>

                {/* Categories */}
                {home?.categories && home.categories.length > 0 && (
                  <CategoryPills
                    categories={home.categories}
                    selected={selectedCategory}
                    onSelect={setSelectedCategory}
                  />
                )}

                {/* Section title */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {selectedCategory === 'Tous' ? '🔥 Populaires près de vous' : `🍽 ${selectedCategory}`}
                  </Text>
                </View>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          serviceMode === 'delivery' ? (
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucun restaurant trouvé</Text>
              <Text style={styles.emptyText}>Essayez une autre catégorie ou recherche</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}

function RidesHomeSection() {
  return (
    <View style={styles.ridesSection}>
      {/* Where to */}
      <Text style={styles.whereToTitle}>Où allez-vous ?</Text>
      <TouchableOpacity
        style={styles.whereToInput}
        onPress={() => router.push('/(client)/ride/')}
        activeOpacity={0.85}
      >
        <View style={styles.whereToIcon}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        </View>
        <Text style={styles.whereToPlaceholder}>Entrez votre destination</Text>
      </TouchableOpacity>

      {/* Ride options */}
      <Text style={styles.optionsTitle}>Options de trajet</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rideOptionsRow}>
        {[
          { type: 'UBER_X', label: 'UberX', desc: 'Économique', icon: 'car-outline' as const, color: Colors.primary },
          { type: 'COMFORT', label: 'Confort', desc: 'Plus spacieux', icon: 'car-sport-outline' as const, color: '#6C63FF' },
          { type: 'BLACK', label: 'Premium', desc: 'Luxe', icon: 'car-sport-outline' as const, color: '#1A1A1A' },
          { type: 'XL', label: 'XL', desc: 'Pour 6', icon: 'bus-outline' as const, color: '#F5A623' },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.type}
            style={styles.rideOptionCard}
            onPress={() => router.push('/(client)/ride/')}
            activeOpacity={0.85}
          >
            <View style={[styles.rideOptionIcon, { backgroundColor: opt.color + '20' }]}>
              <Ionicons name={opt.icon} size={24} color={opt.color} />
            </View>
            <Text style={styles.rideOptionLabel}>{opt.label}</Text>
            <Text style={styles.rideOptionDesc}>{opt.desc}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: Fonts.brand, fontSize: 15, color: Colors.textSecondary },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.white,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationText: {
    fontFamily: Fonts.brandMedium,
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  notifBtn: { padding: 6 },

  greetingRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  greeting: {
    fontFamily: Fonts.brandBlack,
    fontSize: 22,
    color: Colors.text,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.backgroundGray,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchPlaceholder: {
    fontFamily: Fonts.brand,
    fontSize: 15,
    color: Colors.textMuted,
  },

  quickRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 12,
  },
  quickItem: { alignItems: 'center', gap: 6 },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontFamily: Fonts.brandMedium,
    fontSize: 12,
    color: Colors.text,
  },

  promoBanner: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promoTitle: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.white },
  promoDesc: { fontFamily: Fonts.brand, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: Fonts.brandBold,
    fontSize: 18,
    color: Colors.text,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary },

  ridesSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  whereToTitle: {
    fontFamily: Fonts.brandBlack,
    fontSize: 22,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  whereToInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundGray,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    gap: 10,
  },
  whereToIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.small,
  },
  whereToPlaceholder: { fontFamily: Fonts.brand, fontSize: 15, color: Colors.textMuted },
  optionsTitle: {
    fontFamily: Fonts.brandBold,
    fontSize: 16,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  rideOptionsRow: { gap: 12, paddingBottom: Spacing.md },
  rideOptionCard: {
    width: 110,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.small,
  },
  rideOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideOptionLabel: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.text },
  rideOptionDesc: { fontFamily: Fonts.brand, fontSize: 11, color: Colors.textMuted },
});
