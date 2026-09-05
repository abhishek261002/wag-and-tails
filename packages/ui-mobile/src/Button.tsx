import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors, radii, spacing } from '@wag/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

const variantContainerStyle: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.brandBrown },
  secondary: { backgroundColor: colors.marigold },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.brandBrown,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.error },
  destructive: { backgroundColor: colors.error },
};

const variantTextStyle: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.white },
  secondary: { color: colors.white },
  outline: { color: colors.brandBrown },
  ghost: { color: colors.brandBrown },
  danger: { color: colors.white },
  destructive: { color: colors.white },
};

const sizePadding: Record<ButtonSize, ViewStyle> = {
  sm: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] - 2, borderRadius: radii.sm },
  md: { paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderRadius: radii.md },
  lg: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4] - 2,
    borderRadius: radii.md,
  },
};

const sizeFontSize: Record<ButtonSize, number> = {
  sm: 13,
  md: 15,
  lg: 17,
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  onPress,
  children,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        variantContainerStyle[variant],
        sizePadding[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.brandBrown : colors.white}
        />
      ) : (
        leftIcon && <View style={styles.icon}>{leftIcon}</View>
      )}
      <Text
        style={[
          styles.text,
          variantTextStyle[variant],
          { fontSize: sizeFontSize[size] },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {children as string}
      </Text>
      {!loading && rightIcon && <View style={styles.icon}>{rightIcon}</View>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  icon: {
    flexShrink: 0,
  },
});
