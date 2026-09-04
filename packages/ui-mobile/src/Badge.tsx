import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '@wag/design-tokens';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'marigold';

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: colors.biscuitLight, text: colors.brandBrown },
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
  error: { bg: colors.errorLight, text: colors.error },
  info: { bg: colors.infoLight, text: colors.info },
  marigold: { bg: colors.marigoldBg, text: colors.marigoldDark },
};

export function Badge({
  variant = 'default',
  label,
}: {
  variant?: BadgeVariant;
  label: string;
}) {
  const vs = variantStyles[variant];
  return (
    <View style={[styles.container, { backgroundColor: vs.bg }]}>
      <Text style={[styles.text, { color: vs.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
