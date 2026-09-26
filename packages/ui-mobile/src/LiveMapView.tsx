import React, { useRef, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';
import { colors, spacing, radii } from '@wag/design-tokens';
import { getMapStyle } from './mapsConfig';
import type { LiveMapViewProps } from './LiveMapView.types';

// Native counterpart of LiveMapView.web.tsx. Both draw the same MapLibre style (Ola Maps once a key is
// configured, OpenStreetMap until then), so Android and iOS need no Google or Apple map account.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function etaLabel(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

const MOVE_MS = 900;
const DEFAULT_CENTER: [number, number] = [77.209, 28.6139];

export function LiveMapView({ partner, destination, height = 240, route, etaSeconds, follow = false, onUserPan }: LiveMapViewProps) {
  const cameraRef = useRef<CameraRef>(null);
  const style = useMemo(() => getMapStyle(), []);

  // The marker glides to each new fix instead of jumping, so movement looks continuous.
  const [shown, setShown] = useState<{ lat: number; lng: number } | null>(partner ? { lat: partner.lat, lng: partner.lng } : null);
  const shownRef = useRef(shown);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!partner) { shownRef.current = null; setShown(null); return; }
    const from = shownRef.current;
    const to = { lat: partner.lat, lng: partner.lng };
    if (!from) { shownRef.current = to; setShown(to); return; }
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / MOVE_MS);
      const cur = { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
      shownRef.current = cur;
      setShown(cur);
      rafRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [partner?.lat, partner?.lng]);

  // Frame both ends, unless we are following the partner around in navigation mode.
  useEffect(() => {
    if (follow || !cameraRef.current) return;
    const pts = [partner, destination].filter(Boolean) as { lat: number; lng: number }[];
    if (pts.length === 0) return;
    if (pts.length === 1) {
      cameraRef.current.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 15, duration: 600 });
      return;
    }
    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    cameraRef.current.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 60, right: 60, bottom: 60, left: 60 }, duration: 600 }
    );
  }, [follow, partner?.lat, partner?.lng, destination?.lat, destination?.lng]);

  // Navigation mode: centre on the partner and turn with their heading, like a driving app.
  useEffect(() => {
    if (!follow || !partner || !cameraRef.current) return;
    cameraRef.current.easeTo({ center: [partner.lng, partner.lat], bearing: partner.heading ?? 0, pitch: 45, zoom: 17, duration: 800 });
  }, [follow, partner?.lat, partner?.lng, partner?.heading]);

  const distanceKm = partner && destination
    ? haversineKm(partner.lat, partner.lng, destination.lat, destination.lng)
    : null;

  const initialCenter = partner ?? destination;
  const hasRoute = !!route && route.length >= 2;
  const lineCoords = hasRoute
    ? route!.map((p) => [p.lng, p.lat])
    : partner && destination
      ? [[partner.lng, partner.lat], [destination.lng, destination.lat]]
      : null;
  const line = useMemo(
    () => (lineCoords ? ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lineCoords } } as const) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(lineCoords)]
  );

  return (
    <View style={[styles.wrap, { height }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={style as any}
        logo={false}
        compass={!follow}
        onRegionIsChanging={(e) => { if (e.nativeEvent.userInteraction) onUserPan?.(); }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: initialCenter ? [initialCenter.lng, initialCenter.lat] : DEFAULT_CENTER, zoom: 13 }}
        />
        {line && (
          <GeoJSONSource id="wag-route" data={line as any}>
            {hasRoute ? (
              <>
                <Layer type="line" id="wag-route-casing" paint={{ 'line-color': '#FFFFFF', 'line-width': 9 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
                <Layer type="line" id="wag-route-line" paint={{ 'line-color': '#2563EB', 'line-width': 5 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
              </>
            ) : (
              <Layer type="line" id="wag-route-estimate" paint={{ 'line-color': '#8B5E34', 'line-width': 3, 'line-dasharray': [2, 1.5] }} />
            )}
          </GeoJSONSource>
        )}
        {destination && (
          <Marker id="wag-destination" lngLat={[destination.lng, destination.lat]} anchor="bottom">
            <View><Text style={styles.pin}>📍</Text></View>
          </Marker>
        )}
        {partner && shown && (
          <Marker id="wag-partner" lngLat={[shown.lng, shown.lat]} anchor="center">
            <View><Text style={styles.partnerDot}>{follow ? '🔵' : '🐾'}</Text></View>
          </Marker>
        )}
      </Map>
      {(etaSeconds != null || distanceKm != null) && (
        <View style={styles.distancePill}>
          <Text style={styles.distanceText}>
            {etaSeconds != null ? `Arriving in ${etaLabel(etaSeconds)}` : distanceKm! < 1 ? `${Math.round(distanceKm! * 1000)} m away` : `${distanceKm!.toFixed(1)} km away`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radii.xl, overflow: 'hidden', position: 'relative', backgroundColor: colors.borderLight },
  pin: { fontSize: 26 },
  partnerDot: { fontSize: 28 },
  distancePill: { position: 'absolute', bottom: spacing[3], left: spacing[3], backgroundColor: colors.white, borderRadius: radii.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1], shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  distanceText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.textPrimary },
});
