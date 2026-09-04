import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { format } from 'date-fns';

export default function WalkSummaryScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [tip, setTip] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (bookingId) wagApi.bookings.get(bookingId).then(setBooking).catch(() => {});
  }, [bookingId]);

  const TIP_OPTIONS = [0, 25, 50, 100];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await wagApi.client.post(`/bookings/${bookingId}/review`, { rating, comment, tip });
      Alert.alert('Thank you! 🐾', 'Your review has been submitted.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/home') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const partnerName = booking?.partner?.user?.profile
    ? `${booking.partner.user.profile.firstName} ${booking.partner.user.profile.lastName}`
    : 'Your Walker';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.completedBadge}>
            <Text style={{ fontSize: 48 }}>🏁</Text>
          </View>
          <Text style={styles.headline}>Walk Complete!</Text>
          <Text style={styles.sub}>
            {booking?.petName ?? 'Your dog'} had a great walk with {partnerName}
          </Text>
        </View>

        {/* Stats */}
        {booking && (
          <View style={styles.statsRow}>
            <StatBox emoji="⏱" label="Duration" value={`${booking.durationMinutes} min`} />
            <StatBox emoji="📍" label="Route" value="1.8 km" />
            <StatBox emoji="💰" label="Total" value={`₹${booking.total}`} />
          </View>
        )}

        {/* Photos from walk */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📸 Walk Photos</Text>
          <View style={styles.photosPlaceholder}>
            <Text style={{ fontSize: 36 }}>📷</Text>
            <Text style={styles.photosText}>Photos will appear here once the walker uploads them</Text>
          </View>
        </View>

        {/* Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate {partnerName}</Text>
          <View style={styles.starsRow}>
            {[1,2,3,4,5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} accessibilityLabel={`Rate ${s} stars`}>
                <Text style={[styles.star, s <= rating && styles.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Write a review (optional)"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            accessibilityLabel="Write a review"
          />
        </View>

        {/* Tip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add a Tip 💝</Text>
          <View style={styles.tipRow}>
            {TIP_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tipBtn, tip === t && styles.tipBtnActive]}
                onPress={() => setTip(tip === t ? null : t)}
                accessibilityRole="radio"
                accessibilityState={{ selected: tip === t }}
              >
                <Text style={[styles.tipText, tip === t && styles.tipTextActive]}>
                  {t === 0 ? 'Skip' : `₹${t}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button onPress={handleSubmit} fullWidth loading={submitting} style={styles.submitBtn}>
          Submit Review & Pay{tip ? ` (+₹${tip} tip)` : ''}
        </Button>

        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={{ fontSize: 24, marginBottom: spacing[1] }}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
  header: { alignItems: 'center', paddingVertical: spacing[8] },
  completedBadge: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  headline: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  sub: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2] },
  statsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  statBox: { flex: 1, backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  statValue: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, marginTop: 2 },
  section: { marginBottom: spacing[5] },
  sectionTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[3] },
  photosPlaceholder: { height: 120, backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  photosText: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2], paddingHorizontal: spacing[4] },
  starsRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  star: { fontSize: 36, color: colors.borderMedium },
  starActive: { color: colors.marigold },
  reviewInput: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.borderLight, padding: spacing[4], fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary, minHeight: 80 },
  tipRow: { flexDirection: 'row', gap: spacing[3] },
  tipBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, alignItems: 'center', backgroundColor: colors.white },
  tipBtnActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  tipText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  tipTextActive: { color: colors.white },
  submitBtn: { marginBottom: spacing[3] },
  skipBtn: { alignItems: 'center', paddingVertical: spacing[2] },
  skipText: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted },
});
