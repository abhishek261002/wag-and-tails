import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Animated } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { format } from 'date-fns';

const WAITING_STATUSES = new Set(['pending_payment', 'confirmed', 'needs_partner']);
const TRACKING_STATUSES = new Set(['assigned', 'partner_on_the_way', 'arrived', 'in_progress']);

export default function BookingConfirmedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [partnerLoc, setPartnerLoc] = useState<{ lat: number; lng: number; timestamp: string } | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (id) wagApi.bookings.get(id).then(setBooking).catch(() => {});
  }, [id]);

  // Poll as a fallback while waiting for assignment, in case the realtime
  // connection drops — this is what actually surfaces "partner found"
  // without the customer needing to manually refresh.
  useEffect(() => {
    if (!id || !booking || !WAITING_STATUSES.has(booking.status)) return;
    const poll = setInterval(() => {
      wagApi.bookings.get(id).then(setBooking).catch(() => {});
    }, 4000);
    return () => clearInterval(poll);
  }, [id, booking?.status]);

  useEffect(() => {
    if (!id) return;
    wagApi.realtime.connect();
    wagApi.realtime.joinBooking(id);
    const offStatus = wagApi.realtime.on('booking:status_changed', (payload: any) => {
      if (payload.bookingId !== id) return;
      setBooking((prev: any) => (prev ? { ...prev, status: payload.status, partnerId: payload.partnerId ?? prev.partnerId } : prev));
    });
    const offLocation = wagApi.realtime.on('partner:location_updated', (payload: any) => {
      if (payload.bookingId !== id) return;
      setPartnerLoc({ lat: payload.lat, lng: payload.lng, timestamp: payload.timestamp });
    });
    return () => {
      offStatus();
      offLocation();
      wagApi.realtime.disconnect();
    };
  }, [id]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const handleShare = async () => {
    if (!booking) return;
    const text = `I've booked ${booking.type === 'grooming' ? 'a grooming session' : 'a dog walk'} for ${booking.petName} via Wag & Tails! 🐾`;
    await Share.share({ message: text });
  };

  const isWaiting = booking && WAITING_STATUSES.has(booking.status);
  const isTracking = booking && TRACKING_STATUSES.has(booking.status);

  if (isWaiting) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.waitingContainer}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.innerCircle}>
              <Text style={{ fontSize: 44 }}>🐾</Text>
            </View>
          </Animated.View>
          <Text style={styles.headline}>Fetching your partner…</Text>
          <Text style={styles.sub}>
            We've notified groomers near you. This usually takes a couple of minutes.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Success animation */}
        <View style={styles.successCircle}>
          <Text style={styles.successEmoji}>🎉</Text>
        </View>

        <Text style={styles.headline}>
          {isTracking ? 'Partner Assigned!' : 'Booking Confirmed!'}
        </Text>
        <Text style={styles.sub}>
          {isTracking
            ? `Your groomer is getting ready for ${booking?.petName ?? 'your pet'}.`
            : `Your booking for ${booking?.petName ?? 'your pet'} has been confirmed.`}
        </Text>

        {isTracking && booking?.startOtp && (
          <View style={styles.otpCard}>
            <Text style={styles.otpLabel}>Your start code</Text>
            <Text style={styles.otpValue}>{booking.startOtp}</Text>
            <Text style={styles.otpHint}>Share this with your groomer when they arrive</Text>
          </View>
        )}

        {isTracking && (
          <View style={styles.trackingCard}>
            {partnerLoc ? (
              <>
                <Text style={{ fontSize: 32 }}>📍</Text>
                <Text style={styles.trackingText}>Your groomer is on the way</Text>
                <Text style={styles.trackingSub}>
                  {partnerLoc.lat.toFixed(5)}, {partnerLoc.lng.toFixed(5)} · updated {new Date(partnerLoc.timestamp).toLocaleTimeString()}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 32 }}>🗺️</Text>
                <Text style={styles.trackingText}>Live location will appear here once your groomer heads out</Text>
              </>
            )}
          </View>
        )}

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
  waitingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[8] },
  pulseRing: { width: 160, height: 160, borderRadius: 80, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[6] },
  innerCircle: { width: 116, height: 116, borderRadius: 58, backgroundColor: colors.marigold, alignItems: 'center', justifyContent: 'center' },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[5] },
  successEmoji: { fontSize: 48 },
  headline: { fontFamily: 'Inter', fontSize: typography.fontSize['3xl'], fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing[2] },
  sub: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing[6] },
  otpCard: { width: '100%', backgroundColor: colors.brandBrown, borderRadius: radii.xl, padding: spacing[5], alignItems: 'center', marginBottom: spacing[4] },
  otpLabel: { fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  otpValue: { fontFamily: 'Inter', fontSize: 40, fontWeight: '800', color: colors.white, letterSpacing: 8, marginVertical: spacing[1] },
  otpHint: { fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  trackingCard: { width: '100%', backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[4] },
  trackingText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: spacing[2], textAlign: 'center' },
  trackingSub: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 4 },
  receipt: { width: '100%', backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[6] },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  receiptLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted },
  receiptValue: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  receiptBold: { fontWeight: '800', color: colors.brandBrown, fontSize: typography.fontSize.base },
  actions: { width: '100%' },
  homeLink: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing[2] },
});
