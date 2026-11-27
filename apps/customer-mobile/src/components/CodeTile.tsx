import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii } from '@wag/design-tokens';

/** The start / end code the customer reads out to the partner. One tile, so every screen shows it the same way. */
export function CodeTile({ kind, code, hint }: { kind: 'start' | 'end'; code: string; hint: string }) {
  return (
    <View style={[styles.card, kind === 'end' && styles.endCard]}>
      <Text style={styles.label}>{kind === 'start' ? 'Your start code' : 'Your end code'}</Text>
      <Text style={styles.value}>{code}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', backgroundColor: colors.brandBrown, borderRadius: radii.xl, padding: spacing[5], alignItems: 'center', marginBottom: spacing[4] },
  endCard: { backgroundColor: colors.success },
  label: { fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  value: { fontFamily: 'Inter', fontSize: 40, fontWeight: '800', color: colors.white, letterSpacing: 8, marginVertical: spacing[1] },
  hint: { fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
});
