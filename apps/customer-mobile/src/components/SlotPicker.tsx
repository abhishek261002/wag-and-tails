import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { bookableDays, firstAvailableDay, BOOKING_DAYS_AHEAD, GROOMING_SLOT_HOURS, type Slot } from '@wag/shared-types';
import { colors, spacing, typography, radii } from '@wag/design-tokens';

interface Props {
  /** Slot hours to offer (defaults to the grooming hours). */
  hours?: readonly number[];
  /** Called with the chosen slot's start, or null when nothing (or no longer anything) is chosen. */
  onChange: (at: Date | null) => void;
  /** Heading for the day row and the time grid. */
  dateLabel?: string;
  timeLabel?: string;
}

/**
 * Day chips plus time slots for booking. Today is included: only slots that start at least 30 minutes from now
 * are offered (the rule the API enforces too), the list is re-evaluated every 30 s so a slot disappears once it is
 * too close, and a day with nothing left is greyed out. Starts on the first day that still has a slot.
 */
export function SlotPicker({ hours = GROOMING_SLOT_HOURS, onChange, dateLabel = 'DATE', timeLabel = 'TIME SLOT' }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => bookableDays(now, BOOKING_DAYS_AHEAD, hours), [now, hours]);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);

  const keyOf = (d: Date) => format(d, 'yyyy-MM-dd');
  const selectedDay = days.find((d) => keyOf(d.day) === dayKey) ?? firstAvailableDay(days);
  const slots: Slot[] = selectedDay?.slots ?? [];
  const selected = slots.find((s) => s.hour === hour) ?? null;

  // The chosen slot became too soon while the screen was open.
  useEffect(() => {
    if (hour !== null && !selected) { setHour(null); setExpired(true); }
  }, [hour, selected]);

  const selectedAt = selected ? selected.at.getTime() : null;
  useEffect(() => { onChange(selected ? selected.at : null); }, [selectedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View>
      <Text style={styles.sectionLabel}>{dateLabel}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {days.map(({ day, available }) => {
          const active = !!selectedDay && keyOf(day) === keyOf(selectedDay.day);
          return (
            <TouchableOpacity
              key={keyOf(day)}
              style={[styles.dayChip, active && styles.dayChipActive, !available && styles.dayChipDisabled]}
              onPress={() => { setDayKey(keyOf(day)); setHour(null); setExpired(false); }}
              disabled={!available}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: !available }}
            >
              <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>{keyOf(day) === keyOf(now) ? 'Today' : format(day, 'EEE')}</Text>
              <Text style={[styles.dayDate, active && styles.dayTextActive]}>{format(day, 'd')}</Text>
              <Text style={[styles.dayMonth, active && styles.dayTextActive]}>{available ? format(day, 'MMM') : 'Full'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedDay ? (
        <>
          <Text style={[styles.sectionLabel, { marginTop: spacing[5] }]}>{timeLabel}</Text>
          {expired && <Text style={styles.notice}>That slot is no longer available. Please pick another.</Text>}
          <View style={styles.slotsGrid}>
            {slots.map((slot) => {
              const active = selected?.hour === slot.hour;
              return (
                <TouchableOpacity
                  key={slot.hour}
                  style={[styles.slot, active && styles.slotActive]}
                  onPress={() => { setHour(slot.hour); setExpired(false); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : (
        <Text style={[styles.notice, { marginTop: spacing[5] }]}>No slots are available in the next {BOOKING_DAYS_AHEAD} days. Please try again later.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[3] },
  dayRow: { paddingRight: spacing[5] },
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
