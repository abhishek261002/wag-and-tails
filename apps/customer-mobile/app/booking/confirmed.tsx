import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { format } from 'date-fns';

export default function BookingConfirmedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    if (id) wagApi.bookings.get(id).then(setBooking).catch(() => {});
  }, [id]);

  const handleShare = async () => {
    if (!booking) return;
    const text = `I've booked ${booking.type === 'grooming' ? 'a grooming session' : 'a dog walk'} for ${booking.petName} via Wag & Tails! 🐾`;
    await Share.share({ message: text });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Success animation */}
        <View style={styles.successCircle}>
          <Text style={styles.successEmoji}>🎉</Text>
        </View>

        <Text style={styles.headline}>Booking Confirmed!</Text>
        <Text style={styles.sub}>
          Your booking for {booking?.petName ?? 'your pet'} has been confirmed.
          We'll notify you when a partner is assigned.
        </Text>

        {booking && (
          <View style={styles.receipt}>
            <ReceiptRow label="Booking ID" value={`#${booking.id.slice(-8).toUpperCase()}`} />
            <ReceiptRow label="Service" value={booking.type === 'grooming' ? `Grooming — ${booking.packageName}` : `Dog Walk — ${booking.durationMinutes} min`} />
            {booking.scheduledAt && (
              <ReceiptRow label="Scheduled" value={format(new Date(booking.scheduledAt), 'EEE, d MMM yyyy · h:mm a')} />
            )}
            <ReceiptRow label="Address" value={booking.addressLine} />
            <ReceiptRow label="Total" value={`₹${booking.total}`} bold />
            <ReceiptRow label="Payment" value={booking.paymentMethod?.replace(/_/g, ' ')} />
          </View>
        )}

        <View style={styles.actions}>
          <Button
            onPress={() => router.push({ pathname: '/booking/[id]', params: { id: id! } })}
            fullWidth
            style={{ marginBottom: spacing[3] }}
          >
            View Booking Details
          </Button>
          <Button
            variant="outline"
            onPress={handleShare}
            fullWidth
            style={{ marginBottom: spacing[3] }}
          >
            Share Booking
          </Button>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/home')}>
            <Text style={styles.homeLink}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ReceiptRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={[styles.receiptValue, bold && styles.receiptBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, paddingHorizontal: spacing[6], paddingTop: spacing[10], alignItems: 'center' },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[5] },
  successEmoji: { fontSize: 48 },
  headline: { fontFamily: 'Inter', fontSize: typography.fontSize['3xl'], fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing[2] },
  sub: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing[6] },
  receipt: { width: '100%', backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[6] },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  receiptLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted },
  receiptValue: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  receiptBold: { fontWeight: '800', color: colors.brandBrown, fontSize: typography.fontSize.base },
  actions: { width: '100%' },
  homeLink: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing[2] },
});
