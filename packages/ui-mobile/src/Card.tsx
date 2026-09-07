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
  // The prototype's default .card is flat (just a hairline border); only
  // the .card--pop / .card--lift variants (elevated=true here) get a shadow.
  const containerStyle: ViewStyle = {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: elevated ? 0 : 1,
    borderColor: colors.borderLight,
    padding: paddingMap[padding],
    ...(elevated
      ? {
          shadowColor: colors.brandBrown,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 5,
        }
      : null),
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
