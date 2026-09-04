import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { useBookingStore } from '../../../src/store/booking.store';
import type { GroomingPackage } from '@wag/shared-types';

export default function SelectPackageScreen() {
  const [packages, setPackages] = useState<GroomingPackage[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { groomingDraft, updateGroomingDraft } = useBookingStore();

  useEffect(() => {
    wagApi.bookings.getPackages().then(setPackages).catch(() => {});
  }, []);

  const selectPackage = (pkg: GroomingPackage) => {
    updateGroomingDraft({ packageId: pkg.id, package: pkg });
    router.push('/booking/grooming/select-addons');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose a package</Text>
        <View style={{ width: 50 }} />
      </View>

      <Text style={styles.sub}>For {groomingDraft.pet?.name ?? 'your pet'}</Text>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {packages.map((pkg) => {
          const isSelected = groomingDraft.packageId === pkg.id;
          const isExpanded = expanded === pkg.id;

          return (
            <TouchableOpacity
              key={pkg.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setExpanded(isExpanded ? null : pkg.id)}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={`${pkg.name} package, ₹${pkg.price}`}
            >
              <View style={styles.cardHeader}>
                <View>
                  <View style={styles.nameRow}>
                    <Text style={styles.pkgName}>{pkg.name}</Text>
                    {Number(pkg.mrp) > Number(pkg.price) && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>
                          {Math.round((1 - Number(pkg.price) / Number(pkg.mrp)) * 100)}% off
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.pkgDesc} numberOfLines={isExpanded ? undefined : 1}>
                    {pkg.description}
                  </Text>
                </View>
                <View style={styles.priceCol}>
                  <Text style={styles.price}>₹{pkg.price}</Text>
                  {Number(pkg.mrp) > Number(pkg.price) && (
                    <Text style={styles.mrp}>₹{pkg.mrp}</Text>
                  )}
                </View>
              </View>

              {/* Inclusions */}
              {isExpanded && pkg.inclusions.length > 0 && (
                <View style={styles.inclusions}>
                  {pkg.inclusions.map((item, i) => (
                    <View key={i} style={styles.inclusionRow}>
                      <Text style={styles.check}>✓</Text>
                      <Text style={styles.inclusionText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Select button */}
              <TouchableOpacity
                style={[styles.selectBtn, isSelected && styles.selectBtnActive]}
                onPress={() => selectPackage(pkg)}
                accessibilityLabel={`Select ${pkg.name} package`}
              >
                <Text style={[styles.selectBtnText, isSelected && styles.selectBtnTextActive]}>
                  {isSelected ? '✓ Selected' : 'Select Package'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[2] },
  backText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  sub: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[5], marginBottom: spacing[4] },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], marginBottom: spacing[3], borderWidth: 1.5, borderColor: colors.borderLight },
  cardSelected: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[3] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 4 },
  pkgName: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  discountBadge: { backgroundColor: colors.successLight, borderRadius: radii.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  discountText: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.success },
  pkgDesc: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, maxWidth: '80%' },
  priceCol: { alignItems: 'flex-end' },
  price: { fontFamily: 'Inter', fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.brandBrown },
  mrp: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, textDecorationLine: 'line-through' },
  inclusions: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing[3], marginBottom: spacing[3] },
  inclusionRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  check: { color: colors.success, fontWeight: '700', fontSize: typography.fontSize.sm },
  inclusionText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 },
  selectBtn: { borderRadius: radii.lg, paddingVertical: spacing[3], alignItems: 'center', borderWidth: 2, borderColor: colors.brandBrown },
  selectBtnActive: { backgroundColor: colors.brandBrown },
  selectBtnText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.brandBrown },
  selectBtnTextActive: { color: colors.white },
});
