import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DuesStatus } from '@wag/shared-types';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../lib/api';
import { payWithProvider } from '../lib/razorpay';

const inr = (n: number) => `₹${Math.round(n * 100) / 100}`;

/**
 * Commission the partner owes the company for jobs paid directly to them (pay-after-service). At the
 * limit, jobs disappear and cannot be accepted until this is paid — the banner explains that and takes
 * the payment. `banner` shows only when it matters; `card` always shows the balance and limit.
 */
export function DuesBanner({ variant, onChanged }: { variant: 'banner' | 'card'; onChanged?: () => void }) {
  const [dues, setDues] = useState<DuesStatus | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    wagApi.partner.getDues().then(setDues).catch(() => {});
  }, []);
  useFocusEffect(load);

  const pay = async () => {
    if (!dues || dues.due <= 0) return;
    setPaying(true);
    try {
      const order = await wagApi.partner.createDuesOrder();
      const res = await payWithProvider({
        keyId: order.keyId,
        providerOrderId: order.providerOrderId,
        amountInr: order.amount,
        description: 'Wag & Tails commission dues',
      });
      const next = await wagApi.partner.confirmDuesPayment({
        commissionPaymentId: order.commissionPaymentId,
        providerPaymentId: res.providerPaymentId,
        signature: res.signature,
      });
      setDues(next);
      onChanged?.();
      Alert.alert('Payment received', next.blocked ? 'Some dues remain.' : 'Thank you. You can accept jobs again.');
    } catch (err: any) {
      // Cancelling the provider checkout is not an error worth alarming about.
      const msg = err?.response?.data?.message ?? err?.description ?? err?.message;
      if (msg) Alert.alert('Payment not completed', String(msg));
    } finally {
      setPaying(false);
    }
  };

  if (!dues) return null;
  if (variant === 'banner' && !dues.blocked && !dues.warning) return null;

  const pct = dues.limit > 0 ? Math.min(100, Math.max(0, (dues.due / dues.limit) * 100)) : 0;
  const tone = dues.blocked ? styles.toneBlocked : dues.warning ? styles.toneWarn : styles.toneOk;

  return (
    <View style={[styles.box, tone]}>
      <View style={styles.row}>
        <Icon name={dues.blocked ? 'alert' : 'wallet'} size={18} color={dues.blocked ? colors.error : colors.brandBrown} />
        <Text style={styles.title}>
          {dues.blocked ? 'Jobs paused: commission limit reached' : dues.warning ? 'Commission due is getting high' : 'Commission you owe'}
        </Text>
      </View>
      {dues.blocked && (
        <Text style={styles.body}>
          You owe {inr(dues.due)} (limit {inr(dues.limit)}). You can't see or accept new jobs until you pay. Jobs you already accepted can still be completed.
        </Text>
      )}
      {dues.warning && !dues.blocked && (
        <Text style={styles.body}>You owe {inr(dues.due)} of your {inr(dues.limit)} limit. Pay before it reaches the limit to keep receiving jobs.</Text>
      )}
      {variant === 'card' && !dues.blocked && !dues.warning && (
        <Text style={styles.body}>
          Customers who pay you directly keep {dues.partnerPct}% with you; {dues.commissionPct}% is the company's share, collected here.
        </Text>
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }, dues.blocked ? styles.fillBlocked : dues.warning ? styles.fillWarn : null]} />
      </View>
      <View style={styles.amounts}>
        <Text style={styles.amount}>{inr(Math.max(0, dues.due))} due</Text>
        <Text style={styles.limit}>limit {inr(dues.limit)}</Text>
      </View>
      {dues.due > 0 && (
        <Button onPress={pay} loading={paying} fullWidth size="sm" style={{ marginTop: spacing[3] }}>
          {`Pay ${inr(dues.due)} now`}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radii.lg, padding: spacing[4], borderWidth: 1.5, marginBottom: spacing[3], backgroundColor: colors.white },
  toneOk: { borderColor: colors.borderLight },
  toneWarn: { borderColor: colors.warning, backgroundColor: colors.warningLight },
  toneBlocked: { borderColor: colors.error, backgroundColor: colors.errorLight },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  body: { fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: spacing[2] },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.gray100, marginTop: spacing[3], overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.brandBrown },
  fillWarn: { backgroundColor: colors.warning },
  fillBlocked: { backgroundColor: colors.error },
  amounts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[1] },
  amount: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  limit: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted },
});
