import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { colors, spacing, radii } from '@wag/design-tokens';
import { getNativeTileUrlTemplate } from './mapsConfig';
import type { LiveMapViewProps } from './LiveMapView.types';

// Native counterpart of LiveMapView.web.tsx. react-native-maps has no
// MapLibre style concept — the base map comes from whatever the platform
// provides (Apple Maps on iOS with no key needed; Google Maps on Android,
// which needs its own API key via the RN Maps config plugin, separate
// from Ola Maps) with a <UrlTile> raster overlay on top for the actual
// Ola/OSM tiles, matching mapsConfig's fallback logic. This path hasn't
// been exercised in this environment (Expo managed workflow, tested via
// --web only) — it's wired up for whenever a native/dev-client build
// becomes the target, per the same tradeoff as the old text placeholder.
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

export function LiveMapView({ partner, destination, height = 240 }: LiveMapViewProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const points = [partner, destination].filter(Boolean) as { lat: number; lng: number }[];
    if (points.length === 0) return;
    mapRef.current.fitToCoordinates(
      points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
    );
  }, [partner?.lat, partner?.lng, destination?.lat, destination?.lng]);

  const distanceKm = partner && destination
    ? haversineKm(partner.lat, partner.lng, destination.lat, destination.lng)
    : null;

  const initialCenter = partner ?? destination;

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={
          initialCenter
            ? { latitude: initialCenter.lat, longitude: initialCenter.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            : { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        }
      >
        <UrlTile urlTemplate={getNativeTileUrlTemplate()} maximumZ={19} flipY={false} />
        {partner && (
          <Marker coordinate={{ latitude: partner.lat, longitude: partner.lng }} title={partner.label} rotation={partner.heading ?? 0} anchor={{ x: 0.5, y: 0.5 }}>
            <Text style={{ fontSize: 28 }}>🐾</Text>
          </Marker>
        )}
        {destination && (
          <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title={destination.label}>
            <Text style={{ fontSize: 26 }}>📍</Text>
          </Marker>
        )}
        {partner && destination && (
          <Polyline
            coordinates={[{ latitude: partner.lat, longitude: partner.lng }, { latitude: destination.lat, longitude: destination.lng }]}
            strokeColor="#8B5E34"
            strokeWidth={3}
            lineDashPattern={[6, 4]}
          />
        )}
      </MapView>
      {distanceKm != null && (
        <View style={styles.distancePill}>
          <Text style={styles.distanceText}>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radii.xl, overflow: 'hidden', position: 'relative', backgroundColor: colors.borderLight },
  distancePill: { position: 'absolute', bottom: spacing[3], left: spacing[3], backgroundColor: colors.white, borderRadius: radii.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1], shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  distanceText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.textPrimary },
});
