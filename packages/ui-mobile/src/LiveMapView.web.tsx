import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import maplibregl from 'maplibre-gl';
import { colors, spacing, radii } from '@wag/design-tokens';
import { getMapStyle } from './mapsConfig';
import type { LiveMapViewProps } from './LiveMapView.types';

const ROUTE_SOURCE_ID = 'wag-route';
let cssInjected = false;

// maplibre-gl ships its own CSS; Metro's web bundler has no CSS-import
// loader, so it's injected as a <link> at runtime instead of `import
// 'maplibre-gl/dist/maplibre-gl.css'`.
function ensureMaplibreCss() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  document.head.appendChild(link);
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const partnerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureMaplibreCss();
    if (!containerRef.current || mapRef.current) return;

    const center = partner ?? destination;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle() as any,
      center: center ? [center.lng, center.lat] : [77.209, 28.6139],
      zoom: 13,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      map.addSource(ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      });
      map.addLayer({
        id: ROUTE_SOURCE_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        paint: { 'line-color': '#8B5E34', 'line-width': 3, 'line-dasharray': [2, 1.5] },
      });
      setReady(true);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Map is created once; marker/route updates happen in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (partner) {
      if (!partnerMarkerRef.current) {
        const el = document.createElement('div');
        el.style.fontSize = '28px';
        el.textContent = '🐾';
        partnerMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([partner.lng, partner.lat]).addTo(map);
      } else {
        partnerMarkerRef.current.setLngLat([partner.lng, partner.lat]);
      }
    }

    if (destination) {
      if (!destMarkerRef.current) {
        const el = document.createElement('div');
        el.style.fontSize = '26px';
        el.textContent = '📍';
        destMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([destination.lng, destination.lat]).addTo(map);
      } else {
        destMarkerRef.current.setLngLat([destination.lng, destination.lat]);
      }
    }

    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source && partner && destination) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[partner.lng, partner.lat], [destination.lng, destination.lat]] },
      });
    }

    if (partner && destination) {
      const bounds = new maplibregl.LngLatBounds(
        [partner.lng, partner.lat],
        [partner.lng, partner.lat]
      );
      bounds.extend([destination.lng, destination.lat]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
    } else if (partner) {
      map.easeTo({ center: [partner.lng, partner.lat], duration: 600 });
    }
  }, [ready, partner?.lat, partner?.lng, destination?.lat, destination?.lng]);

  const distanceKm = partner && destination
    ? haversineKm(partner.lat, partner.lng, destination.lat, destination.lng)
    : null;

  return (
    <View style={[styles.wrap, { height }]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: radii.xl as any, overflow: 'hidden' }} />
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
