import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Icon } from './Icon';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DateFieldProps {
  /** ISO date (YYYY-MM-DD) or '' when empty */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  /** Latest selectable date (ISO). Defaults to today. */
  maxDate?: string;
  /** Earliest selectable year. Defaults to 30 years back. */
  minYear?: number;
  error?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

export function formatDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${parseInt(m[3]!, 10)} ${MONTHS[parseInt(m[2]!, 10) - 1]} ${m[1]}`;
}

// Cross-platform date picker built from three tappable columns, so it behaves the same on
// iOS, Android and web without a native module.
export function DateField({ value, onChange, placeholder = 'Select a date', maxDate, minYear, error, disabled, accessibilityLabel }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const max = useMemo(() => {
    if (maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate)) {
      const [y, m, d] = maxDate.split('-').map(Number);
      return new Date(y!, m! - 1, d!);
    }
    return today;
  }, [maxDate, today]);
  const firstYear = minYear ?? today.getFullYear() - 30;

  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const [year, setYear] = useState(parsed ? parseInt(parsed[1]!, 10) : max.getFullYear());
  const [month, setMonth] = useState(parsed ? parseInt(parsed[2]!, 10) - 1 : max.getMonth());
  const [day, setDay] = useState(parsed ? parseInt(parsed[3]!, 10) : max.getDate());

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = max.getFullYear(); y >= firstYear; y--) out.push(y);
    return out;
  }, [max, firstYear]);

  const monthDisabled = (mi: number) => year === max.getFullYear() && mi > max.getMonth();
  const dayCount = daysIn(year, month);
  const dayDisabled = (d: number) => year === max.getFullYear() && month === max.getMonth() && d > max.getDate();

  const clampAndSet = (y: number, m: number, d: number) => {
    let mm = m;
    if (y === max.getFullYear() && mm > max.getMonth()) mm = max.getMonth();
    let dd = Math.min(d, daysIn(y, mm));
    if (y === max.getFullYear() && mm === max.getMonth() && dd > max.getDate()) dd = max.getDate();
    setYear(y); setMonth(mm); setDay(dd);
  };

  const confirm = () => {
    onChange(`${year}-${pad(month + 1)}-${pad(day)}`);
    setOpen(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.field, !!error && styles.fieldError, disabled && { opacity: 0.5 }]}
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? 'Select date'}
      >
        <Text style={value ? styles.value : styles.placeholder}>{value ? formatDisplayDate(value) : placeholder}</Text>
        <Icon name="cal" size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <BottomSheet visible={open} onDismiss={() => setOpen(false)} snapPoints="70%">
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Select date</Text>
          <View style={styles.cols}>
            <Column title="Day">
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                <Cell key={d} label={String(d)} active={d === day} disabled={dayDisabled(d)} onPress={() => clampAndSet(year, month, d)} />
              ))}
            </Column>
            <Column title="Month">
              {MONTHS.map((m, i) => (
                <Cell key={m} label={m} active={i === month} disabled={monthDisabled(i)} onPress={() => clampAndSet(year, i, day)} />
              ))}
            </Column>
            <Column title="Year">
              {years.map((y) => (
                <Cell key={y} label={String(y)} active={y === year} onPress={() => clampAndSet(y, month, day)} />
              ))}
            </Column>
          </View>
          <Button onPress={confirm} fullWidth>Done</Button>
        </View>
      </BottomSheet>
    </View>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.col}>
      <Text style={styles.colTitle}>{title}</Text>
      <ScrollView style={styles.colScroll} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </View>
  );
}

function Cell({ label, active, disabled, onPress }: { label: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.cell, active && styles.cellActive, disabled && { opacity: 0.3 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ selected: active, disabled }}
    >
      <Text style={[styles.cellText, active && styles.cellTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.md, backgroundColor: colors.white, paddingHorizontal: spacing[4], paddingVertical: spacing[3] + 2 },
  fieldError: { borderColor: colors.error },
  value: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: '600' },
  placeholder: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted },
  error: { fontFamily: 'Inter', fontSize: 12, color: colors.error, marginTop: 4 },
  sheet: { paddingHorizontal: spacing[5], paddingBottom: spacing[5] },
  sheetTitle: { fontFamily: 'PlusJakartaSans', fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[4] },
  cols: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  col: { flex: 1 },
  colTitle: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing[2], textAlign: 'center' },
  colScroll: { height: 220 },
  cell: { paddingVertical: spacing[3], alignItems: 'center', borderRadius: radii.sm },
  cellActive: { backgroundColor: colors.brandBrown },
  cellText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: '600' },
  cellTextActive: { color: colors.white },
});
