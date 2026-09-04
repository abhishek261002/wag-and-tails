import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { addDays, format, setHours, startOfDay } from 'date-fns';

export default function RescheduleScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const today = startOfDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1));
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selectedDay || !selectedHour) {
      Alert.alert('Select date & time', 'Please pick a new date and time');
      return;
    }
    const newDate = setHours(selectedDay, selectedHour).toISOString();
    setLoading(true);
    try {
      await wagApi.bookings.reschedule(bookingId!, newDate, 'Customer requested reschedule');
      Alert.alert('Rescheduled!', `Your booking has been moved to ${format(setHours(selectedDay, selectedHour), 'EEE, d MMM · h:mm a')}`, [
        { text: 'OK', onPress: () => router.back() },
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
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reschedule</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>CHOOSE NEW DATE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayRow} contentContainerStyle={{ gap: spacing[2] }}>
          {days.map((day, i) => {
            const active = selectedDay ? format(day, 'yyyy-MM-dd') === format(selectedDay, 'yyyy-MM-dd') : false;
            return (
              <TouchableOpacity key={i} style={[styles.dayChip, active && styles.dayChipActive]} onPress={() => setSelectedDay(day)}>
                <Text style={[styles.dayWeekday, active && { color: colors.white }]}>{format(day, 'EEE')}</Text>
                <Text style={[styles.dayNum, active && { color: colors.white }]}>{format(day, 'd')}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedDay && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing[5] }]}>CHOOSE NEW TIME</Text>
            <View style={styles.hoursGrid}>
              {hours.map((h) => {
                const active = selectedHour === h;
                const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM`;
                return (
                  <TouchableOpacity key={h} style={[styles.hourChip, active && styles.hourChipActive]} onPress={() => setSelectedHour(h)}>
                    <Text style={[styles.hourText, active && styles.hourTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {selectedDay && selectedHour && (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              📅 New time: {format(setHours(selectedDay, selectedHour), 'EEEE, d MMMM · h:mm a')}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={handleConfirm} fullWidth loading={loading} disabled={!selectedDay || !selectedHour}>
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
