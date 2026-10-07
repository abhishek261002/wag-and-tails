import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';
import { colors, spacing, radii } from '@wag/design-tokens';
import type { AvailableCoupon } from '@wag/api-client';
import { wagApi } from '../lib/api';

interface Props {
  service: 'grooming' | 'walking' | 'store';
  orderValue: number;
  /** Code currently applied, if any. */
  appliedCode?: string;
  onApply: (code: string) => void;
}

function offerText(c: AvailableCoupon): string {
  const base = c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${c.discountValue} off`;
  return c.discountType === 'percent' && c.maxDiscount ? `${base} up to ₹${c.maxDiscount}` : base;
}

/**
 * Every coupon the customer can use on this order, listed on the checkout page. Usable ones can be applied with one
 * tap; the rest stay visible with the reason (e.g. "Add ₹200 more to use this").
 */
export function AvailableCoupons({ service, orderValue, appliedCode, onApply }: Props) {
  const [coupons, setCoupons] = useState<AvailableCoupon[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    wagApi.bookings.availableCoupons(service, orderValue)
      .then((r) => { if (alive) setCoupons(r); })
      .catch(() => { if (alive) { setCoupons([]); setFailed(true); } });
    return () => { alive = false; };
  }, [service, orderValue]);

  if (coupons === null) return <ActivityIndicator color={colors.marigold} style={{ marginTop: spacing[3] }} />;
  if (coupons.length === 0) {
    return <Text style={styles.empty}>{failed ? "Couldn't load coupons. You can still type a code above." : 'No coupons available right now.'}</Text>;
  }

  return (
    <View style={styles.list} accessibilityLabel="Available coupons">
      <Text style={styles.heading}>Available coupons</Text>
      {coupons.map((c) => {
        const applied = appliedCode?.toUpperCase() === c.code.toUpperCase();
        return (
          <View key={c.code} style={[styles.card, !c.eligible && styles.cardLocked, applied && styles.cardApplied]}>
            <View style={styles.info}>
              <Text style={styles.code}>{c.code}</Text>
              <Text style={styles.offer}>{offerText(c)}{c.eligible && c.discount > 0 ? ` · you save ₹${c.discount}` : ''}</Text>
              {!!c.description && <Text style={styles.desc} numberOfLines={2}>{c.description}</Text>}
              <Text style={[styles.meta, !c.eligible && styles.reason]}>
                {c.eligible ? `Valid till ${format(new Date(c.validUntil), 'd MMM yyyy')}` : c.reason}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, (!c.eligible || applied) && styles.btnOff]}
              disabled={!c.eligible || applied}
              onPress={() => onApply(c.code)}
              accessibilityRole="button"
              accessibilityLabel={applied ? `${c.code} applied` : `Apply coupon ${c.code}`}
            >
              <Text style={[styles.btnText, (!c.eligible || applied) && styles.btnTextOff]}>{applied ? 'Applied' : 'Apply'}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: spacing[4], gap: spacing[2] },
  heading: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  empty: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: spacing[3] },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  cardLocked: { borderColor: colors.borderLight, backgroundColor: colors.canvas },
  cardApplied: { borderStyle: 'solid', borderColor: colors.success },
  info: { flex: 1, minWidth: 0 },
  code: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.5 },
  offer: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.success, marginTop: 2 },
  desc: { fontFamily: 'Inter', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  meta: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, marginTop: 4 },
  reason: { color: colors.error },
  btn: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radii.md, backgroundColor: colors.brandBrown },
  btnOff: { backgroundColor: colors.borderLight },
  btnText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.white },
  btnTextOff: { color: colors.textMuted },
});
