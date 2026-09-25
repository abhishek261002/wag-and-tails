import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../lib/api';

/**
 * Pay-after-service, COD style: the customer pays the partner directly (cash or UPI) and the partner
 * confirms it here. The job cannot be completed until this is done, and confirming is what puts the
 * company's commission on the partner's account.
 */
export function CollectPaymentCard({ bookingId, amount, onCollected }: { bookingId: string; amount: number; onCollected: () => void }) {
  const [busy, setBusy] = useState<'cash' | 'upi' | null>(null);

  const collect = (method: 'cash' | 'upi') => {
    Alert.alert(
      method === 'cash' ? 'Cash received?' : 'UPI payment received?',
      `Confirm you received ₹${amount} ${method === 'cash' ? 'in cash' : 'by UPI'} from the customer. This cannot be undone.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Yes, received',
          onPress: async () => {
            setBusy(method);
            try {
              await wagApi.partner.collectPayment(bookingId, method);
              onCollected();
            } catch (err: any) {
              Alert.alert('Could not save', err?.response?.data?.message ?? err?.message ?? 'Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon name="wallet" size={18} color={colors.brandBrown} />
        <Text style={styles.title}>Collect ₹{amount} from the customer</Text>
      </View>
      <Text style={styles.sub}>The customer chose to pay after service. Take the payment, then mark it received to finish the job.</Text>
      <View style={styles.actions}>
        <Button variant="outline" onPress={() => collect('cash')} loading={busy === 'cash'} disabled={!!busy} style={{ flex: 1 }}>Received cash</Button>
        <Button onPress={() => collect('upi')} loading={busy === 'upi'} disabled={!!busy} style={{ flex: 1 }}>Received UPI</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[5], gap: spacing[3], borderWidth: 1, borderColor: colors.borderLight },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  sub: { fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: spacing[3] },
});
