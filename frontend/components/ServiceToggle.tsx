import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Fonts, Spacing } from '@/constants/theme';

type ServiceMode = 'delivery' | 'rides';

type Props = {
  mode: ServiceMode;
  onChange: (mode: ServiceMode) => void;
};

export function ServiceToggle({ mode, onChange }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.tab, mode === 'delivery' && styles.tabActive]}
        onPress={() => onChange('delivery')}
        activeOpacity={0.8}
      >
        <Ionicons
          name="restaurant-outline"
          size={16}
          color={mode === 'delivery' ? Colors.primary : Colors.textSecondary}
        />
        <Text style={[styles.tabText, mode === 'delivery' && styles.tabTextActive]}>
          Livraison
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, mode === 'rides' && styles.tabActive]}
        onPress={() => onChange('rides')}
        activeOpacity={0.8}
      >
        <Ionicons
          name="car-outline"
          size={16}
          color={mode === 'rides' ? Colors.primary : Colors.textSecondary}
        />
        <Text style={[styles.tabText, mode === 'rides' && styles.tabTextActive]}>
          Trajets
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundGray,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  tabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontFamily: Fonts.brandMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
});
