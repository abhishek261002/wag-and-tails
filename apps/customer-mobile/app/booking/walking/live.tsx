import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';

export default function LiveWalkScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
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

    // Poll every 5s for status updates
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const status = (booking as any)?.status ?? 'accepted';
  const partnerName = booking?.partner?.user?.profile
    ? `${booking.partner.user.profile.firstName} ${booking.partner.user.profile.lastName}`
    : 'Your Walker';

  const STATUS_MSG: Record<string, string> = {
    accepted: `${partnerName} accepted! Getting ready…`,
    partner_on_the_way: `${partnerName} is on the way to pick up ${booking?.petName ?? 'your dog'}`,
    arrived: `${partnerName} has arrived! 🎉`,
    in_progress: `Walk in progress 🐾`,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Live Walk</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status banner */}
        <View style={[styles.statusBanner, status === 'in_progress' && styles.statusBannerActive]}>
          <Text style={styles.statusEmoji}>
            {status === 'in_progress' ? '🏃' : status === 'arrived' ? '🎉' : '📍'}
          </Text>
          <Text style={styles.statusMsg}>{STATUS_MSG[status] ?? 'Walk in progress'}</Text>
        </View>

        {/* Map placeholder */}
        <View style={styles.mapPlaceholder}>
          <Text style={{ fontSize: 48 }}>🗺️</Text>
          <Text style={styles.mapText}>Live Map</Text>
          <Text style={styles.mapSub}>Partner location updates every 5 seconds</Text>
        </View>

        {/* Timer */}
        {status === 'in_progress' && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Walk time</Text>
            <Text style={styles.timerValue}>{formatTime(elapsed)}</Text>
            <Text style={styles.durationLeft}>
              of {booking?.durationMinutes ?? 30} min planned
            </Text>
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
            <Text style={styles.partnerRating}>
              ⭐ {booking?.partner?.rating ?? '5.0'} · {booking?.partner?.completedJobs ?? 0} walks
            </Text>
          </View>
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() => router.push({ pathname: '/messaging/[bookingId]', params: { bookingId: bookingId! } } as any)}
            accessibilityLabel="Message walker"
          >
            <Text style={{ fontSize: 22 }}>💬</Text>
          </TouchableOpacity>
        </View>

        {/* Pet care note reminder */}
        {booking?.petCareNotes && (
          <View style={styles.careNote}>
            <Text style={styles.careNoteTitle}>📝 Walker can see your pet's care notes</Text>
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
  statusEmoji: { fontSize: 28 },
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
  partnerRating: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  messageBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  careNote: { backgroundColor: colors.warningLight, borderRadius: radii.xl, padding: spacing[4] },
  careNoteTitle: { fontFamily: 'Inter', fontSize: 12, fontWeight: '800', color: colors.warning, marginBottom: 4 },
  careNoteText: { fontFamily: 'Inter', fontSize: 13, color: colors.warning },
});
