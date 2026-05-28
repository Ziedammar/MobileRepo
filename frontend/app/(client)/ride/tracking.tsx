import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { api, getRideWsUrl } from '@/src/api';
import { useAuthStore } from '@/store/auth';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { Ride, RideTrackingResponse } from '@/src/types';

const STATUS_LABELS: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  PENDING: { label: 'En attente d\'un chauffeur...', color: Colors.warning, icon: 'time-outline' },
  ACCEPTED: { label: 'Chauffeur en route vers vous', color: Colors.primary, icon: 'car-outline' },
  ONGOING: { label: 'Trajet en cours', color: Colors.success, icon: 'navigate-outline' },
  COMPLETED: { label: 'Trajet terminé !', color: Colors.success, icon: 'checkmark-circle-outline' },
  CANCELLED: { label: 'Trajet annulé', color: Colors.error, icon: 'close-circle-outline' },
};

export default function RideTrackingScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const [ride, setRide] = useState<Ride | null>(null);
  const [tracking, setTracking] = useState<RideTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [ratedSent, setRatedSent] = useState(false);
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchRide = useCallback(async () => {
    if (!rideId) return;
    try {
      const [r, t] = await Promise.all([
        api.getRide(rideId),
        api.getRideTracking(rideId).catch(() => null),
      ]);
      setRide(r);
      if (t) setTracking(t);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    fetchRide();
  }, [fetchRide]);

  useEffect(() => {
    if (!rideId || !token) return;
    try {
      const ws = new WebSocket(getRideWsUrl(rideId, token));
      wsRef.current = ws;
      ws.onmessage = () => fetchRide();
      ws.onerror = () => {};
      return () => ws.close();
    } catch {
      return undefined;
    }
  }, [rideId, token, fetchRide]);

  const handleCancel = () => {
    Alert.alert('Annuler le trajet', 'Voulez-vous vraiment annuler ce trajet ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Annuler',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.cancelRide(rideId!, 'Annulé par le passager');
            fetchRide();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Annulation échouée');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.errorText}>Trajet introuvable</Text>
      </SafeAreaView>
    );
  }

  const statusInfo = STATUS_LABELS[ride.status] ?? STATUS_LABELS.PENDING;
  const isCompleted = ride.status === 'COMPLETED';
  const isCancelled = ride.status === 'CANCELLED';
  const isActive = !isCompleted && !isCancelled;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(client)/')}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Votre trajet</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status card */}
        <View style={[styles.statusCard, { borderLeftColor: statusInfo.color, borderLeftWidth: 4 }]}>
          <Ionicons name={statusInfo.icon} size={28} color={statusInfo.color} />
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>{statusInfo.label}</Text>
            {isActive && (
              <Text style={styles.etaText}>{ride.etaMinutes} min estimé</Text>
            )}
          </View>
        </View>

        {/* Map placeholder */}
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={48} color={Colors.border} />
          <Text style={styles.mapText}>Carte de suivi en temps réel</Text>
          {tracking && (
            <Text style={styles.coordText}>
              Pos: {tracking.position.lat.toFixed(4)}, {tracking.position.lng.toFixed(4)}
            </Text>
          )}
        </View>

        {/* Route info */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Départ</Text>
              <Text style={styles.routeAddr}>{ride.pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routeAddr}>{ride.destinationAddress}</Text>
            </View>
          </View>
        </View>

        {/* Driver info */}
        {ride.driverName && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{ride.driverName}</Text>
              {ride.vehicleLabel && <Text style={styles.driverVehicle}>{ride.vehicleLabel}</Text>}
              {ride.vehiclePlate && <Text style={styles.driverPlate}>{ride.vehiclePlate}</Text>}
            </View>
            <TouchableOpacity style={styles.callBtn}>
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.msgBtn}>
              <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Price info */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Distance</Text>
            <Text style={styles.priceValue}>{ride.distanceKm.toFixed(1)} km</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service</Text>
            <Text style={styles.priceValue}>{ride.serviceType}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Paiement</Text>
            <Text style={styles.priceValue}>{ride.paymentMethodType}</Text>
          </View>
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Prix estimé</Text>
            <Text style={styles.totalValue}>
              {(ride.finalPrice ?? ride.estimatedPrice).toFixed(2)} DT
            </Text>
          </View>
        </View>

        {/* Rating after completion */}
        {isCompleted && !ratedSent && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Notez votre trajet</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                  <Ionicons
                    name={s <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color="#F5A623"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.rateBtn}
              onPress={() => setRatedSent(true)}
            >
              <Text style={styles.rateBtnText}>Envoyer l'avis</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cancel button */}
        {isActive && ride.status === 'PENDING' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Annuler le trajet</Text>
          </TouchableOpacity>
        )}

        {(isCompleted || isCancelled) && (
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.push('/(client)/')}
          >
            <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
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

  scroll: { padding: Spacing.lg, gap: 16, paddingBottom: 40 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: 12,
    ...Shadow.small,
  },
  statusInfo: { flex: 1 },
  statusLabel: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  etaText: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  mapPlaceholder: {
    height: 200,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  mapText: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textMuted },
  coordText: { fontFamily: Fonts.brand, fontSize: 11, color: Colors.textMuted },

  routeCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  routeInfo: { flex: 1 },
  routeLabel: { fontFamily: Fonts.brand, fontSize: 11, color: Colors.textMuted },
  routeAddr: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  routeDivider: { width: 2, height: 16, backgroundColor: Colors.border, marginLeft: 5, marginVertical: 4 },

  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInfo: { flex: 1 },
  driverName: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  driverVehicle: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary },
  driverPlate: { fontFamily: Fonts.brandMedium, fontSize: 12, color: Colors.primary },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  msgBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },

  priceCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontFamily: Fonts.brand, fontSize: 14, color: Colors.textSecondary },
  priceValue: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 },
  totalLabel: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  totalValue: { fontFamily: Fonts.brandBlack, fontSize: 18, color: Colors.primary },

  ratingCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  ratingTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
  starsRow: { flexDirection: 'row', gap: 8 },
  rateBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    marginTop: 8,
  },
  rateBtnText: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.white },

  cancelBtn: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.error,
    alignItems: 'center',
  },
  cancelText: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.error },

  homeBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  homeBtnText: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.white },
});
