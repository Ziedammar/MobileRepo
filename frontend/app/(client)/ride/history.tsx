import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import type { Ride } from '@/src/types';

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  ACCEPTED: Colors.primary,
  ONGOING: Colors.primary,
  COMPLETED: Colors.success,
  CANCELLED: Colors.error,
};

export default function RideHistoryScreen() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRideHistory().then(setRides).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historique des trajets</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={rides}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/(client)/ride/tracking', params: { rideId: item.id } })}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.iconWrap, { backgroundColor: (STATUS_COLORS[item.status] ?? Colors.primary) + '20' }]}>
                <Ionicons name="car-outline" size={22} color={STATUS_COLORS[item.status] ?? Colors.primary} />
              </View>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.destText} numberOfLines={1}>{item.destinationAddress}</Text>
              <Text style={styles.metaText}>
                {item.serviceType} • {item.distanceKm.toFixed(1)} km
              </Text>
              <Text style={styles.dateText}>
                {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.priceText}>{(item.finalPrice ?? item.estimatedPrice).toFixed(2)} DT</Text>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? Colors.primary) + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? Colors.primary }]}>
                  {item.status}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={56} color={Colors.border} />
            <Text style={styles.emptyTitle}>Aucun trajet</Text>
            <Text style={styles.emptyText}>Vos trajets apparaîtront ici</Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: Spacing.md }}
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
  headerTitle: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.small,
  },
  cardLeft: {},
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  destText: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.text },
  metaText: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  dateText: { fontFamily: Fonts.brand, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  priceText: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontFamily: Fonts.brandBold, fontSize: 10 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary },
});
