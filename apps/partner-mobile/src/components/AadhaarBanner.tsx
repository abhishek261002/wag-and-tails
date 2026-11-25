import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../lib/api';

/** Partners who were verified before Aadhaar details were kept are asked once. Work is not blocked. */
export function AadhaarBanner() {
  const [missing, setMissing] = useState(false);
  useFocusEffect(useCallback(() => {
    wagApi.partner.aadhaarStatus().then((a) => setMissing(!a.done)).catch(() => {});
  }, []));
  if (!missing) return null;
  return (
    <TouchableOpacity style={styles.box} onPress={() => router.push('/account/aadhaar' as any)} accessibilityRole="button">
      <Icon name="shield" size={20} color={colors.marigoldDark} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Add your Aadhaar details</Text>
        <Text style={styles.text}>Takes two minutes: your Aadhaar number and photos of the card. Tap to add.</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: spacing[3], alignItems: 'center', backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[3], marginBottom: spacing[3] },
  title: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  text: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted },
});
