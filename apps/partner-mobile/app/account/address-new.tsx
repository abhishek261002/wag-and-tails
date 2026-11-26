import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Map, Camera, type CameraRef } from '@maplibre/maplibre-react-native';
import { Button, Input, getMapStyle } from '@wag/ui-mobile';
import type { PlaceDetails, PlaceSuggestion } from '@wag/api-client';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

// Adding an address is two steps, like the delivery apps: first put the pin on the exact spot (search, use the
// current location, or drag the map under the fixed pin), then fill in flat/house details. The coordinates saved
// are the ones under the pin, because they are what the partner is navigated to.

// Shown before the user has moved anywhere, until we know where they are.
const DEFAULT_CENTER = { lat: 26.4499, lng: 80.3319 };
const LABELS = ['Home', 'Work', 'Other'] as const;

export default function AddAddressScreen() {
  const [step, setStep] = useState<'pin' | 'details'>('pin');
  const cameraRef = useRef<CameraRef>(null);
  const style = useMemo(() => getMapStyle(), []);

  // ---- step 1: pin
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchError, setSearchError] = useState('');
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [pinned, setPinned] = useState(false);
  const [place, setPlace] = useState<PlaceDetails | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [locating, setLocating] = useState(false);
  const skipSearch = useRef(false);

  // ---- step 2: details
  const [label, setLabel] = useState<(typeof LABELS)[number]>('Home');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [pincode, setPincode] = useState('');
  const [saving, setSaving] = useState(false);

  const moveTo = useCallback((lat: number, lng: number, zoom = 17) => {
    setPinned(true);
    cameraRef.current?.easeTo({ center: [lng, lat], zoom, duration: 600 });
  }, []);

  // Start where the user is, if location is already allowed. Never asks for permission unprompted.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled && pos) moveTo(pos.coords.latitude, pos.coords.longitude, 16);
      } catch { /* stay on the default view */ }
    })();
    return () => { cancelled = true; };
  }, [moveTo]);

  // Address suggestions while typing (debounced; ignores answers to an older query).
  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return; }
    const q = query.trim();
    if (q.length < 3) { setSuggestions([]); setSearchError(''); return; }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const res = await wagApi.maps.autocomplete(q, pinned ? center : undefined);
        if (!stale) { setSuggestions(res.suggestions); setSearchError(''); }
      } catch {
        if (!stale) { setSuggestions([]); setSearchError('Search is unavailable right now. Drag the map to your address instead.'); }
      }
    }, 350);
    return () => { stale = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // What is under the pin (debounced, so dragging does not spend a lookup per frame).
  useEffect(() => {
    if (!pinned) return;
    let stale = false;
    setResolving(true);
    const t = setTimeout(async () => {
      try {
        const res = await wagApi.maps.reverse(center.lat, center.lng);
        if (stale) return;
        setPlace(res.place);
        setResolveError(res.place ? '' : 'We could not read an address here. You can still fill it in.');
      } catch {
        if (!stale) { setPlace(null); setResolveError('Could not look up this spot. Check your connection.'); }
      } finally {
        if (!stale) setResolving(false);
      }
    }, 500);
    return () => { stale = true; clearTimeout(t); };
  }, [center.lat, center.lng, pinned]);

  const pickSuggestion = (s: PlaceSuggestion) => {
    skipSearch.current = true;
    setQuery(s.title);
    setSuggestions([]);
    moveTo(s.lat, s.lng);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Location is off', 'Allow location for Wag & Tails in your phone settings, or search for your address instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      moveTo(pos.coords.latitude, pos.coords.longitude);
    } catch {
      Alert.alert('Could not get your location', 'Move the map to your address or search for it instead.');
    } finally {
      setLocating(false);
    }
  };

  const confirmLocation = () => {
    setLine2(place?.areaLine ?? '');
    setPincode(place?.pincode ?? '');
    setStep('details');
  };

  const canSave = line1.trim().length >= 3 && /^[1-9]\d{5}$/.test(pincode) && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await wagApi.client.post('/users/me/addresses', {
        label,
        line1: line1.trim(),
        line2: line2.trim() || undefined,
        // Server re-derives the operating city from the coordinates; these are its fallbacks.
        city: place?.city || place?.serviceCity || 'Unknown',
        state: place?.state || 'Unknown',
        pincode,
        lat: center.lat,
        lng: center.lng,
      });
      goBack('/account/addresses');
    } catch (err: any) {
      Alert.alert('Could not save address', err?.response?.data?.message ?? err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const serviceBanner = place && (
    place.serviceable
      ? <Text style={[styles.banner, styles.bannerOk]}>✓ We serve {place.serviceCity}</Text>
      : <Text style={[styles.banner, styles.bannerWarn]}>We are not in {place.city || 'this area'} yet. We serve Kanpur, Lucknow and Delhi. You can still save it.</Text>
  );

  // ------------------------------------------------------------------ step 2
  if (step === 'details') {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => setStep('pin')} accessibilityLabel="Back to map"><Text style={styles.back}>← Map</Text></TouchableOpacity>
            <Text style={styles.title}>Address details</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.pinSummary}>
              <Text style={styles.pinEmoji}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pinTitle} numberOfLines={2}>{place?.areaLine || place?.formattedAddress || 'Pinned location'}</Text>
                <Text style={styles.pinSub}>{[place?.city, place?.state].filter(Boolean).join(', ') || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`}</Text>
              </View>
              <TouchableOpacity onPress={() => setStep('pin')}><Text style={styles.change}>Change</Text></TouchableOpacity>
            </View>
            {serviceBanner}

            <Input label="Flat / house no. and building *" value={line1} onChangeText={setLine1} placeholder="e.g. Flat 302, Green Park Apartments" maxLength={200} />
            <View style={{ height: spacing[3] }} />
            <Input label="Area / street" value={line2} onChangeText={setLine2} placeholder="e.g. Civil Lines" maxLength={200} />
            <View style={{ height: spacing[3] }} />
            <Input label="Pincode *" value={pincode} onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="6-digit pincode" maxLength={6}
              error={pincode.length > 0 && !/^[1-9]\d{5}$/.test(pincode) ? 'Enter a valid 6-digit pincode' : undefined} />

            <Text style={styles.fieldLabel}>Save as</Text>
            <View style={styles.chips}>
              {LABELS.map((l) => (
                <TouchableOpacity key={l} onPress={() => setLabel(l)} style={[styles.chip, label === l && styles.chipOn]} accessibilityRole="button">
                  <Text style={[styles.chipText, label === l && styles.chipTextOn]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button onPress={save} loading={saving} disabled={!canSave} fullWidth style={{ marginTop: spacing[5] }}>Save address</Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------------------------ step 1
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack('/account/addresses')} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Set your location</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.mapArea}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={style as any}
          logo={false}
          compass={false}
          onRegionDidChange={(e) => {
            const [lng, lat] = e.nativeEvent.center;
            setCenter({ lat, lng });
            if (e.nativeEvent.userInteraction) setPinned(true);
          }}
        >
          <Camera ref={cameraRef} initialViewState={{ center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat], zoom: 12 }} />
        </Map>

        {/* Fixed pin: the map moves under it, and its tip marks the saved point. */}
        <View pointerEvents="none" style={styles.centerPin}><Text style={styles.centerPinEmoji}>📍</Text></View>

        <View style={styles.searchWrap}>
          <Input value={query} onChangeText={setQuery} placeholder="Search area, street or landmark" returnKeyType="search" autoCorrect={false} />
          {(suggestions.length > 0 || !!searchError) && (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <TouchableOpacity key={s.placeId + s.title} style={styles.suggestion} onPress={() => pickSuggestion(s)}>
                  <Text style={styles.sugTitle} numberOfLines={1}>{s.title}</Text>
                  <Text style={styles.sugSub} numberOfLines={1}>{s.subtitle}</Text>
                </TouchableOpacity>
              ))}
              {!!searchError && <Text style={styles.sugError}>{searchError}</Text>}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.locateBtn} onPress={useCurrentLocation} disabled={locating} accessibilityLabel="Use my current location">
          {locating ? <ActivityIndicator color={colors.brandBrown} /> : <Text style={styles.locateText}>◎  Use current location</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.sheet}>
        {!pinned ? (
          <Text style={styles.hint}>Search for your address, use your current location, or move the map so the pin is on your doorstep.</Text>
        ) : resolving && !place ? (
          <View style={styles.row}><ActivityIndicator color={colors.brandBrown} /><Text style={styles.hint}>Finding this address…</Text></View>
        ) : (
          <>
            <Text style={styles.placeTitle} numberOfLines={2}>{place?.areaLine || place?.formattedAddress || 'Pinned location'}</Text>
            <Text style={styles.placeSub} numberOfLines={1}>{[place?.city, place?.state, place?.pincode].filter(Boolean).join(', ')}</Text>
            {!!resolveError && <Text style={styles.sugError}>{resolveError}</Text>}
            {serviceBanner}
          </>
        )}
        <Button onPress={confirmLocation} disabled={!pinned || resolving} fullWidth style={{ marginTop: spacing[3] }}>Confirm location</Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  mapArea: { flex: 1, backgroundColor: colors.borderLight },
  centerPin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -42 },
  centerPinEmoji: { fontSize: 36 },
  searchWrap: { position: 'absolute', top: spacing[3], left: spacing[3], right: spacing[3] },
  suggestions: { backgroundColor: colors.white, borderRadius: radii.lg, marginTop: 4, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', elevation: 6 },
  suggestion: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sugTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  sugSub: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 1 },
  sugError: { fontFamily: 'Inter', fontSize: 12, color: colors.error, padding: spacing[3] },
  locateBtn: { position: 'absolute', right: spacing[3], bottom: spacing[3], backgroundColor: colors.white, borderRadius: radii.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2], elevation: 4, minHeight: 36, justifyContent: 'center' },
  locateText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.brandBrown },
  sheet: { backgroundColor: colors.white, padding: spacing[5], borderTopLeftRadius: radii['2xl'] ?? 24, borderTopRightRadius: radii['2xl'] ?? 24, elevation: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  hint: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted },
  placeTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  placeSub: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  banner: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', borderRadius: radii.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], marginTop: spacing[3], overflow: 'hidden' },
  bannerOk: { backgroundColor: colors.successLight, color: colors.success },
  bannerWarn: { backgroundColor: colors.warningLight, color: colors.textPrimary },
  form: { padding: spacing[5], paddingBottom: spacing[10] },
  pinSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[2] },
  pinEmoji: { fontSize: 24 },
  pinTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  pinSub: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  change: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.marigoldDark },
  fieldLabel: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: spacing[4], marginBottom: spacing[2] },
  chips: { flexDirection: 'row', gap: spacing[2] },
  chip: { borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  chipOn: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  chipText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.marigoldDark },
});
