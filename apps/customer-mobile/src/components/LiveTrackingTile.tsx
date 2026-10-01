import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { Icon, LiveMapView } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../lib/api';
import { useLiveRoute } from '../hooks/useLiveRoute';

interface Props {
  booking: any;
}

/**
 * A live map of the partner coming to the door, for the booking details page. Shown only while the partner is on
 * the way (the caller decides). Location and ETA arrive over the booking's realtime channel; the road path and a
 * first ETA come from the route endpoint. Call and Chat are one tap away.
 */
export function LiveTrackingTile({ booking }: Props) {
  const id: string = booking.id;
  const initial = useMemo(() => {
    const lat = booking.partner?.currentLat, lng = booking.partner?.currentLng;
    return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
  }, [booking.partner?.currentLat, booking.partner?.currentLng]);

  const [loc, setLoc] = useState<{ lat: number; lng: number; heading?: number } | null>(initial);
  const [socketEta, setSocketEta] = useState<number | null>(null);

  useEffect(() => {
    wagApi.realtime.connect();
    wagApi.realtime.joinBooking(id);
    const off = wagApi.realtime.on('partner:location_updated', (p: any) => {
      if (p.bookingId !== id) return;
      setLoc({ lat: p.lat, lng: p.lng, heading: p.heading ?? undefined });
      setSocketEta(typeof p.etaSeconds === 'number' ? p.etaSeconds : null);
    });
    return () => { off(); wagApi.realtime.disconnect(); };
  }, [id]);

  const live = useLiveRoute(id, true, loc ? { lat: loc.lat, lng: loc.lng } : null, socketEta);

  const dest = booking.address && typeof booking.address.lat === 'number'
    ? { lat: booking.address.lat, lng: booking.address.lng, label: 'You' }
    : null;
  const p = booking.partner?.user?.profile;
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Your partner';
  const phone: string | undefined = booking.partner?.user?.phone;
  const minutes = live.etaSeconds != null ? Math.max(1, Math.round(live.etaSeconds / 60)) : null;

  const call = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Could not open the dialer', phone));
  };

  return (
    <View style={styles.tile}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Live location</Text>
          <Text style={styles.title}>{minutes != null ? `${name} arrives in ${minutes} min` : `${name} is on the way`}</Text>
        </View>
        <View style={styles.pill}><View style={styles.dot} /><Text style={styles.pillText}>On the way</Text></View>
      </View>

      {loc ? (
        <LiveMapView
          partner={{ lat: loc.lat, lng: loc.lng, heading: loc.heading, label: name }}
          destination={dest}
          route={live.route}
          etaSeconds={live.etaSeconds}
          height={230}
        />
      ) : (
        <View style={styles.waiting}>
          <Icon name="pin" size={22} color={colors.textMuted} />
          <Text style={styles.waitingText}>Waiting for {name}'s location…</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => router.push({ pathname: '/booking/confirmed', params: { id } })} accessibilityLabel="Open full map">
          <Text style={styles.btnPrimaryText}>Open full map</Text>
        </TouchableOpacity>
        {!!phone && (
          <TouchableOpacity style={[styles.btn, styles.btnSquare]} onPress={call} accessibilityLabel={`Call ${name}`}>
            <Icon name="phone" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.btn, styles.btnSquare]} onPress={() => router.push({ pathname: '/messaging/[bookingId]', params: { bookingId: id } })} accessibilityLabel={`Chat with ${name}`}>
          <Icon name="chat" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing[4], marginBottom: spacing[5], gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  eyebrow: { fontFamily: 'Inter', fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
  title: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.marigold, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  pillText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '800', color: colors.white },
  waiting: { height: 230, borderRadius: radii.xl, backgroundColor: colors.biscuitLighter, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  waitingText: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing[2] },
  btn: { height: 46, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { flex: 1, backgroundColor: colors.brandBrown },
  btnPrimaryText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.white },
  btnSquare: { width: 52, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
});
