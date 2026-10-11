import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, radii } from '@wag/design-tokens';

/**
 * Shown by Expo Router when a screen throws while rendering. Without it a release build simply closes the app.
 * The customer sees a calm message and can retry; the technical detail only shows in development.
 */
export function AppErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>🐾</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>This screen couldn't load. Please try again. If it keeps happening, restart the app.</Text>
      {__DEV__ && <Text style={styles.detail} selectable>{String(error?.message ?? error)}</Text>}
      <TouchableOpacity style={styles.btn} onPress={() => { retry().catch(() => {}); }} accessibilityRole="button" accessibilityLabel="Try again">
        <Text style={styles.btnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], backgroundColor: colors.canvas },
  emoji: { fontSize: 44, marginBottom: spacing[3] },
  title: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  body: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2], lineHeight: 20 },
  detail: { fontFamily: 'Inter', fontSize: 12, color: colors.error, textAlign: 'center', marginTop: spacing[4] },
  btn: { marginTop: spacing[6], backgroundColor: colors.brandBrown, borderRadius: radii.lg, height: 48, paddingHorizontal: spacing[8], alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.white },
});
