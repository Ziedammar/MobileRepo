import React, { useEffect, useState } from 'react';
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
import { api } from '@/src/api';
import { useAuthStore } from '@/store/auth';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { RideOption, RideOptionsResponse, PaymentMethodType } from '@/src/types';

const SERVICE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  UBER_X: 'car-outline',
  COMFORT: 'car-sport-outline',
  BLACK: 'car-sport',
  XL: 'bus-outline',
};

const PAYMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  CARD: 'card-outline',
  CASH: 'cash-outline',
  APPLE_PAY: 'logo-apple',
  GOOGLE_PAY: 'logo-google',
};

export default function RideOptionsScreen() {
  const params = useLocalSearchParams<{
    destTitle: string;
    destAddress: string;
    destLat: string;
    destLng: string;
    pickupLat: string;
    pickupLng: string;
    pickupAddress: string;
  }>();

  const [optionsData, setOptionsData] = useState<RideOptionsResponse | null>(null);
  const [selectedOption, setSelectedOption] = useState<RideOption | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethodType>('CARD');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const data = await api.getRideOptions({
          pickupLat: parseFloat(params.pickupLat ?? '36.8065'),
          pickupLng: parseFloat(params.pickupLng ?? '10.1815'),
          destinationLat: parseFloat(params.destLat ?? '36.8'),
          destinationLng: parseFloat(params.destLng ?? '10.18'),
        });
        setOptionsData(data);
        if (data.options.length > 0) setSelectedOption(data.options[0]);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchOptions();
  }, []);

  const handleBook = async () => {
    if (!selectedOption) return;
    if (!token) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour réserver un trajet.');
      return;
    }
    setBooking(true);
    try {
      const ride = await api.createRide({
        pickupAddress: params.pickupAddress ?? 'Ma position',
        pickupLat: parseFloat(params.pickupLat ?? '36.8065'),
        pickupLng: parseFloat(params.pickupLng ?? '10.1815'),
        destinationAddress: params.destAddress ?? params.destTitle ?? '',
        destinationLat: parseFloat(params.destLat ?? '36.8'),
        destinationLng: parseFloat(params.destLng ?? '10.18'),
        serviceType: selectedOption.serviceType,
        paymentMethodType: selectedPayment,
        promoCode: promoCode || undefined,
      });
      router.replace({
        pathname: '/(client)/ride/tracking',
        params: { rideId: ride.id },
      });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Réservation échouée');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Calcul des tarifs...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choisir une option</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Route summary */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.routeText} numberOfLines={1}>{params.pickupAddress ?? 'Départ'}</Text>
          </View>
          <View style={styles.routeDashedLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.routeText} numberOfLines={1}>{params.destTitle ?? params.destAddress}</Text>
          </View>
          {optionsData && (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.distanceText}>{optionsData.distanceKm.toFixed(1)} km</Text>
            </View>
          )}
        </View>

        {/* Ride options */}
        <Text style={styles.sectionTitle}>Options disponibles</Text>
        {(optionsData?.options ?? []).map((opt) => (
          <TouchableOpacity
            key={opt.serviceType}
            style={[styles.optionCard, selectedOption?.serviceType === opt.serviceType && styles.optionCardActive]}
            onPress={() => setSelectedOption(opt)}
            activeOpacity={0.85}
          >
            <View style={[styles.optionIcon, selectedOption?.serviceType === opt.serviceType && styles.optionIconActive]}>
              <Ionicons
                name={SERVICE_ICONS[opt.serviceType] ?? 'car-outline'}
                size={24}
                color={selectedOption?.serviceType === opt.serviceType ? Colors.white : Colors.textSecondary}
              />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionLabel, selectedOption?.serviceType === opt.serviceType && styles.optionLabelActive]}>
                {opt.label}
              </Text>
              <View style={styles.optionMeta}>
                <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.optionMetaText}>{opt.etaMinutes} min</Text>
                <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.optionMetaText}>{opt.seats} places</Text>
              </View>
            </View>
            <Text style={[styles.optionPrice, selectedOption?.serviceType === opt.serviceType && styles.optionPriceActive]}>
              {opt.estimatedPrice.toFixed(2)} DT
            </Text>
          </TouchableOpacity>
        ))}

        {/* Payment method */}
        {optionsData?.paymentMethods && optionsData.paymentMethods.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Paiement</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paymentRow}>
              {optionsData.paymentMethods.map((pm) => (
                <TouchableOpacity
                  key={pm}
                  style={[styles.paymentCard, selectedPayment === pm && styles.paymentCardActive]}
                  onPress={() => setSelectedPayment(pm)}
                >
                  <Ionicons
                    name={PAYMENT_ICONS[pm] ?? 'card-outline'}
                    size={20}
                    color={selectedPayment === pm ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.paymentLabel, selectedPayment === pm && styles.paymentLabelActive]}>
                    {pm}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {selectedOption && (
        <View style={styles.bookWrap}>
          <View style={styles.bookInfo}>
            <Text style={styles.bookLabel}>{selectedOption.label}</Text>
            <Text style={styles.bookPrice}>{selectedOption.estimatedPrice.toFixed(2)} DT</Text>
          </View>
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={handleBook}
            disabled={booking}
            activeOpacity={0.85}
          >
            {booking ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.bookBtnText}>Réserver</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundGray },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: Fonts.brand, fontSize: 15, color: Colors.textSecondary },
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

  scroll: { padding: Spacing.lg, gap: 12 },

  routeCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { flex: 1, fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  routeDashedLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 4,
    marginVertical: 4,
    borderStyle: 'dashed',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  distanceText: { fontFamily: Fonts.brandMedium, fontSize: 13, color: Colors.textMuted },

  sectionTitle: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text, marginTop: 4 },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: { backgroundColor: Colors.primary },
  optionInfo: { flex: 1 },
  optionLabel: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  optionLabelActive: { color: Colors.primaryDark },
  optionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  optionMetaText: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textMuted, marginRight: 4 },
  optionPrice: { fontFamily: Fonts.brandBlack, fontSize: 18, color: Colors.text },
  optionPriceActive: { color: Colors.primary },

  paymentRow: { gap: 8, paddingVertical: 4 },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  paymentCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  paymentLabel: { fontFamily: Fonts.brandMedium, fontSize: 13, color: Colors.textSecondary },
  paymentLabelActive: { color: Colors.primary },

  bookWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
    ...Shadow.large,
  },
  bookInfo: { flex: 1 },
  bookLabel: { fontFamily: Fonts.brandMedium, fontSize: 13, color: Colors.textSecondary },
  bookPrice: { fontFamily: Fonts.brandBlack, fontSize: 20, color: Colors.text },
  bookBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  bookBtnText: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.white },
});
