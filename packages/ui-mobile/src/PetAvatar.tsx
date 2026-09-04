import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { colors, radii } from '@wag/design-tokens';

export type AvatarRingState = 'idle' | 'active' | 'inProgress' | 'done';

export interface PetAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
  ringState?: AvatarRingState;
  showProgress?: boolean;
  progressPercent?: number; // 0-100
  style?: ViewStyle;
}

const ringColors: Record<AvatarRingState, string> = {
  idle: colors.biscuit,
  active: colors.marigold,
  inProgress: colors.brandBrown,
  done: colors.success,
};

export function PetAvatar({
  name,
  imageUrl,
  size = 56,
  ringState = 'idle',
  showProgress = false,
  progressPercent = 0,
  style,
}: PetAvatarProps) {
  const ringColor = ringColors[ringState];
  const innerSize = size - 6;
  const initials = name.slice(0, 2).toUpperCase();

  // Pulse animation for inProgress state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (ringState === 'inProgress') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [ringState, pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: ringColor,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pulseAnim }],
        },
        style,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          }}
          accessibilityLabel={`${name}'s photo`}
        />
      ) : (
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: colors.biscuitLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: size * 0.28,
              fontWeight: '700',
              color: colors.brandBrown,
              fontFamily: 'Inter',
            }}
          >
            {initials}
          </Text>
        </View>
      )}

      {/* Done checkmark overlay */}
      {ringState === 'done' && (
        <View style={[StyleSheet.absoluteFill, styles.doneOverlay]}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  doneOverlay: {
    borderRadius: 999,
    backgroundColor: 'rgba(46,125,50,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '800',
  },
});
