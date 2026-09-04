import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const HOURS = Array.from({ length: 16 }, (_, i) => { const h = 6 + i; return { value: `${h.toString().padStart(2,'0')}:00`, label: h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm` }; });

type DaySlot = { active: boolean; start: string; end: string };

export default function WorkingHoursScreen() {
  const [schedule, setSchedule] = useState<Record<string, DaySlot>>(
    Object.fromEntries(DAYS.map((d) => [d, { active: !['sun'].includes(d), start: '09:00', end: '18:00' }]))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    wagApi.partner.getProfile().then((p: any) => {
      if (p?.availability?.length > 0) {
        const updated = { ...schedule };
        for (const day of DAYS) updated[day] = { active: false, start: '09:00', end: '18:00' };
        for (const slot of p.availability) {
          updated[slot.day] = { active: true, start: slot.startTime, end: slot.endTime };
        }
        setSchedule(updated);
      }
    }).catch(() => {});
  }, []);

  const toggle = (day: string) => setSchedule((s) => ({ ...s, [day]: { ...s[day]!, active: !s[day]!.active } }));

  const save = async () => {
    setSaving(true);
    try {
      const availability = DAYS.filter((d) => schedule[d]?.active).map((d) => ({
        day: d, startTime: schedule[d]!.start, endTime: schedule[d]!.end,
      }));
      await wagApi.client.put('/partners/me/availability', { availability });
      Alert.alert('Saved!', 'Working hours updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Working Hours</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {DAYS.map((day) => {
          const slot = schedule[day]!;
          return (
            <View key={day} style={[styles.dayRow, !slot.active && styles.dayRowInactive]}>
              <TouchableOpacity
                style={[styles.dayToggle, slot.active && styles.dayToggleActive]}
                onPress={() => toggle(day)}
                accessibilityRole="switch"
                accessibilityState={{ checked: slot.active }}
              >
                <Text style={[styles.dayLabel, slot.active && styles.dayLabelActive]}>{DAY_LABELS[day]}</Text>
              </TouchableOpacity>
              {slot.active ? (
                <View style={styles.timeSelectors}>
                  <TimeSelect value={slot.start} options={HOURS} onChange={(v) => setSchedule((s) => ({ ...s, [day]: { ...s[day]!, start: v } }))} />
                  <Text style={styles.timeSep}>—</Text>
                  <TimeSelect value={slot.end} options={HOURS} onChange={(v) => setSchedule((s) => ({ ...s, [day]: { ...s[day]!, end: v } }))} />
                </View>
              ) : (
                <Text style={styles.offText}>Off</Text>
              )}
            </View>
          );
        })}
        <Button onPress={save} loading={saving} fullWidth style={{ marginTop: spacing[5] }}>Save Hours</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function TimeSelect({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 120 }} contentContainerStyle={{ gap: 4 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.timeChip, value === opt.value && styles.timeChipActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.timeChipText, value === opt.value && styles.timeChipTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { padding: spacing[5] },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing[3], marginBottom: spacing[2], borderWidth: 1, borderColor: colors.borderLight },
  dayRowInactive: { opacity: 0.6 },
  dayToggle: { width: 44, height: 44, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  dayToggleActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  dayLabel: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.textMuted },
  dayLabelActive: { color: colors.white },
  timeSelectors: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  timeSep: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted },
  offText: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted },
  timeChip: { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight },
  timeChipActive: { backgroundColor: colors.marigold, borderColor: colors.marigold },
  timeChipText: { fontFamily: 'Inter', fontSize: 11, color: colors.textSecondary },
  timeChipTextActive: { color: colors.white, fontWeight: '700' },
});
