import React, { useEffect, useRef } from 'react';
import { View, Image, Text, StyleSheet, Animated, Easing, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@wag/design-tokens';
import { DogFace, pickDogArt } from './dogArt';

/**
 * The pet avatar ring — the signature element carried through every
 * surface of the prototype: biscuit idle, marigold pulsing when a
 * booking is live, a marigold arc during a walk/groom in progress,
 * a spinning dash while searching for a partner, success green + a
 * check overlay when done.
 */
export type AvatarRingState = 'idle' | 'active' | 'inProgress' | 'walking' | 'searching' | 'done';

export interface PetAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
  ringState?: AvatarRingState;
  showProgress?: boolean;
  progressPercent?: number; // 0-100
  style?: ViewStyle;
}

const TRACK_R = 45;
const CIRCUMFERENCE = 2 * Math.PI * TRACK_R;

export function PetAvatar({
  name,
  imageUrl,
  size = 56,
  ringState = 'idle',
  showProgress = false,
  progressPercent = 0,
  style,
}: PetAvatarProps) {
  const art = pickDogArt(name || 'pet');
  const gradId = `pa-${(name || 'pet').replace(/[^a-zA-Z0-9]/g, '')}-${size}`;

  const pulse = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (ringState === 'active' || ringState === 'inProgress') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.5, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
    return undefined;
  }, [ringState, pulse]);

  useEffect(() => {
    if (ringState === 'searching') {
      const loop = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
      );
      loop.start();
      return () => loop.stop();
    }
    spin.setValue(0);
    return undefined;
  }, [ringState, spin]);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // track + arc colors, matching the prototype's ring[data-state=…] rules
  let trackColor: string = colors.biscuit; // idle default
  let trackOpacity = 1;
  let arcColor: string = 'transparent';
  let dashOffset = CIRCUMFERENCE;
  let dashArray: string | undefined;

  if (ringState === 'active' || ringState === 'inProgress') {
    trackColor = colors.marigold;
  } else if (ringState === 'walking' || (showProgress && ringState !== 'searching')) {
    trackColor = colors.biscuit;
    trackOpacity = 0.5;
    arcColor = colors.marigold;
    const p = Math.max(0, Math.min(1, progressPercent / 100));
    dashOffset = CIRCUMFERENCE * (1 - p);
  } else if (ringState === 'searching') {
    trackColor = colors.biscuit;
    trackOpacity = 0.4;
    arcColor = colors.marigold;
    dashArray = `${CIRCUMFERENCE * 0.25} ${CIRCUMFERENCE * 0.75}`;
    dashOffset = 0;
  } else if (ringState === 'done') {
    trackColor = colors.success;
  }

  const innerInset = size * 0.09;
  const innerSize = size - innerInset * 2;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [
            { scale: pulse },
            ...(ringState === 'searching' ? [{ rotate: spinDeg }] : []),
          ],
        }}
      >
        <Svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: [{ rotate: '-90deg' }] }}
        >
          <Circle cx={50} cy={50} r={TRACK_R} stroke={trackColor} strokeOpacity={trackOpacity} strokeWidth={5} fill="none" />
          <Circle
            cx={50}
            cy={50}
            r={TRACK_R}
            stroke={arcColor}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={dashArray ?? `${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
          />
        </Svg>
      </Animated.View>

      <View
        style={{
          position: 'absolute',
          left: innerInset,
          top: innerInset,
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: 'hidden',
          backgroundColor: colors.biscuitLight,
        }}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: innerSize, height: innerSize }}
            accessibilityLabel={`${name}'s photo`}
          />
        ) : (
          <DogFace art={art} gradId={gradId} />
        )}
      </View>

      {ringState === 'done' && (
        <View style={[styles.badge, { width: Math.max(16, size * 0.34), height: Math.max(16, size * 0.34), borderRadius: 999 }]}>
          <Text style={[styles.checkmark, { fontSize: Math.max(9, size * 0.16) }]}>✓</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: colors.marigoldMid ?? colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.canvas,
  },
  checkmark: {
    color: '#fff',
    fontWeight: '800',
  },
});
