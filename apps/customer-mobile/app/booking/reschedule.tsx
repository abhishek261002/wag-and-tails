import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { format } from 'date-fns';
import { SlotPicker } from '../../src/components/SlotPicker';
import { goBack } from '../../src/lib/nav';

export default function RescheduleScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const [when, setWhen] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!when) {
      Alert.alert('Select date & time', 'Please pick a new date and time');
      return;
    }
    const newDate = when.toISOString();
    setLoading(true);
    try {
      await wagApi.bookings.reschedule(bookingId!, newDate, 'Customer requested reschedule');
      Alert.alert('Rescheduled!', `Your booking has been moved to ${format(when, 'EEE, d MMM · h:mm a')}`, [
        { text: 'OK', onPress: () => goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not reschedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reschedule</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SlotPicker onChange={setWhen} dateLabel="CHOOSE NEW DATE" timeLabel="CHOOSE NEW TIME" />

        {when && (
          <View style={[styles.confirmBox, { flexDirection: 'row', alignItems: 'center', gap: spacing[2] }]}>
            <Icon name="cal" size={15} color={colors.brandBrown} />
            <Text style={styles.confirmText}>New time: {format(when, 'EEEE, d MMMM · h:mm a')}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={handleConfirm} fullWidth loading={loading} disabled={!when}>
          Confirm Reschedule
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  sectionLabel: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[3] },
  dayRow: { marginBottom: spacing[2] },
  dayChip: { alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, minWidth: 56 },
  dayChipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  dayWeekday: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  dayNum: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  hourChip: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  hourChipActive: { backgroundColor: colors.marigold, borderColor: colors.marigold },
  hourText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  hourTextActive: { color: colors.white },
  confirmBox: { marginTop: spacing[5], backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4] },
  confirmText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.marigoldDark, textAlign: 'center' },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
