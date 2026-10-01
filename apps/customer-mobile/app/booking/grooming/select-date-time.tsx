import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { format } from 'date-fns';
import { useBookingStore } from '../../../src/store/booking.store';
import { SlotPicker } from '../../../src/components/SlotPicker';
import { goBack } from '../../../src/lib/nav';

// Today is bookable: only slots that start at least 30 minutes from now are offered (rule shared with the API).
export default function SelectDateTimeScreen() {
  const { updateGroomingDraft } = useBookingStore();
  const [when, setWhen] = useState<Date | null>(null);

  const handleContinue = () => {
    if (!when) return;
    updateGroomingDraft({ scheduledAt: when.toISOString() });
    router.push('/booking/grooming/select-address');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pick a Date & Time</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SlotPicker onChange={setWhen} />

        {when && (
          <View style={[styles.confirmBox, { flexDirection: 'row', alignItems: 'center', gap: spacing[2] }]}>
            <Icon name="cal" size={15} color={colors.brandBrown} />
            <Text style={styles.confirmText}>{format(when, 'EEEE, d MMMM · h:mm a')}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={handleContinue} fullWidth disabled={!when}>Continue →</Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  confirmBox: { marginTop: spacing[5], backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4] },
  confirmText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.marigoldDark, textAlign: 'center' },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
