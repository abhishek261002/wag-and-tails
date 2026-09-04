import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@wag/design-tokens';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevated?: boolean;
}

const paddingMap = {
  none: 0,
  sm: spacing[3],
  md: spacing[4],
  lg: spacing[6],
};

export function Card({ children, style, onPress, padding = 'md', elevated = false }: CardProps) {
  const containerStyle: ViewStyle = {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: paddingMap[padding],
    shadowColor: colors.brandBrown,
    shadowOffset: { width: 0, height: elevated ? 4 : 2 },
    shadowOpacity: elevated ? 0.12 : 0.07,
    shadowRadius: elevated ? 12 : 6,
    elevation: elevated ? 6 : 2,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[containerStyle, style]}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
}
