import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { useBookingStore } from '../../../src/store/booking.store';

const DURATIONS = [30, 45, 60] as const;

export default function SelectDurationScreen() {
  const { walkDraft, updateWalkDraft } = useBookingStore();
  const [pricing, setPricing] = useState<Record<number, number>>({});

  useEffect(() => {
    wagApi.client.get<any[]>('/walking/pricing').then((data) => {
      const map: Record<number, number> = {};
      data.forEach((p: any) => { map[p.durationMinutes] = Number(p.price); });
      setPricing(map);
    }).catch(() => {});
  }, []);

  const DETAILS: Record<number, string> = {
    30: 'A quick refresher — great for high-energy dogs',
    45: 'Standard walk — most popular choice',
    60: 'Extended adventure — perfect for active breeds',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Walk Duration</Text>
        <View style={{ width: 50 }} />
      </View>

      <Text style={styles.sub}>For {walkDraft.pet?.name ?? 'your dog'}</Text>

      <View style={styles.content}>
        {DURATIONS.map((d) => {
          const active = walkDraft.durationMinutes === d;
          const price = pricing[d];
          return (
            <TouchableOpacity
              key={d}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => updateWalkDraft({ durationMinutes: d })}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.durationCircle, active && styles.durationCircleActive]}>
                <Text style={[styles.durationMin, active && styles.durationMinActive]}>{d}</Text>
                <Text style={[styles.durationLabel, active && styles.durationLabelActive]}>min</Text>
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>
                  {d} Minute Walk
                </Text>
                <Text style={styles.cardDesc}>{DETAILS[d]}</Text>
              </View>
              <Text style={[styles.price, active && styles.priceActive]}>
                {price ? `₹${price}` : '…'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Button
          onPress={() => router.push('/booking/walking/schedule')}
          fullWidth
        >
          Continue →
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[2] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  sub: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[5], marginBottom: spacing[5] },
  content: { flex: 1, paddingHorizontal: spacing[5], gap: spacing[3] },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1.5, borderColor: colors.borderLight },
  cardActive: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  durationCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  durationCircleActive: { backgroundColor: colors.marigold },
  durationMin: { fontFamily: 'Inter', fontSize: 22, fontWeight: '800', color: colors.brandBrown },
  durationMinActive: { color: colors.white },
  durationLabel: { fontFamily: 'Inter', fontSize: 10, color: colors.textMuted },
  durationLabelActive: { color: colors.white },
  cardText: { flex: 1 },
  cardTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cardTitleActive: { color: colors.marigoldDark },
  cardDesc: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 3 },
  price: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.brandBrown },
  priceActive: { color: colors.marigoldDark },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
