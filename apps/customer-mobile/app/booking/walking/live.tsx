import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PetAvatar, LiveMapView, Icon, type IconName } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../../../src/lib/api';

export default function LiveWalkScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [partnerLoc, setPartnerLoc] = useState<{ lat: number; lng: number; timestamp: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const b = await wagApi.bookings.get(bookingId!);
        setBooking(b);
        if (['in_progress', 'accepted', 'partner_on_the_way', 'arrived'].includes((b as any).status)) {
          timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
        }
      } catch {}
    };
    load();

    // Poll every 5s as a fallback in case the socket connection drops —
    // the realtime events below are what actually drive live updates.
    const pollInterval = setInterval(async () => {
      try {
        const b = await wagApi.bookings.get(bookingId!);
        setBooking(b);
        if ((b as any).status === 'completed') {
          clearInterval(pollInterval);
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeout(() => {
            router.replace({ pathname: '/booking/walking/summary', params: { id: bookingId } } as any);
          }, 1000);
        }
      } catch {}
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    wagApi.realtime.connect();
    wagApi.realtime.joinBooking(bookingId);

    const offStatus = wagApi.realtime.on('booking:status_changed', (payload: any) => {
      if (payload.bookingId !== bookingId) return;
      setBooking((prev: any) => (prev ? { ...prev, status: payload.status, endOtp: payload.endOtp ?? prev.endOtp } : prev));
      if (payload.status === 'completed') {
        setTimeout(() => {
          router.replace({ pathname: '/booking/walking/summary', params: { id: bookingId } } as any);
        }, 1000);
      }
    });
    const offLocation = wagApi.realtime.on('partner:location_updated', (payload: any) => {
      if (payload.bookingId !== bookingId) return;
      setPartnerLoc({ lat: payload.lat, lng: payload.lng, timestamp: payload.timestamp });
    });

    return () => {
      offStatus();
      offLocation();
      wagApi.realtime.disconnect();
    };
  }, [bookingId]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const status = (booking as any)?.status ?? 'accepted';
  // The end code stays hidden until the planned duration has actually
  // elapsed — mirrored on the partner's own screen (walk/[id].tsx) so
  // they can't get ahead of the customer.
  const durationSeconds = ((booking as any)?.durationMinutes ?? 30) * 60;
  const timerDone = elapsed >= durationSeconds;
  const partnerName = booking?.partner?.user?.profile
    ? `${booking.partner.user.profile.firstName} ${booking.partner.user.profile.lastName}`
    : 'Your Walker';

  const STATUS_MSG: Record<string, string> = {
    accepted: `${partnerName} accepted! Getting ready…`,
    partner_on_the_way: `${partnerName} is on the way to pick up ${booking?.petName ?? 'your dog'}`,
    arrived: `${partnerName} has arrived!`,
    in_progress: `Walk in progress`,
  };
  const STATUS_ICON: Record<string, IconName> = {
    in_progress: 'route',
    arrived: 'check',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Live Walk</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status banner */}
        <View style={[styles.statusBanner, status === 'in_progress' && styles.statusBannerActive]}>
          <Icon name={STATUS_ICON[status] ?? 'pin'} size={24} color={status === 'in_progress' ? colors.success : colors.marigoldDark} />
          <Text style={styles.statusMsg}>{STATUS_MSG[status] ?? 'Walk in progress'}</Text>
        </View>

        {/* Live location, embedded — see packages/ui-mobile/src/LiveMapView
            for the Ola Maps integration point (falls back to keyless OSM
            tiles until real credentials are configured). */}
        {partnerLoc || booking?.address ? (
          <LiveMapView
            partner={partnerLoc ? { lat: partnerLoc.lat, lng: partnerLoc.lng, label: partnerName } : null}
            destination={booking?.address ? { lat: booking.address.lat, lng: booking.address.lng, label: 'Pickup' } : null}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <Icon name="nav" size={44} color={colors.textDisabled} />
            <Text style={styles.mapText}>Waiting for location…</Text>
            <Text style={styles.mapSub}>Updates live once {partnerName} starts moving</Text>
          </View>
        )}

        {/* Arrival code — the customer reads this out to the walker once
            they arrive; entering it server-side is what starts the walk. */}
        {(status === 'partner_on_the_way' || status === 'arrived') && booking?.startOtp && (
          <View style={styles.otpCard}>
            <Text style={styles.otpLabel}>Your start code</Text>
            <Text style={styles.otpValue}>{booking.startOtp}</Text>
            <Text style={styles.otpHint}>Share this with {partnerName} when they arrive</Text>
          </View>
        )}

        {/* Timer */}
        {status === 'in_progress' && (
          <View style={styles.timerCard}>
            <PetAvatar
              name={booking?.petName ?? 'Your Pet'}
              imageUrl={resolveMediaUrl(booking?.pet?.avatarUrl)}
              size={80}
              ringState="walking"
              style={{ marginBottom: spacing[4] }}
            />
            <Text style={styles.timerLabel}>{timerDone ? 'Time\'s up!' : 'Walk time'}</Text>
            <Text style={styles.timerValue}>{formatTime(elapsed)}</Text>
            <Text style={styles.durationLeft}>
              of {booking?.durationMinutes ?? 30} min planned
            </Text>
          </View>
        )}

        {/* End code — held back until the timer above finishes, even
            though the server generates it the moment the walk starts. */}
        {status === 'in_progress' && timerDone && booking?.endOtp && (
          <View style={[styles.otpCard, { backgroundColor: colors.success }]}>
            <Text style={styles.otpLabel}>Your end code</Text>
            <Text style={styles.otpValue}>{booking.endOtp}</Text>
            <Text style={styles.otpHint}>Share this with {partnerName} to finish the walk</Text>
          </View>
        )}

        {/* Partner card */}
        <View style={styles.partnerCard}>
          <View style={styles.partnerAvatar}>
            <Text style={{ fontSize: 28, color: colors.white }}>
              {partnerName.charAt(0)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerName}>{partnerName}</Text>
            <View style={styles.partnerRatingRow}>
              <Icon name="star" size={12} color={colors.marigoldDark} variant="fill" />
              <Text style={styles.partnerRating}>
                {booking?.partner?.rating ?? '5.0'} · {booking?.partner?.completedJobs ?? 0} walks
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() => router.push({ pathname: '/messaging/[bookingId]', params: { bookingId: bookingId! } } as any)}
            accessibilityLabel="Message walker"
          >
            <Icon name="chat" size={20} color={colors.marigoldDark} />
          </TouchableOpacity>
        </View>

        {/* Pet care note reminder */}
        {booking?.petCareNotes && (
          <View style={styles.careNote}>
            <View style={styles.careNoteTitleRow}>
              <Icon name="doc" size={13} color={colors.warning} />
              <Text style={styles.careNoteTitle}>Walker can see your pet's care notes</Text>
            </View>
            <Text style={styles.careNoteText} numberOfLines={2}>{booking.petCareNotes}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  title: { fontFamily: 'Inter', fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  statusBanner: { backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[4] },
  statusBannerActive: { backgroundColor: colors.successLight },
  statusMsg: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  mapPlaceholder: { height: 240, backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  mapText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: spacing[2] },
  mapSub: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 4 },
  timerCard: { backgroundColor: colors.brandBrown, borderRadius: radii.xl, padding: spacing[5], alignItems: 'center', marginBottom: spacing[4] },
  timerLabel: { fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  timerValue: { fontFamily: 'Inter', fontSize: 48, fontWeight: '800', color: colors.white, marginVertical: spacing[1] },
  durationLeft: { fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  partnerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[4] },
  partnerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  partnerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  partnerRating: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted },
  messageBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  careNote: { backgroundColor: colors.warningLight, borderRadius: radii.xl, padding: spacing[4] },
  careNoteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  careNoteTitle: { fontFamily: 'Inter', fontSize: 12, fontWeight: '800', color: colors.warning },
  careNoteText: { fontFamily: 'Inter', fontSize: 13, color: colors.warning },
  otpCard: { backgroundColor: colors.brandBrown, borderRadius: radii.xl, padding: spacing[5], alignItems: 'center', marginBottom: spacing[4] },
  otpLabel: { fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  otpValue: { fontFamily: 'Inter', fontSize: 40, fontWeight: '800', color: colors.white, letterSpacing: 8, marginVertical: spacing[1] },
  otpHint: { fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
});
