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

/**
 * Matches the prototype's .btn variants exactly (styles.css):
 * primary = solid brand brown, accent = solid marigold, secondary =
 * light brand tint with a border, outline = transparent with a
 * neutral border, ghost/quiet = sunken tint, danger = a soft red
 * tint (never a loud solid red — the prototype never uses one).
 */
export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'destructive';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

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
  accent: { backgroundColor: colors.marigoldMid },
  secondary: {
    backgroundColor: colors.biscuitLighter,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.borderMedium,
  },
  ghost: { backgroundColor: colors.surfaceAlt },
  danger: { backgroundColor: colors.errorLight },
  destructive: { backgroundColor: colors.errorLight },
};

const variantTextStyle: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.white },
  accent: { color: colors.white },
  secondary: { color: colors.brandBrown },
  outline: { color: colors.textPrimary },
  ghost: { color: colors.textPrimary },
  danger: { color: colors.error },
  destructive: { color: colors.error },
};

const sizeStyle: Record<ButtonSize, ViewStyle> = {
  xs: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radii.xs, minHeight: 34 },
  sm: { paddingHorizontal: spacing[4], paddingVertical: 10, borderRadius: radii.sm, minHeight: 40 },
  md: { paddingHorizontal: spacing[5], paddingVertical: spacing[3] + 2, borderRadius: radii.md, minHeight: 52 },
  lg: { paddingHorizontal: spacing[6], paddingVertical: spacing[4], borderRadius: radii.md, minHeight: 56 },
};

const sizeFontSize: Record<ButtonSize, number> = {
  xs: 12.5,
  sm: 13.5,
  md: 15,
  lg: 16,
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
        sizeStyle[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'outline' || variant === 'ghost' || variant === 'secondary'
              ? colors.brandBrown
              : variant === 'danger' || variant === 'destructive'
                ? colors.error
                : colors.white
          }
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
    letterSpacing: -0.1,
  },
  icon: {
    flexShrink: 0,
  },
});
