import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { useKeepAwake } from 'expo-keep-awake';
import {
  NavigationTracker, cumulativeDistances, routeAhead, routeFromResponse, formatDistance, formatDuration,
  type Maneuver, type NavState, type RouteInfo,
} from '@wag/shared-types';
import { Button, Icon, LiveMapView } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { useJobLocationBroadcast } from '../../src/hooks/useJobLocationBroadcast';
import { goBack } from '../../src/lib/nav';

const REROUTE_COOLDOWN_MS = 15_000;

const ARROW: Record<Maneuver, string> = {
  depart: '⬆️', straight: '⬆️', 'slight-left': '↖️', 'turn-left': '⬅️', 'sharp-left': '↙️', 'slight-right': '↗️', 'turn-right': '➡️',
  'sharp-right': '↘️', uturn: '↩️', roundabout: '🔄', merge: '⤴️', arrive: '📍', other: '⬆️',
};

// Full-screen turn-by-turn directions to the customer, in the style of a driving app: the map follows the
// partner with the road ahead highlighted, a banner shows the next manoeuvre, and prompts are spoken.
// Falls back gracefully: if no routing provider answers, a straight-line estimate is shown and Google Maps
// can be opened instead.
export default function NavigateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useKeepAwake();

  const [booking, setBooking] = useState<any>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [state, setState] = useState<NavState | null>(null);
  const [follow, setFollow] = useState(true);
  const [voice, setVoice] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState('');
  const [arriving, setArriving] = useState(false);

  const position = useJobLocationBroadcast(true, { navigation: true });
  const trackerRef = useRef<NavigationTracker | null>(null);
  const lastRerouteRef = useRef(0);
  const fetchingRef = useRef(false);
  const cumRef = useRef<number[]>([]);

  useEffect(() => {
    if (!id) return;
    wagApi.bookings.get(id).then(setBooking).catch(() => setError('Could not load this job.'));
    return () => { Speech.stop(); };
  }, [id]);

  const destination = booking?.address ? { lat: booking.address.lat, lng: booking.address.lng, label: 'Customer' } : null;

  // (Re)fetch the route from where the partner is right now.
  const loadRoute = useCallback(async (from: { lat: number; lng: number }, isReroute: boolean) => {
    if (!id || fetchingRef.current) return;
    fetchingRef.current = true;
    if (isReroute) setRerouting(true);
    try {
      const res = await wagApi.bookings.getRoute(id, from);
      if (!res.available) { setError('Waiting for your location…'); return; }
      const r = routeFromResponse(res);
      trackerRef.current = new NavigationTracker(r);
      cumRef.current = cumulativeDistances(r.geometry);
      setRoute(r);
      setError('');
      if (isReroute && voice) Speech.speak('Route updated', { language: 'en-IN' });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not get directions. Check your connection.');
    } finally {
      fetchingRef.current = false;
      setRerouting(false);
    }
  }, [id, voice]);

  // First fix: get the initial route.
  useEffect(() => {
    if (position && !route && !fetchingRef.current) loadRoute(position, false);
  }, [position, route, loadRoute]);

  // Every fix: advance along the route, speak what is due, and re-route if we have left it.
  useEffect(() => {
    if (!position || !trackerRef.current) return;
    const st = trackerRef.current.update({ lat: position.lat, lng: position.lng, heading: position.heading, accuracy: position.accuracy, t: position.t });
    setState(st);
    if (voice) st.announcements.forEach((a) => Speech.speak(a, { language: 'en-IN', rate: 0.95 }));
    if (st.offRoute && Date.now() - lastRerouteRef.current > REROUTE_COOLDOWN_MS) {
      lastRerouteRef.current = Date.now();
      loadRoute(position, true);
    }
  }, [position, voice, loadRoute]);

  const currentStep = route && state ? route.steps[state.nextStepIndex ?? state.currentStepIndex] : null;
  const ahead = useMemo(
    () => (route && state ? routeAhead(route.geometry, cumRef.current, state.progressM, state.snapped) : route?.geometry ?? null),
    [route, state]
  );

  const openGoogleMaps = () => {
    if (!destination) return;
    const { lat, lng } = destination;
    const url = Platform.OS === 'android'
      ? `google.navigation:q=${lat},${lng}&mode=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`));
  };

  const arrived = async () => {
    if (!id) return;
    setArriving(true);
    try {
      // Already marked arrived (e.g. tapped twice) is fine.
      if (booking?.status !== 'arrived') await wagApi.partner.markArrived(id);
      Speech.stop();
      goBack();
    } catch (err: any) {
      Alert.alert('Could not update', err?.response?.data?.message ?? err?.message ?? 'Please try again.');
    } finally {
      setArriving(false);
    }
  };

  const nextMeters = state?.distanceToNextM ?? 0;
  const approximate = route?.approximate;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.mapWrap}>
        <LiveMapView
          partner={position ? { lat: state?.snapped.lat ?? position.lat, lng: state?.snapped.lng ?? position.lng, heading: position.heading ?? state?.routeBearing, label: 'You' } : null}
          destination={destination}
          route={ahead}
          follow={follow && !!position}
          onUserPan={() => setFollow(false)}
          height={560}
        />
      </View>

      {/* Next manoeuvre */}
      <View style={styles.top}>
        <TouchableOpacity onPress={() => { Speech.stop(); goBack(); }} style={styles.close} accessibilityLabel="Close navigation">
          <Icon name="close" size={18} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {!route ? (
            <Text style={styles.instruction}>{error || (position ? 'Finding the best route…' : 'Getting your location…')}</Text>
          ) : state?.arrived ? (
            <Text style={styles.instruction}>You have arrived</Text>
          ) : rerouting ? (
            <Text style={styles.instruction}>Rerouting…</Text>
          ) : (
            <>
              <Text style={styles.distance}>{formatDistance(nextMeters)}</Text>
              <Text style={styles.instruction} numberOfLines={2}>{currentStep?.instruction ?? 'Continue'}</Text>
            </>
          )}
        </View>
        {route && !state?.arrived && !rerouting && <Text style={styles.arrow}>{ARROW[currentStep?.maneuver ?? 'straight']}</Text>}
      </View>

      {approximate && (
        <View style={styles.warn}>
          <Text style={styles.warnText}>Live directions are unavailable, so this is a straight-line estimate.</Text>
          <TouchableOpacity onPress={openGoogleMaps}><Text style={styles.warnLink}>Open Google Maps</Text></TouchableOpacity>
        </View>
      )}

      {!follow && !!position && (
        <TouchableOpacity style={styles.recenter} onPress={() => setFollow(true)} accessibilityLabel="Re-centre map">
          <Text style={styles.recenterText}>Re-centre</Text>
        </TouchableOpacity>
      )}

      {/* Trip summary and actions */}
      <View style={styles.bottom}>
        {route && state ? (
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.eta}>{formatDuration(state.remainingS)}</Text>
              <Text style={styles.sub}>{formatDistance(state.remainingM)} · arrive {new Date(Date.now() + state.remainingS * 1000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</Text>
            </View>
            <TouchableOpacity onPress={() => { setVoice((v) => !v); Speech.stop(); }} style={styles.voiceBtn} accessibilityLabel={voice ? 'Mute voice' : 'Unmute voice'}>
              <Text style={{ fontSize: 20 }}>{voice ? '🔊' : '🔇'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.summaryRow}>
            {error ? <Text style={styles.sub}>{error}</Text> : <ActivityIndicator color={colors.brandBrown} />}
            {!!error && position && <TouchableOpacity onPress={() => loadRoute(position, false)}><Text style={styles.warnLink}>Try again</Text></TouchableOpacity>}
          </View>
        )}
        <View style={styles.actions}>
          <Button variant="outline" onPress={openGoogleMaps} style={{ flex: 1 }}>Google Maps</Button>
          <Button onPress={arrived} loading={arriving} style={{ flex: 1.4 }}>{state?.arrived ? "I've arrived" : "I've arrived"}</Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  mapWrap: { ...StyleSheet.absoluteFill as any },
  top: { position: 'absolute', top: spacing[4], left: spacing[3], right: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: '#0F5132', borderRadius: radii.xl, padding: spacing[4], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  distance: { fontFamily: 'Inter', fontSize: 26, fontWeight: '800', color: colors.white },
  instruction: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.white },
  arrow: { fontSize: 34 },
  warn: { position: 'absolute', top: 108, left: spacing[3], right: spacing[3], backgroundColor: colors.warningLight, borderRadius: radii.lg, padding: spacing[3], gap: 4 },
  warnText: { fontFamily: 'Inter', fontSize: 12, color: colors.textPrimary },
  warnLink: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.brandBrown },
  recenter: { position: 'absolute', right: spacing[4], bottom: 190, backgroundColor: colors.white, borderRadius: radii.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2], elevation: 4 },
  recenterText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.brandBrown },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, borderTopLeftRadius: radii['2xl'] ?? 24, borderTopRightRadius: radii['2xl'] ?? 24, padding: spacing[5], gap: spacing[4], elevation: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eta: { fontFamily: 'Inter', fontSize: 24, fontWeight: '800', color: colors.success },
  sub: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  voiceBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: spacing[3] },
});
