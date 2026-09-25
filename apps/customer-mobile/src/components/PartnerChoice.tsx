import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { PartnerOption } from '@wag/shared-types';
import { Icon, PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../lib/api';

type Tab = 'any' | 'choose' | 'past';

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
  /** Extra line under the "Find anyone" tab, e.g. the discount note. */
  anyHint?: string;
}

const ANY: PartnerChoiceValue = { assignmentMode: 'any', requestedPartnerId: null, requestedPartnerName: null, requestedPartnerDiscountPct: null };

/**
 * The three ways to get a partner: let anyone accept ("Find anyone"), pick from rated partner cards,
 * or re-book someone who has looked after a pet before. The server re-validates whatever is chosen.
 */
export function PartnerChoice({ type, petId, addressId, value, onChange, anyHint }: Props) {
  const [tab, setTab] = useState<Tab>(value.assignmentMode === 'specific' ? 'choose' : 'any');
  const [options, setOptions] = useState<PartnerOption[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tab === 'any' || !petId || !addressId) return;
    let cancelled = false;
    setOptions(null);
    setError('');
    wagApi.bookings
      .getPartnerOptions({ type, petId, addressId })
      .then((r) => { if (!cancelled) setOptions(r); })
      .catch((e: any) => { if (!cancelled) setError(e?.response?.data?.message ?? 'Could not load partners. Try again.'); });
    return () => { cancelled = true; };
  }, [tab, type, petId, addressId]);

  const visible = useMemo(() => {
    if (!options) return [];
    return tab === 'past' ? options.filter((o) => o.isPast) : options;
  }, [options, tab]);

  // A chosen partner who is no longer offered (e.g. went offline in another city) must not stay selected.
  useEffect(() => {
    if (options && value.requestedPartnerId && !options.some((o) => o.partnerId === value.requestedPartnerId)) {
      onChange(ANY);
    }
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickTab = (t: Tab) => {
    setTab(t);
    if (t === 'any') onChange(ANY);
  };

  const pick = (o: PartnerOption) => {
    if (value.requestedPartnerId === o.partnerId) onChange(ANY);
    else onChange({ assignmentMode: 'specific', requestedPartnerId: o.partnerId, requestedPartnerName: o.name, requestedPartnerDiscountPct: o.discountPct });
  };

  return (
    <View>
      <View style={styles.tabs}>
        {([['any', 'Find anyone'], ['choose', 'Choose partner'], ['past', 'Past partners']] as [Tab, string][]).map(([t, label]) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => pickTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'any' && (
        <Text style={styles.hint}>
          Your request goes to every available partner nearby and the first one to accept gets the job.{anyHint ? ` ${anyHint}` : ''}
        </Text>
      )}

      {tab !== 'any' && !options && !error && <ActivityIndicator style={{ marginVertical: spacing[4] }} color={colors.brandBrown} />}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {tab !== 'any' && options && visible.length === 0 && (
        <Text style={styles.hint}>
          {tab === 'past' ? 'You have not booked a partner with us before. Choose one from the list or let anyone accept.' : 'No partners are available for this booking yet. Try "Find anyone".'}
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
            <PetAvatar name={o.name} imageUrl={resolveMediaUrl(o.photoUrl)} size={48} />
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

      {tab !== 'any' && value.requestedPartnerId && (
        <Text style={styles.hint}>
          Only {value.requestedPartnerName ?? 'this partner'} will get your request. If they can't take it, you'll be asked to choose again.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.biscuitLight, borderRadius: radii.lg, padding: 3, marginBottom: spacing[3] },
  tab: { flex: 1, paddingVertical: spacing[2], borderRadius: radii.md, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brandBrown, fontWeight: '800' },
  hint: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: spacing[1] },
  error: { fontFamily: 'Inter', fontSize: 13, color: colors.error, marginVertical: spacing[2] },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, marginBottom: spacing[2] },
  cardSelected: { borderColor: colors.brandBrown, backgroundColor: colors.biscuitLight },
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
