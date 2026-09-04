import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { useBookingStore } from '../../../src/store/booking.store';
import { addDays, format, setHours, setMinutes, startOfDay } from 'date-fns';

const DAYS_AHEAD = 14;
const TIME_SLOTS = [
  { label: '8:00 AM', h: 8, m: 0 },
  { label: '9:00 AM', h: 9, m: 0 },
  { label: '10:00 AM', h: 10, m: 0 },
  { label: '11:00 AM', h: 11, m: 0 },
  { label: '12:00 PM', h: 12, m: 0 },
  { label: '1:00 PM', h: 13, m: 0 },
  { label: '2:00 PM', h: 14, m: 0 },
  { label: '3:00 PM', h: 15, m: 0 },
  { label: '4:00 PM', h: 16, m: 0 },
  { label: '5:00 PM', h: 17, m: 0 },
];

export default function SelectDateTimeScreen() {
  const { groomingDraft, updateGroomingDraft } = useBookingStore();
  const today = startOfDay(new Date());
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i + 1));

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ h: number; m: number } | null>(null);

  const handleContinue = () => {
    if (!selectedDay || !selectedSlot) return;
    const dt = setMinutes(setHours(selectedDay, selectedSlot.h), selectedSlot.m);
    updateGroomingDraft({ scheduledAt: dt.toISOString() });
    router.push('/booking/grooming/select-address');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pick a Date & Time</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date row */}
        <Text style={styles.sectionLabel}>DATE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayRow} contentContainerStyle={{ paddingHorizontal: spacing[5] }}>
          {days.map((day, i) => {
            const active = selectedDay ? format(day, 'yyyy-MM-dd') === format(selectedDay, 'yyyy-MM-dd') : false;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => { setSelectedDay(day); setSelectedSlot(null); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>
                  {format(day, 'EEE')}
                </Text>
                <Text style={[styles.dayDate, active && styles.dayTextActive]}>
                  {format(day, 'd')}
                </Text>
                <Text style={[styles.dayMonth, active && styles.dayTextActive]}>
                  {format(day, 'MMM')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time slots */}
        {selectedDay && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing[5] }]}>TIME SLOT</Text>
            <View style={styles.slotsGrid}>
              {TIME_SLOTS.map((slot, i) => {
                const active = selectedSlot?.h === slot.h && selectedSlot?.m === slot.m;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.slot, active && styles.slotActive]}
                    onPress={() => setSelectedSlot(slot)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {selectedDay && selectedSlot && (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              📅 {format(setHours(selectedDay, selectedSlot.h), 'EEEE, d MMMM · h:mm a')}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          onPress={handleContinue}
          fullWidth
          disabled={!selectedDay || !selectedSlot}
        >
          Continue →
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  content: { paddingBottom: spacing[4] },
  sectionLabel: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: spacing[5], marginBottom: spacing[3] },
  dayRow: { marginBottom: spacing[2] },
  dayChip: { alignItems: 'center', paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.borderLight, marginRight: spacing[2], backgroundColor: colors.white, minWidth: 60 },
  dayChipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  dayWeekday: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  dayDate: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginVertical: 2 },
  dayMonth: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted },
  dayTextActive: { color: colors.white },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingHorizontal: spacing[5] },
  slot: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  slotActive: { backgroundColor: colors.marigold, borderColor: colors.marigold },
  slotText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  slotTextActive: { color: colors.white },
  confirmBox: { marginHorizontal: spacing[5], marginTop: spacing[5], backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4] },
  confirmText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.marigoldDark, textAlign: 'center' },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
