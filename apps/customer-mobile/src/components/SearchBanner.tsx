import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../lib/api';
import { useActiveSearchStore } from '../store/activeSearch.store';

// Matches the old full-screen searching.tsx's timeout, kept here instead so
// the customer never has to sit and watch it count down.
const SEARCH_TIMEOUT_MS = 45000;

// A persistent, non-blocking banner mounted once in the root layout. While a
// walk request is out for dispatch, this floats above whatever screen the
// customer is actually using instead of a full-screen loader — see
// activeSearch.store.ts.
export function SearchBanner() {
  const { bookingId, petName, phase, partnerName, markFound, markExpired, dismiss } = useActiveSearchStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!bookingId || phase !== 'searching') return;

    wagApi.realtime.connect();
    wagApi.realtime.joinBooking(bookingId);

    const offStatus = wagApi.realtime.on('booking:status_changed', (payload: any) => {
      if (payload.bookingId !== bookingId) return;
      if (payload.status === 'accepted') {
        markFound(payload.partnerName ?? 'Your walker');
      }
    });

    const timeout = setTimeout(() => markExpired(), SEARCH_TIMEOUT_MS);

    return () => {
      offStatus();
      clearTimeout(timeout);
    };
  }, [bookingId, phase, markFound, markExpired]);

  useEffect(() => {
    if (phase !== 'searching') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulseAnim]);

  if (!bookingId) return null;

  const handlePress = () => {
    if (phase === 'found') {
      const id = bookingId;
      dismiss();
      router.push({ pathname: '/booking/walking/live', params: { id } } as any);
    } else if (phase === 'searching') {
      router.push({ pathname: '/booking/confirmed', params: { id: bookingId } } as any);
    } else {
      dismiss();
    }
  };

  const tone = phase === 'found' ? colors.success : phase === 'expired' ? colors.warning : colors.brandBrown;

  return (
    <TouchableOpacity style={[styles.banner, { borderColor: tone }]} onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={[styles.iconBox, { backgroundColor: tone, transform: [{ scale: phase === 'searching' ? pulseAnim : 1 }] }]}>
        <Icon
          name={phase === 'found' ? 'check' : phase === 'expired' ? 'alert' : 'route'}
          size={18}
          color={colors.white}
        />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {phase === 'found' ? 'Walker found!' : phase === 'expired' ? 'No walkers available' : `Finding a walker for ${petName ?? 'your dog'}…`}
        </Text>
        <Text style={styles.sub}>
          {phase === 'found' ? `${partnerName} is on the way — tap to track` : phase === 'expired' ? 'Tap to view options' : 'You can keep browsing — we\'ll let you know'}
        </Text>
      </View>
      <TouchableOpacity onPress={dismiss} accessibilityLabel="Dismiss" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Icon name="close" size={16} color={colors.textDisabled} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    padding: spacing[3],
    shadowColor: colors.brandBrown,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 1000,
  },
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter', fontSize: 13.5, fontWeight: '700', color: colors.textPrimary },
  sub: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
});
