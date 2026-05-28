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
import { api, getOrderWsUrl } from '@/src/api';
import { useAuthStore } from '@/store/auth';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { OrderDetails, TrackingResponse } from '@/src/types';

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Commande reçue', icon: 'receipt-outline' as const },
  { key: 'ACCEPTED', label: 'Acceptée par le restaurant', icon: 'checkmark-circle-outline' as const },
  { key: 'PREPARING', label: 'En préparation', icon: 'restaurant-outline' as const },
  { key: 'READY', label: 'Prête pour livraison', icon: 'bag-check-outline' as const },
  { key: 'PICKED_UP', label: 'Livreur en route', icon: 'bicycle-outline' as const },
  { key: 'ON_THE_WAY', label: 'En cours de livraison', icon: 'navigate-outline' as const },
  { key: 'DELIVERED', label: 'Livré !', icon: 'home-outline' as const },
];

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const [o, t] = await Promise.all([api.getOrder(id), api.getTracking(id).catch(() => null)]);
      setOrder(o);
      if (t) setTracking(t);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (!id || !token) return;
    const url = getOrderWsUrl(id, token);
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = () => fetchOrder();
      ws.onerror = () => {};
      return () => ws.close();
    } catch {
      return undefined;
    }
  }, [id, token, fetchOrder]);

  const handleCancel = () => {
    Alert.alert('Annuler la commande', 'Voulez-vous vraiment annuler ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.cancelOrder(id!);
            fetchOrder();
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

  if (!order) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.errorText}>Commande introuvable</Text>
      </SafeAreaView>
    );
  }

  const currentStep = getStepIndex(order.status);
  const isActive = !['DELIVERED', 'REFUSED', 'CANCELLED'].includes(order.status);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suivi de commande</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ETA card */}
        {isActive && (
          <View style={styles.etaCard}>
            <View style={styles.etaLeft}>
              <Text style={styles.etaTime}>{order.etaMinutes} min</Text>
              <Text style={styles.etaLabel}>Temps estimé</Text>
            </View>
            <View style={styles.etaRight}>
              <Ionicons name="bicycle" size={36} color={Colors.primary} />
            </View>
          </View>
        )}

        {/* Status timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionTitle}>Statut de la commande</Text>
          {STATUS_STEPS.map((step, idx) => {
            const done = idx <= currentStep;
            const current = idx === currentStep;
            return (
              <View key={step.key} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    done && styles.timelineDotDone,
                    current && styles.timelineDotCurrent,
                  ]}>
                    <Ionicons
                      name={done ? 'checkmark' : step.icon}
                      size={14}
                      color={done ? Colors.white : Colors.textMuted}
                    />
                  </View>
                  {idx < STATUS_STEPS.length - 1 && (
                    <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
                  )}
                </View>
                <Text style={[
                  styles.timelineLabel,
                  done && styles.timelineLabelDone,
                  current && styles.timelineLabelCurrent,
                ]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Courier info */}
        {order.courier && (
          <View style={styles.courierCard}>
            <View style={styles.courierAvatar}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={styles.courierInfo}>
              <Text style={styles.courierName}>{order.courier.name}</Text>
              <Text style={styles.courierVehicle}>{order.courier.vehicle}</Text>
              <View style={styles.courierRating}>
                <Ionicons name="star" size={12} color="#F5A623" />
                <Text style={styles.courierRatingText}>{order.courier.rating.toFixed(1)}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.callBtn}>
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Order items */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Articles</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}×</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemPrice}>{item.lineTotal.toFixed(2)} DT</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{order.totals.total.toFixed(2)} DT</Text>
          </View>
        </View>

        {/* Cancel button */}
        {isActive && order.status === 'PENDING' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Annuler la commande</Text>
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

  etaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  etaLeft: {},
  etaTime: { fontFamily: Fonts.brandBlack, fontSize: 36, color: Colors.white },
  etaLabel: { fontFamily: Fonts.brandMedium, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  etaRight: {},

  timelineCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text, marginBottom: Spacing.md },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  timelineLeft: { alignItems: 'center', marginRight: 12 },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.backgroundGray,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  timelineDotCurrent: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timelineLine: { width: 2, height: 20, backgroundColor: Colors.border, marginVertical: 2 },
  timelineLineDone: { backgroundColor: Colors.success },
  timelineLabel: {
    fontFamily: Fonts.brand,
    fontSize: 13,
    color: Colors.textMuted,
    paddingTop: 5,
    flex: 1,
    marginBottom: 20,
  },
  timelineLabelDone: { color: Colors.text },
  timelineLabelCurrent: { fontFamily: Fonts.brandBold, color: Colors.primary },

  courierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  courierAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierInfo: { flex: 1 },
  courierName: { fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  courierVehicle: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary },
  courierRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  courierRatingText: { fontFamily: Fonts.brandMedium, fontSize: 12, color: Colors.text },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemQty: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.primary, width: 24 },
  itemName: { flex: 1, fontFamily: Fonts.brand, fontSize: 13, color: Colors.text },
  itemPrice: { fontFamily: Fonts.brandMedium, fontSize: 13, color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  totalLabel: { flex: 1, fontFamily: Fonts.brandBold, fontSize: 15, color: Colors.text },
  totalValue: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.primary },

  cancelBtn: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.error,
    alignItems: 'center',
  },
  cancelText: { fontFamily: Fonts.brandBold, fontSize: 14, color: Colors.error },
});
