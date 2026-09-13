import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@wag/design-tokens';
import { Icon, type IconName } from './Icon';

export interface TabBarIconProps {
  name: IconName;
  label: string;
  focused: boolean;
}

// Mirrors the prototype's .tab / .tab__icon / .tab__pip / .tab__label rules:
// the active tab switches to the filled icon variant, turns brand brown,
// bolds its label and reveals a marigold pip above the glyph.
export function TabBarIcon({ name, label, focused }: TabBarIconProps) {
  const color = focused ? colors.brandBrown : colors.textDisabled;
  return (
    <View style={styles.tab}>
      <View style={styles.iconBox}>
        {focused && <View style={styles.pip} />}
        <Icon name={name} size={22} color={color} variant={focused ? 'fill' : 'stroke'} />
      </View>
      <Text style={[styles.label, { color }, focused && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Shared by both apps' Tabs screenOptions so the bar itself matches too.
export const tabBarStyle = {
  backgroundColor: 'rgba(255,255,255,0.94)',
  borderTopColor: colors.borderLight,
  borderTopWidth: 1,
  height: 66,
  paddingTop: 8,
  paddingBottom: 12,
} as const;

const styles = StyleSheet.create({
  tab: { alignItems: 'center', gap: 5, paddingVertical: 4, width: 64 },
  iconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  pip: {
    position: 'absolute',
    top: -7,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.marigold,
  },
  label: { fontFamily: 'Inter', fontSize: 10.5, fontWeight: '600', letterSpacing: 0.1 },
  labelActive: { fontWeight: '700' },
});
