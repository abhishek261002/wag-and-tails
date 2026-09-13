import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radii } from '@wag/design-tokens';
import { Icon, type IconName } from './Icon';

export type RowItemIconTone = 'brand' | 'accent' | 'ok' | 'danger';

const TONE_BG: Record<RowItemIconTone, string> = {
  brand: colors.biscuitLighter,
  accent: colors.marigoldBg,
  ok: colors.successLight,
  danger: colors.errorLight,
};
const TONE_COLOR: Record<RowItemIconTone, string> = {
  brand: colors.brandBrown,
  accent: colors.marigoldDark,
  ok: colors.success,
  danger: colors.error,
};

export interface RowItemProps {
  icon?: IconName;
  iconTone?: RowItemIconTone;
  title: string;
  sub?: string;
  value?: string;
  chevron?: boolean;
  onPress?: () => void;
}

// Mirrors the prototype's .rowitem — a 38px tinted icon square, title +
// optional subtitle, an optional trailing value, and a chevron. Used
// throughout account/menu screens on both apps.
export function RowItem({ icon, iconTone = 'brand', title, sub, value, chevron = true, onPress }: RowItemProps) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.row} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={title}>
      {icon && (
        <View style={[styles.iconBox, { backgroundColor: TONE_BG[iconTone] }]}>
          <Icon name={icon} size={19} color={TONE_COLOR[iconTone]} />
        </View>
      )}
      <View style={styles.grow}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {sub && <Text style={styles.sub} numberOfLines={2}>{sub}</Text>}
      </View>
      {value && <Text style={styles.value}>{value}</Text>}
      {onPress && chevron && <Icon name="chev" size={17} color={colors.textDisabled} />}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[4], backgroundColor: colors.white },
  iconBox: { width: 38, height: 38, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'Inter', fontSize: 14.5, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.1 },
  sub: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 16.8 },
  value: { fontFamily: 'Inter', fontSize: 13.5, fontWeight: '600', color: colors.textMuted },
});
