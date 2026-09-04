import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';

const SEARCH_TIMEOUT = 45; // seconds

export default function SearchingPartnerScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const [secondsLeft, setSecondsLeft] = useState(SEARCH_TIMEOUT);
  const [status, setStatus] = useState<'searching' | 'found' | 'expired'>('searching');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // Poll booking status
    const pollInterval = setInterval(async () => {
      try {
        const booking = await wagApi.bookings.get(bookingId!);
        if ((booking as any).status === 'accepted') {
          clearInterval(pollInterval);
          setStatus('found');
          setTimeout(() => {
            router.replace({ pathname: '/booking/walking/live', params: { id: bookingId } } as any);
          }, 1500);
        }
      } catch {}
    }, 3000);

    // Countdown
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(pollInterval);
          clearInterval(intervalRef.current!);
          setStatus('expired');
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bookingId]);

  const handleCancel = () => {
    Alert.alert('Cancel Search', 'Cancel looking for a walker?', [
      { text: 'Keep Searching', style: 'cancel' },
      {
        text: 'Cancel', style: 'destructive',
        onPress: async () => {
          try {
            await wagApi.bookings.cancel(bookingId!);
          } catch {}
          router.replace('/(tabs)/home');
        },
      },
    ]);
  };

  const handleRetry = async () => {
    try {
      await wagApi.client.post(`/walking/search/${bookingId}`);
      setStatus('searching');
      setSecondsLeft(SEARCH_TIMEOUT);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {status === 'searching' && (
          <>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.innerCircle}>
                <Text style={{ fontSize: 48 }}>🐾</Text>
              </View>
            </Animated.View>
            <Text style={styles.headline}>Finding a walker…</Text>
            <Text style={styles.sub}>Searching nearby walkers for your dog</Text>
            <View style={styles.timerBox}>
              <Text style={styles.timerValue}>{secondsLeft}s</Text>
              <Text style={styles.timerLabel}>remaining</Text>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelText}>Cancel search</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'found' && (
          <>
            <View style={styles.foundCircle}>
              <Text style={{ fontSize: 56 }}>✅</Text>
            </View>
            <Text style={styles.headline}>Walker Found!</Text>
            <Text style={styles.sub}>Your walker is on the way. Opening live tracking…</Text>
          </>
        )}

        {status === 'expired' && (
          <>
            <View style={styles.expiredCircle}>
              <Text style={{ fontSize: 56 }}>😔</Text>
            </View>
            <Text style={styles.headline}>No walkers found</Text>
            <Text style={styles.sub}>No walkers are available nearby right now. Try again in a few minutes.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)/home')}>
              <Text style={styles.homeText}>Back to Home</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[8] },
  pulseRing: { width: 180, height: 180, borderRadius: 90, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[8] },
  innerCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: colors.marigold, alignItems: 'center', justifyContent: 'center' },
  headline: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing[2] },
  sub: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing[6] },
  timerBox: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], marginBottom: spacing[8], borderWidth: 1, borderColor: colors.borderLight, minWidth: 120 },
  timerValue: { fontFamily: 'Inter', fontSize: 42, fontWeight: '800', color: colors.brandBrown },
  timerLabel: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cancelBtn: { padding: spacing[3] },
  cancelText: { fontFamily: 'Inter', fontSize: 14, color: colors.error, fontWeight: '600' },
  foundCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[8] },
  expiredCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[8] },
  retryBtn: { backgroundColor: colors.brandBrown, borderRadius: radii.xl, paddingHorizontal: spacing[10], paddingVertical: spacing[4], marginBottom: spacing[3] },
  retryText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.white },
  homeBtn: { padding: spacing[3] },
  homeText: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted },
});
