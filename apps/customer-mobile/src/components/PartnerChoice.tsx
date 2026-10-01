import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import type { PartnerOption } from '@wag/shared-types';
import { BottomSheet, Icon, PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../lib/api';

type Tab = 'all' | 'past';

export interface PartnerChoiceValue {
  assignmentMode: 'any' | 'specific';
  requestedPartnerId: string | null;
  requestedPartnerName: string | null;
  /** Percent off the service price this partner offers right now (shown at checkout; the server re-checks at claim). */
  requestedPartnerDiscountPct: number | null;
}

interface Props {
  type: 'grooming' | 'walking';
  petId: string | null;
  addressId: string | null;
  value: PartnerChoiceValue;
  onChange: (v: PartnerChoiceValue) => void;
  /** Extra line under "Find Instantly", e.g. the discount note. */
  anyHint?: string;
}

const ANY: PartnerChoiceValue = { assignmentMode: 'any', requestedPartnerId: null, requestedPartnerName: null, requestedPartnerDiscountPct: null };

/**
 * Two ways to get a partner, as two full-width buttons:
 *  - "Find Instantly": the job goes to everyone available and the first to accept gets it (no list here);
 *  - "Choose Partner": a drawer slides up with every partner in the area, and a tab for partners the customer has
 *    booked before. Picking one closes the drawer and shows the choice under the buttons.
 * The server re-validates whatever is chosen.
 */
export function PartnerChoice({ type, petId, addressId, value, onChange, anyHint }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [options, setOptions] = useState<PartnerOption[] | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const specific = value.assignmentMode === 'specific' && !!value.requestedPartnerId;
  const ready = !!petId && !!addressId;

  // The partner list is only needed while choosing, or to confirm an earlier choice is still on offer.
  const needList = open || specific;
  useEffect(() => {
    if (!needList || !ready) return;
    let cancelled = false;
    setError('');
    wagApi.bookings
      .getPartnerOptions({ type, petId: petId!, addressId: addressId! })
      .then((r) => { if (!cancelled) setOptions(r); })
      .catch((e: any) => { if (!cancelled) setError(e?.response?.data?.message ?? 'Could not load partners. Please try again.'); });
    return () => { cancelled = true; };
  }, [needList, ready, type, petId, addressId, reloadKey, open]);

  // A chosen partner who is no longer offered (e.g. went offline) must not stay selected.
  useEffect(() => {
    if (options && value.requestedPartnerId && !options.some((o) => o.partnerId === value.requestedPartnerId)) onChange(ANY);
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    if (!options) return [];
    return tab === 'past' ? options.filter((o) => o.isPast) : options;
  }, [options, tab]);

  const chosen = useMemo(() => options?.find((o) => o.partnerId === value.requestedPartnerId) ?? null, [options, value.requestedPartnerId]);

  const close = useCallback(() => setOpen(false), []);

  const pick = (o: PartnerOption) => {
    onChange({ assignmentMode: 'specific', requestedPartnerId: o.partnerId, requestedPartnerName: o.name, requestedPartnerDiscountPct: o.discountPct });
    setOpen(false);
  };

  return (
    <View>
      <ChoiceButton
        label="Find Instantly"
        icon="spark"
        selected={!specific}
        onPress={() => { onChange(ANY); }}
      />
      <View style={{ height: spacing[3] }} />
      <ChoiceButton
        label="Choose Partner"
        icon="user"
        selected={specific}
        onPress={() => { setTab('all'); setOpen(true); }}
      />

      {!specific ? (
        <Text style={styles.hint}>
          Your request goes to every available partner nearby and the first one to accept gets the job.{anyHint ? ` ${anyHint}` : ''}
        </Text>
      ) : (
        <View style={styles.chosen}>
          <PetAvatar name={value.requestedPartnerName ?? 'Partner'} imageUrl={resolveMediaUrl(chosen?.photoUrl ?? null)} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{value.requestedPartnerName ?? 'Your partner'}</Text>
            <Text style={styles.meta}>
              {chosen ? `${chosen.rating.toFixed(1)} ★ · ${chosen.completedJobs} jobs` : 'Selected'}
              {value.requestedPartnerDiscountPct != null ? ` · ${value.requestedPartnerDiscountPct}% off` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setTab('all'); setOpen(true); }} accessibilityLabel="Change partner">
            <Text style={styles.change}>Change</Text>
          </TouchableOpacity>
        </View>
      )}
      {specific && (
        <Text style={styles.hint}>
          Only {value.requestedPartnerName ?? 'this partner'} will get your request. If they can't take it, you'll be asked to choose again.
        </Text>
      )}

      <BottomSheet visible={open} onDismiss={close} snapPoints="90%">
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Choose a partner</Text>
            <Text style={styles.sheetSub}>Partners available for your address</Text>
          </View>
          <TouchableOpacity onPress={close} style={styles.closeBtn} accessibilityLabel="Close">
            <Icon name="close" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          {([['all', 'All partners'], ['past', 'Past partners']] as [Tab, string][]).map(([t, label]) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
          {!ready && <Text style={styles.hint}>Choose a pet and an address first to see who is available.</Text>}
          {ready && !options && !error && <ActivityIndicator style={{ marginVertical: spacing[6] }} color={colors.brandBrown} />}
          {!!error && (
            <View>
              <Text style={styles.error}>{error}</Text>
              <TouchableOpacity onPress={() => setReloadKey((k) => k + 1)}><Text style={styles.change}>Try again</Text></TouchableOpacity>
            </View>
          )}
          {ready && options && visible.length === 0 && (
            <Text style={styles.hint}>
              {tab === 'past' ? 'You have not booked a partner with us before. Pick one from All partners, or use Find Instantly.' : 'No partners are available for this booking right now. Try Find Instantly.'}
            </Text>
          )}

          {visible.map((o) => {
            const selected = value.requestedPartnerId === o.partnerId;
            return (
              <TouchableOpacity
                key={o.partnerId}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => pick(o)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${o.name}, rated ${o.rating.toFixed(1)}`}
              >
                <PetAvatar name={o.name} imageUrl={resolveMediaUrl(o.photoUrl)} size={52} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{o.name}</Text>
                    {o.isOnline && <View style={styles.onlineDot} />}
                  </View>
                  <View style={styles.metaRow}>
                    <Icon name="star" size={13} color={colors.brandBrown} />
                    <Text style={styles.meta}>
                      {o.rating.toFixed(1)}{o.reviewCount > 0 ? ` (${o.reviewCount})` : ''} · {o.completedJobs} job{o.completedJobs === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {o.discountPct != null && <Text style={styles.offer}>{o.discountPct}% off this service</Text>}
                  {o.isPast && <Text style={styles.past}>Booked {o.timesBookedByYou} time{o.timesBookedByYou === 1 ? '' : 's'} before</Text>}
                </View>
                <View style={[styles.radio, selected && styles.radioActive]}>
                  {selected && <Icon name="check" size={13} color={colors.white} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function ChoiceButton({ label, icon, selected, onPress }: { label: string; icon: 'spark' | 'user'; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.choiceBtn, selected && styles.choiceBtnSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      activeOpacity={0.85}
    >
      <Icon name={icon} size={18} color={colors.white} />
      <Text style={styles.choiceText}>{label}</Text>
      <View style={styles.choiceCheck}>{selected && <Icon name="check" size={14} color={colors.white} />}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Two full-width brown buttons with white text; the selected one gets a marigold ring and a check.
  choiceBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], height: 54, paddingHorizontal: spacing[5], borderRadius: radii.xl, backgroundColor: colors.brandBrown, borderWidth: 2, borderColor: colors.brandBrown },
  choiceBtnSelected: { borderColor: colors.marigold },
  choiceText: { flex: 1, fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.white },
  choiceCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: spacing[3] },
  error: { fontFamily: 'Inter', fontSize: 13, color: colors.error, marginBottom: spacing[2] },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.brandBrown, backgroundColor: colors.biscuitLighter, marginTop: spacing[3] },
  change: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.marigoldDark },

  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  sheetTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  sheetSub: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: colors.biscuitLight, borderRadius: radii.lg, padding: 3, marginHorizontal: spacing[5], marginBottom: spacing[3] },
  tab: { flex: 1, paddingVertical: spacing[2], borderRadius: radii.md, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brandBrown, fontWeight: '800' },
  sheetList: { paddingHorizontal: spacing[5], paddingBottom: spacing[8] },

  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, marginBottom: spacing[2] },
  cardSelected: { borderColor: colors.brandBrown, backgroundColor: colors.biscuitLighter },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted },
  offer: { fontFamily: 'Inter', fontSize: 12, color: colors.success, marginTop: 2, fontWeight: '800' },
  past: { fontFamily: 'Inter', fontSize: 12, color: colors.brandBrown, marginTop: 2, fontWeight: '600' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
});
