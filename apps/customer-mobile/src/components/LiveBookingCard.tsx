import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { Card, Icon, PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../lib/api';

interface Props {
  booking: any;
  /** ISO time the partner is expected, while on the way. */
  arrivalAt?: string;
  petPhoto?: string | null;
  /** Show the "Happening now" label (only on the first card). */
  showEyebrow?: boolean;
  onChanged: () => void;
}

const FINDING = new Set(['needs_partner', 'searching_partner']);

function partnerName(b: any): string | null {
  const p = b.partner?.user?.profile;
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ');
  return name || null;
}

function pill(b: any): { label: string; tone: 'orange' | 'brown' | 'green' } {
  switch (b.status) {
    case 'partner_on_the_way': return { label: 'On the way', tone: 'orange' };
    case 'arrived': return { label: 'Arrived', tone: 'green' };
    case 'in_progress': return { label: 'In progress', tone: 'green' };
    case 'assigned':
    case 'accepted': return { label: 'Partner assigned', tone: 'brown' };
    default: return { label: 'Finding a partner', tone: 'brown' };
  }
}

/** The Home "Happening now" card: what is going on with a booking, and the actions that matter right now. */
export function LiveBookingCard({ booking: b, arrivalAt, petPhoto, showEyebrow = true, onChanged }: Props) {
  const name = partnerName(b);
  const phone: string | undefined = b.partner?.user?.phone;
  const finding = FINDING.has(b.status);
  const onTheWay = b.status === 'partner_on_the_way';
  const service = b.type === 'grooming' ? (b.packageName ?? 'Grooming') : 'Dog walk';
  const p = pill(b);

  let sub: string;
  if (finding) sub = 'Looking for a partner near you…';
  else if (onTheWay) sub = `${name ?? 'Your partner'}${arrivalAt ? ` · Arriving ${format(new Date(arrivalAt), 'h:mm a')}` : ' · On the way'}`;
  else if (b.status === 'arrived') sub = `${name ?? 'Your partner'} has arrived`;
  else if (b.status === 'in_progress') sub = `${name ?? 'Your partner'} is with ${b.petName}`;
  else sub = `${name ?? 'Your partner'}${b.scheduledAt ? ` · ${format(new Date(b.scheduledAt), 'EEE, h:mm a')}` : ''}`;

  const details = () => router.push({ pathname: '/booking/[id]', params: { id: b.id } });
  const track = () => {
    if (b.type === 'walking' && b.status === 'in_progress') router.push({ pathname: '/booking/walking/live', params: { id: b.id } } as any);
    else router.push({ pathname: '/booking/confirmed', params: { id: b.id } });
  };
  const call = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Could not open the dialer', phone));
  };
  const cancel = () => {
    Alert.alert('Cancel this request?', 'We will stop looking for a partner.', [
      { text: 'Keep looking', style: 'cancel' },
      {
        text: 'Cancel request', style: 'destructive',
        onPress: async () => {
          try { await wagApi.bookings.cancel(b.id, 'Customer cancelled while searching'); onChanged(); }
          catch (err: any) { Alert.alert('Could not cancel', err?.message ?? 'Please try again.'); }
        },
      },
    ]);
  };

  return (
    <Card style={styles.card} onPress={details}>
      <View style={styles.top}>
        <Text style={styles.eyebrow}>{showEyebrow ? 'Happening now' : ' '}</Text>
        <View style={[styles.pill, p.tone === 'orange' ? styles.pillOrange : p.tone === 'green' ? styles.pillGreen : styles.pillBrown]}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>{p.label}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <PetAvatar name={b.petName ?? '?'} imageUrl={resolveMediaUrl(petPhoto ?? null)} size={52} ringState={onTheWay ? 'active' : 'idle'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>{service} · {b.petName}</Text>
          <Text style={styles.sub} numberOfLines={2}>{sub}</Text>
        </View>
        {!finding && (
          <View style={styles.partnerAvatar}>
            {b.partner?.photoUrl
              ? <PetAvatar name={name ?? 'Partner'} imageUrl={resolveMediaUrl(b.partner.photoUrl)} size={44} />
              : <Icon name="user" size={22} color={colors.white} />}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {onTheWay || b.status === 'arrived' || (b.type === 'walking' && b.status === 'in_progress') ? (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={track} accessibilityLabel="Track">
            <Text style={styles.btnPrimaryText}>Track</Text>
          </TouchableOpacity>
        ) : finding ? (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={details} accessibilityLabel="View request">
            <Text style={styles.btnPrimaryText}>View request</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={details} accessibilityLabel="Details">
            <Text style={styles.btnPrimaryText}>Details</Text>
          </TouchableOpacity>
        )}

        {!finding && !!phone && (
          <TouchableOpacity style={[styles.btn, styles.btnSquare]} onPress={call} accessibilityLabel={`Call ${name ?? 'partner'}`}>
            <Icon name="phone" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        )}

        {finding ? (
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={cancel} accessibilityLabel="Cancel request">
            <Text style={styles.btnOutlineText}>Cancel</Text>
          </TouchableOpacity>
        ) : (onTheWay || b.status === 'arrived' || (b.type === 'walking' && b.status === 'in_progress')) ? (
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={details} accessibilityLabel="Details">
            <Text style={styles.btnOutlineText}>Details</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing[4] },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  eyebrow: { fontFamily: 'Inter', fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  pillOrange: { backgroundColor: colors.marigold },
  pillBrown: { backgroundColor: colors.brandBrown },
  pillGreen: { backgroundColor: colors.success },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  pillText: { fontFamily: 'Inter', color: colors.white, fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  sub: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 3 },
  partnerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.marigold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  btn: { height: 46, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { flex: 1, backgroundColor: colors.brandBrown },
  btnPrimaryText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.white },
  btnSquare: { width: 52, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  btnOutline: { paddingHorizontal: spacing[5], borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  btnOutlineText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },
});
