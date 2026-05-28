import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Colors, BorderRadius, Fonts } from '@/constants/theme';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'gray';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
};

export function Badge({ label, variant = 'primary', style }: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      <Text style={[styles.text, styles[`text_${variant}`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: Fonts.brandBold,
    fontSize: 11,
  },
  primary: { backgroundColor: Colors.primaryLight },
  success: { backgroundColor: Colors.successLight },
  warning: { backgroundColor: Colors.warningLight },
  error: { backgroundColor: Colors.errorLight },
  gray: { backgroundColor: Colors.backgroundGray },
  text_primary: { color: Colors.primary },
  text_success: { color: Colors.success },
  text_warning: { color: Colors.warning },
  text_error: { color: Colors.error },
  text_gray: { color: Colors.textSecondary },
});
