import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors, Fonts, BorderRadius, Spacing } from '@/constants/theme';

type Props = {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
};

export function CategoryPills({ categories, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {['Tous', ...categories].map((cat) => (
        <TouchableOpacity
          key={cat}
          style={[styles.pill, selected === cat && styles.pillActive]}
          onPress={() => onSelect(cat)}
          activeOpacity={0.8}
        >
          <Text style={[styles.pillText, selected === cat && styles.pillTextActive]}>
            {cat}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundGray,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  pillText: {
    fontFamily: Fonts.brandMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.primary,
  },
});
