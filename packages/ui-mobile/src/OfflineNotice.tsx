import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';

export interface OfflineNoticeProps {
  visible: boolean;
}

// Floats above the tab bar and lets touches through, so it never blocks a button.
export function OfflineNotice({ visible }: OfflineNoticeProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 84 }]}>
      <View style={styles.pill} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={styles.text}>No internet connection. Some details may be missing.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing[4], right: spacing[4], alignItems: 'center', zIndex: 1000, elevation: 12 },
  pill: { backgroundColor: colors.textPrimary, borderRadius: radii.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2], elevation: 12 },
  text: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.white, textAlign: 'center' },
});
