import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { useBookingStore } from '../../../src/store/booking.store';
import type { GroomingPackage } from '@wag/shared-types';
import { goBack } from '../../../src/lib/nav';

// The server sends `inclusions`; older servers only send the raw `items` rows. Never assume either exists.
function servicesOf(pkg: GroomingPackage): string[] {
  const direct = Array.isArray(pkg.inclusions) ? pkg.inclusions : null;
  if (direct) return direct.filter((s) => typeof s === 'string' && s.trim());
  const items = (pkg as unknown as { items?: { description?: string }[] }).items;
  return Array.isArray(items) ? items.map((i) => i?.description ?? '').filter(Boolean) : [];
}

// Tags the server puts on a package; at most two are shown, most useful first.
const TAG_LABEL: Record<string, { label: string; tone: 'blue' | 'orange' | 'green' }> = {
  previously_booked: { label: 'Previously booked', tone: 'blue' },
  best_selling: { label: 'Best selling', tone: 'orange' },
  best_value: { label: 'Best value', tone: 'green' },
};

const norm = (t: string) => t.trim().toLowerCase();

/**
 * One line that makes the price ladder obvious: packages are listed cheapest first, so each one says what it adds on
 * top of the one before ("Everything in Basic, plus 3 more"), or just how many services it has.
 */
function ladderLine(prev: GroomingPackage | null, pkg: GroomingPackage): string {
  const mine = servicesOf(pkg);
  if (mine.length === 0) return '';
  if (prev) {
    const have = new Set(mine.map(norm));
    const before = servicesOf(prev);
    if (before.length > 0 && before.every((s) => have.has(norm(s)))) {
      const extra = mine.length - before.length;
      if (extra > 0) return `Everything in ${prev.name}, plus ${extra} more`;
    }
  }
  return `${mine.length} service${mine.length === 1 ? '' : 's'} included`;
}

export default function SelectPackageScreen() {
  const [packages, setPackages] = useState<GroomingPackage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { groomingDraft, updateGroomingDraft } = useBookingStore();

  const petId = groomingDraft.petId ?? undefined;
  useEffect(() => {
    let alive = true;
    setFailed(false);
    wagApi.bookings.getPackages(petId)
      .then((r) => { if (alive) setPackages(Array.isArray(r) ? r : []); })
      .catch(() => { if (alive) { setPackages((cur) => cur ?? []); setFailed(true); } });
    return () => { alive = false; };
  }, [attempt, petId]);

  const selectPackage = (pkg: GroomingPackage) => {
    updateGroomingDraft({ packageId: pkg.id, package: pkg });
    router.push('/booking/grooming/select-addons');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose a package</Text>
        <View style={{ width: 50 }} />
      </View>

      <Text style={styles.sub}>For {groomingDraft.pet?.name ?? 'your pet'}</Text>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {packages === null && <ActivityIndicator style={styles.state} color={colors.brandBrown} />}
        {packages !== null && packages.length === 0 && (
          <TouchableOpacity style={styles.state} onPress={() => { setPackages(null); setAttempt((a) => a + 1); }} accessibilityRole="button">
            <Text style={styles.stateText}>{failed ? "Couldn't load packages. Tap to try again." : 'No packages are available right now.'}</Text>
          </TouchableOpacity>
        )}
        {(packages ?? []).map((pkg, index, all) => {
          const isSelected = groomingDraft.packageId === pkg.id;
          const isExpanded = expanded === pkg.id;
          const services = servicesOf(pkg);
          const tags = (pkg.tags ?? []).filter((t) => TAG_LABEL[t]).slice(0, 2);
          const ladder = ladderLine(index > 0 ? all[index - 1]! : null, pkg);

          return (
            <TouchableOpacity
              key={pkg.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setExpanded(isExpanded ? null : pkg.id)}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={`${pkg.name} package, ₹${pkg.price}`}
            >
              {tags.length > 0 && (
                <View style={styles.tagRow}>
                  {tags.map((t) => (
                    <View key={t} style={[styles.tag, styles[`tag_${TAG_LABEL[t]!.tone}` as const]]}>
                      <Text style={[styles.tagText, styles[`tagText_${TAG_LABEL[t]!.tone}` as const]]}>{TAG_LABEL[t]!.label}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.cardHeader}>
                <View style={styles.nameCol}>
                  <View style={styles.nameRow}>
                    <Text style={styles.pkgName} numberOfLines={1}>{pkg.name}</Text>
                    {Number(pkg.mrp) > Number(pkg.price) && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>
                          {Math.round((1 - Number(pkg.price) / Number(pkg.mrp)) * 100)}% off
                        </Text>
                      </View>
                    )}
                  </View>
                  {!!pkg.description?.trim() && <Text style={styles.pkgDesc} numberOfLines={2}>{pkg.description.trim()}</Text>}
                  {!!ladder && <Text style={styles.ladder}>{ladder}</Text>}
                  {services.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setExpanded(isExpanded ? null : pkg.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isExpanded }}
                      accessibilityLabel={`${isExpanded ? 'View less' : 'View more'} about the ${pkg.name} package`}
                    >
                      <Text style={styles.viewMore}>{isExpanded ? 'View less ▲' : `View more (${services.length} services) ▼`}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.priceCol}>
                  <Text style={styles.price}>₹{pkg.price}</Text>
                  {Number(pkg.mrp) > Number(pkg.price) && (
                    <Text style={styles.mrp}>₹{pkg.mrp}</Text>
                  )}
                </View>
              </View>

              {/* Inclusions */}
              {isExpanded && services.length > 0 && (
                <View style={styles.inclusions}>
                  {services.map((item, i) => (
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
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  tag: { borderRadius: radii.full, paddingHorizontal: spacing[3], paddingVertical: 3 },
  tag_blue: { backgroundColor: colors.infoLight },
  tag_orange: { backgroundColor: colors.marigoldBg },
  tag_green: { backgroundColor: colors.successLight },
  tagText: { fontFamily: 'Inter', fontSize: 11, fontWeight: '800' },
  tagText_blue: { color: colors.info },
  tagText_orange: { color: colors.marigoldDark },
  tagText_green: { color: colors.success },
  ladder: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.brandBrown, marginTop: spacing[1] },
  state: { alignItems: 'center', paddingVertical: spacing[10] },
  stateText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, textAlign: 'center' },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], marginBottom: spacing[3], borderWidth: 1.5, borderColor: colors.borderLight },
  cardSelected: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[3] },
  nameCol: { flex: 1, minWidth: 0, marginRight: spacing[3] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 4 },
  pkgName: { flexShrink: 1, fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  discountBadge: { flexShrink: 0, backgroundColor: colors.successLight, borderRadius: radii.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  discountText: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.success },
  pkgDesc: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted },
  viewMore: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.marigoldDark, marginTop: spacing[2] },
  priceCol: { flexShrink: 0, alignItems: 'flex-end' },
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
