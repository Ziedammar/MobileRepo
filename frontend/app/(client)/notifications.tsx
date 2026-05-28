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
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import type { NotificationsResponse } from '@/src/types';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  DRIVER_ARRIVED: 'car-outline',
  PROMOTION: 'pricetag-outline',
  RIDE_STATUS: 'navigate-outline',
  SYSTEM: 'information-circle-outline',
};

const TYPE_COLORS: Record<string, string> = {
  DRIVER_ARRIVED: Colors.success,
  PROMOTION: Colors.warning,
  RIDE_STATUS: Colors.primary,
  SYSTEM: Colors.textSecondary,
};

export default function NotificationsScreen() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getNotifications().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              unread: Math.max(0, prev.unread - 1),
              items: prev.items.map((n) =>
                n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
              ),
            }
          : prev,
      );
    } catch {
      //
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {data && data.unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{data.unread}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifRow, !item.readAt && styles.unread]}
              onPress={() => !item.readAt && markRead(item.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: (TYPE_COLORS[item.type] ?? Colors.primary) + '20' }]}>
                <Ionicons
                  name={TYPE_ICONS[item.type] ?? 'notifications-outline'}
                  size={20}
                  color={TYPE_COLORS[item.type] ?? Colors.primary}
                />
              </View>
              <View style={styles.notifInfo}>
                <Text style={[styles.notifTitle, !item.readAt && styles.unreadText]}>{item.title}</Text>
                <Text style={styles.notifBody}>{item.body}</Text>
                <Text style={styles.notifDate}>
                  {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              {!item.readAt && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerTitle: { flex: 1, fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },
  badge: {
    backgroundColor: Colors.error,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: Fonts.brandBold, fontSize: 11, color: Colors.white },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  unread: { backgroundColor: Colors.primaryLight + '40' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifInfo: { flex: 1 },
  notifTitle: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  unreadText: { fontFamily: Fonts.brandBold, color: Colors.text },
  notifBody: { fontFamily: Fonts.brand, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  notifDate: { fontFamily: Fonts.brand, fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: Fonts.brandBold, fontSize: 16, color: Colors.text },
});
