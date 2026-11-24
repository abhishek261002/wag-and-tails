import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { format, addDays } from 'date-fns';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../lib/api';

interface Props {
  packageId: string;
  addressId: string;
  cityId?: string | null;
  /** Moving an existing booking: its own slot does not count as taken. */
  bookingId?: string;
  daysAhead?: number;
  onChange: (at: Date | null) => void;
}

/**
 * Slots from the website's calendar (city capacity, buffer, holidays), so the website and the app never double-book.
 * Each day's free times are fetched when the day is opened; a day with none left shows "Full".
 */
export function WebsiteSlotPicker({ packageId, addressId, cityId, bookingId, daysAhead = 10, onChange }: Props) {
  const days = useMemo(() => Array.from({ length: Math.max(1, daysAhead) }, (_, i) => addDays(new Date(), i)), [daysAhead]);
  const [day, setDay] = useState(() => format(days[0]!, 'yyyy-MM-dd'));
  const [byDay, setByDay] = useState<Record<string, string[] | 'error'>>({});
  const [picked, setPicked] = useState<string | null>(null);

  const load = (d: string) => {
    wagApi.bookings.getAvailableSlots(packageId, d, addressId, { ...(cityId ? { cityId } : {}), ...(bookingId ? { bookingId } : {}) })
      .then((list) => setByDay((m) => ({ ...m, [d]: Array.isArray(list) ? list : [] })))
      .catch(() => setByDay((m) => ({ ...m, [d]: 'error' })));
  };

  useEffect(() => { if (!byDay[day]) load(day); }, [day]); // eslint-disable-line react-hooks/exhaustive-deps
  // Refresh the open day every minute: someone on the website may take a slot meanwhile.
  useEffect(() => {
    const t = setInterval(() => load(day), 60_000);
    return () => clearInterval(t);
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const list = byDay[day];
    if (picked && Array.isArray(list) && !list.includes(picked)) { setPicked(null); }
  }, [byDay, day, picked]);
  useEffect(() => { onChange(picked ? new Date(picked) : null); }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = byDay[day];
  return (
    <View>
      <Text style={styles.sectionLabel}>DATE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing[5] }}>
        {days.map((d, i) => {
          const key = format(d, 'yyyy-MM-dd');
          const active = key === day;
          const full = Array.isArray(byDay[key]) && (byDay[key] as string[]).length === 0;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.dayChip, active && styles.dayChipActive, full && !active && styles.dayChipDisabled]}
              onPress={() => { setDay(key); setPicked(null); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>{i === 0 ? 'Today' : format(d, 'EEE')}</Text>
              <Text style={[styles.dayDate, active && styles.dayTextActive]}>{format(d, 'd')}</Text>
              <Text style={[styles.dayMonth, active && styles.dayTextActive]}>{full ? 'Full' : format(d, 'MMM')}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionLabel, { marginTop: spacing[5] }]}>TIME SLOT</Text>
      {slots === undefined ? (
        <ActivityIndicator color={colors.brandBrown} style={{ marginTop: spacing[3] }} />
      ) : slots === 'error' ? (
        <TouchableOpacity onPress={() => load(day)}><Text style={styles.notice}>Could not load times. Tap to try again.</Text></TouchableOpacity>
      ) : slots.length === 0 ? (
        <Text style={styles.notice}>No times left on this day. Please pick another day.</Text>
      ) : (
        <View style={styles.slotsGrid}>
          {slots.map((iso) => {
            const active = picked === iso;
            return (
              <TouchableOpacity key={iso} style={[styles.slot, active && styles.slotActive]} onPress={() => setPicked(iso)} accessibilityRole="radio" accessibilityState={{ selected: active }}>
                <Text style={[styles.slotText, active && styles.slotTextActive]}>{format(new Date(iso), 'h:mm a')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[3] },
  dayChip: { alignItems: 'center', paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.borderLight, marginRight: spacing[2], backgroundColor: colors.white, minWidth: 60 },
  dayChipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  dayChipDisabled: { opacity: 0.4 },
  dayWeekday: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  dayDate: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginVertical: 2 },
  dayMonth: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted },
  dayTextActive: { color: colors.white },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  slot: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  slotActive: { backgroundColor: colors.marigold, borderColor: colors.marigold },
  slotText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  slotTextActive: { color: colors.white },
  notice: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginBottom: spacing[3] },
});
