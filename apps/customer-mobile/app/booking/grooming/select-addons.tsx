import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { useBookingStore } from '../../../src/store/booking.store';
import type { AddOn } from '@wag/shared-types';

export default function SelectAddOnsScreen() {
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const { groomingDraft, updateGroomingDraft } = useBookingStore();

  useEffect(() => {
    wagApi.bookings.getAddOns().then(setAddOns).catch(() => {});
  }, []);

  const toggleAddOn = (addOn: AddOn) => {
    const current = groomingDraft.addOnIds;
    const exists = current.includes(addOn.id);
    const newIds = exists ? current.filter((id) => id !== addOn.id) : [...current, addOn.id];
    const newAddOns = exists
      ? groomingDraft.addOns.filter((a) => a.id !== addOn.id)
      : [...groomingDraft.addOns, addOn];
    updateGroomingDraft({ addOnIds: newIds, addOns: newAddOns });
  };

  const addOnsTotal = groomingDraft.addOns.reduce((s, a) => s + Number(a.price), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add-ons</Text>
        <View style={{ width: 50 }} />
      </View>
      <Text style={styles.sub}>Optional extras for {groomingDraft.pet?.name ?? 'your pet'}</Text>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {addOns.map((addOn) => {
          const selected = groomingDraft.addOnIds.includes(addOn.id);
          return (
            <TouchableOpacity
              key={addOn.id}
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => toggleAddOn(addOn)}
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.addOnName}>{addOn.name}</Text>
                {addOn.description && (
                  <Text style={styles.addOnDesc}>{addOn.description}</Text>
                )}
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.addOnPrice}>+₹{addOn.price}</Text>
                <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                  {selected && <Text style={{ color: colors.white, fontSize: 12, fontWeight: '800' }}>✓</Text>}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {groomingDraft.addOnIds.length > 0
              ? `${groomingDraft.addOnIds.length} add-on${groomingDraft.addOnIds.length > 1 ? 's' : ''} selected · +₹${addOnsTotal}`
              : 'No add-ons selected'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          onPress={() => router.push('/booking/grooming/select-date-time')}
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
  sub: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[5], marginBottom: spacing[4] },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[3], borderWidth: 1.5, borderColor: colors.borderLight },
  cardSelected: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: spacing[2] },
  addOnName: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  addOnDesc: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 3 },
  addOnPrice: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.brandBrown },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderMedium, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  summary: { backgroundColor: colors.marigoldBg, borderRadius: radii.lg, padding: spacing[4], marginTop: spacing[2] },
  summaryText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.marigoldDark, textAlign: 'center' },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
