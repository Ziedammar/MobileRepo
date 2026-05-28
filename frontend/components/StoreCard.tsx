import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadow, Fonts, Spacing } from '@/constants/theme';
import type { StoreSummary } from '@/src/types';

type Props = {
  store: StoreSummary;
  onPress: () => void;
};

export function StoreCard({ store, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: store.imageUrl || 'https://via.placeholder.com/400x200' }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.deliveryBadge}>
          <Text style={styles.deliveryText}>{store.etaMinutes} min</Text>
        </View>
      </View>
      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{store.name}</Text>
          <View style={styles.ratingWrap}>
            <Ionicons name="star" size={12} color="#F5A623" />
            <Text style={styles.rating}>{store.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.category}>{store.category}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {store.deliveryFee === 0 ? 'Livraison gratuite' : `${store.deliveryFee.toFixed(2)} DT livraison`}
          </Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.metaText}>{store.etaMinutes}–{store.etaMinutes + 10} min</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.small,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 170,
  },
  deliveryBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...Shadow.small,
  },
  deliveryText: {
    fontFamily: Fonts.brandBold,
    fontSize: 12,
    color: Colors.text,
  },
  info: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  name: {
    fontFamily: Fonts.brandBold,
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    fontFamily: Fonts.brandMedium,
    fontSize: 13,
    color: Colors.text,
  },
  category: {
    fontFamily: Fonts.brand,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: Fonts.brand,
    fontSize: 12,
    color: Colors.textMuted,
  },
  dot: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
