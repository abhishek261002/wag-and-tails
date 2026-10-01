import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { useAuthStore } from '../../src/store/auth.store';
import { wagApi } from '../../src/lib/api';

const SUPPORT_PHONE = '+911234567890';

export default function PendingApprovalScreen() {
  const { clearTokens } = useAuthStore();
  const [missingPhotos, setMissingPhotos] = useState(0);

  // A groomer who has not added enough tool photos cannot be approved: remind them here.
  useFocusEffect(useCallback(() => {
    wagApi.partner.tools()
      .then((t) => setMissingPhotos(t.required ? Math.max(0, t.rules.minPhotos - t.counts.photos) : 0))
      .catch(() => {});
  }, []));

  const handleContactSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {
      Alert.alert('Contact support', `Call us at ${SUPPORT_PHONE}`);
    });
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await clearTokens(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Icon name="clock" size={44} color={colors.marigoldDark} />
        </View>
        <Text style={styles.title}>Application under review</Text>
        <Text style={styles.sub}>
          Thanks for signing up! Our team is reviewing your details. You'll be able to start
          taking jobs as soon as you're approved — this usually takes 1-2 business days.
        </Text>

        {missingPhotos > 0 && (
          <View style={[styles.card, styles.warnCard]}>
            <Text style={styles.cardTitle}>One more step: show us your tools</Text>
            <Text style={styles.cardText}>We cannot approve your application until you add {missingPhotos} more photo{missingPhotos === 1 ? '' : 's'} of the grooming tools you will use.</Text>
            <Button onPress={() => router.push('/account/tools?onboarding=1' as any)} fullWidth style={{ marginTop: spacing[3] }}>Add tool photos</Button>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Need this sped up?</Text>
          <Text style={styles.cardText}>Contact our support team and we'll help you out.</Text>
          <Button
            variant="outline"
            onPress={handleContactSupport}
            fullWidth
            leftIcon={<Icon name="phone" size={16} color={colors.brandBrown} />}
            style={{ marginTop: spacing[3] }}
          >
            Contact staff
          </Button>
        </View>

        <Text style={styles.logout} onPress={handleLogout}>Log out</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, paddingHorizontal: spacing[6], paddingTop: spacing[16], alignItems: 'center' },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[6] },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing[3] },
  sub: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing[8] },
  card: { width: '100%', backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[8] },
  cardTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[1] },
  cardText: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted },
  warnCard: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  logout: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, fontWeight: '600', textDecorationLine: 'underline' },
});
