import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { useBookingStore } from '../../../src/store/booking.store';
import { wagApi } from '../../../src/lib/api';
import { addDays, format, setHours, setMinutes, startOfDay } from 'date-fns';

export default function WalkScheduleScreen() {
  const { walkDraft, updateWalkDraft } = useBookingStore();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadedAddresses, setLoadedAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [scheduleNow, setScheduleNow] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    wagApi.client.get<any[]>('/users/addresses').then((data) => {
      setAddresses(data);
      const def = data.find((a: any) => a.isDefault) ?? data[0];
      if (def) setSelectedAddressId(def.id);
      setLoadedAddresses(true);
    }).catch(() => { setLoadedAddresses(true); });
  }, []);

  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  const hours = [6,7,8,9,10,16,17,18,19,20];

  const handleConfirm = async () => {
    if (!selectedAddressId) {
      Alert.alert('No address', 'Please add a service address first.');
      return;
    }
    const addr = addresses.find((a) => a.id === selectedAddressId);
    let scheduledAt: string | null = null;
    if (!scheduleNow) {
      if (!selectedDay || !selectedHour) {
        Alert.alert('Pick a time', 'Please select a date and time for your walk.');
        return;
      }
      scheduledAt = setHours(selectedDay, selectedHour).toISOString();
    }

    updateWalkDraft({
      scheduleNow,
      scheduledAt,
      addressId: selectedAddressId,
      addressLine: addr ? `${addr.line1}, ${addr.city}` : '',
    });

    setLoading(true);
    try {
      const booking = await wagApi.bookings.createWalkingBooking({
        petId: walkDraft.petId!,
        durationMinutes: walkDraft.durationMinutes,
        scheduleNow,
        scheduledAt: scheduledAt ?? undefined,
        addressId: selectedAddressId,
        paymentMethod: walkDraft.paymentMethod,
      });

      if (scheduleNow) {
        router.replace({ pathname: '/booking/walking/searching', params: { id: booking.id } } as any);
      } else {
        router.replace({ pathname: '/booking/confirmed', params: { id: booking.id } } as any);
      }
    } catch (err: any) {
      Alert.alert('Booking failed', err?.message ?? 'Please try again');
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
        <Text style={styles.title}>Schedule Walk</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Now vs Later */}
        <Text style={styles.sectionLabel}>WHEN?</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, scheduleNow && styles.toggleBtnActive]}
            onPress={() => setScheduleNow(true)}
            accessibilityRole="radio"
            accessibilityState={{ selected: scheduleNow }}
          >
            <Text style={[styles.toggleText, scheduleNow && styles.toggleTextActive]}>⚡ Walk Now</Text>
            <Text style={[styles.toggleSub, scheduleNow && styles.toggleSubActive]}>Nearest partner in ~10 min</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !scheduleNow && styles.toggleBtnActive]}
            onPress={() => setScheduleNow(false)}
            accessibilityRole="radio"
            accessibilityState={{ selected: !scheduleNow }}
          >
            <Text style={[styles.toggleText, !scheduleNow && styles.toggleTextActive]}>🗓 Schedule Later</Text>
            <Text style={[styles.toggleSub, !scheduleNow && styles.toggleSubActive]}>Pick a date & time</Text>
          </TouchableOpacity>
        </View>

        {/* Date/time if scheduling later */}
        {!scheduleNow && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing[4] }]}>DATE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {days.map((d, i) => {
                const active = selectedDay ? format(d, 'yyyy-MM-dd') === format(selectedDay, 'yyyy-MM-dd') : false;
                return (
                  <TouchableOpacity key={i} style={[styles.dayChip, active && styles.dayChipActive]} onPress={() => setSelectedDay(d)}>
                    <Text style={[styles.dayText, active && { color: colors.white }]}>{format(d, 'EEE')}</Text>
                    <Text style={[styles.dayNum, active && { color: colors.white }]}>{format(d, 'd')}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={[styles.sectionLabel, { marginTop: spacing[4] }]}>TIME</Text>
            <View style={styles.hourGrid}>
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

        {/* Address selection */}
        <Text style={[styles.sectionLabel, { marginTop: spacing[4] }]}>PICKUP ADDRESS</Text>
        {addresses.map((addr) => {
          const active = selectedAddressId === addr.id;
          return (
            <TouchableOpacity
              key={addr.id}
              style={[styles.addrCard, active && styles.addrCardActive]}
              onPress={() => setSelectedAddressId(addr.id)}
            >
              <Text style={styles.addrLabel}>{addr.label}</Text>
              <Text style={styles.addrLine}>{addr.line1}, {addr.city}</Text>
              {active && <Text style={{ color: colors.success, fontSize: 16 }}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={handleConfirm} fullWidth loading={loading}>
          {scheduleNow ? 'Find a Walker Now ⚡' : 'Schedule Walk →'}
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
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  sectionLabel: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[3] },
  toggleRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[2] },
  toggleBtn: { flex: 1, backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1.5, borderColor: colors.borderLight },
  toggleBtnActive: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  toggleText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  toggleTextActive: { color: colors.marigoldDark },
  toggleSub: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, marginTop: 4 },
  toggleSubActive: { color: colors.marigoldDark },
  dayRow: { gap: spacing[2], paddingBottom: spacing[2] },
  dayChip: { alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, minWidth: 52 },
  dayChipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  dayText: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  dayNum: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  hourChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  hourChipActive: { backgroundColor: colors.marigold, borderColor: colors.marigold },
  hourText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  hourTextActive: { color: colors.white },
  addrCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing[4], borderWidth: 1.5, borderColor: colors.borderLight, marginBottom: spacing[2] },
  addrCardActive: { borderColor: colors.success },
  addrLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  addrLine: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, flex: 1, marginHorizontal: spacing[3] },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
