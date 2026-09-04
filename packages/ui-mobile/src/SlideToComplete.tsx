import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  PanResponder,
  Animated,
  StyleSheet,
  Dimensions,
  Vibration,
} from 'react-native';
import { colors, radii } from '@wag/design-tokens';

const TRACK_WIDTH = Dimensions.get('window').width - 64;
const THUMB_SIZE = 52;
const MAX_TRANSLATE = TRACK_WIDTH - THUMB_SIZE - 8;

export interface SlideToCompleteProps {
  label?: string;
  onComplete: () => void;
  disabled?: boolean;
}

export function SlideToComplete({
  label = 'Slide to complete',
  onComplete,
  disabled = false,
}: SlideToCompleteProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [completed, setCompleted] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !completed,
      onPanResponderMove: (_, gestureState) => {
        const x = Math.max(0, Math.min(gestureState.dx, MAX_TRANSLATE));
        translateX.setValue(x);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= MAX_TRANSLATE * 0.85) {
          Animated.timing(translateX, {
            toValue: MAX_TRANSLATE,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            setCompleted(true);
            Vibration.vibrate(50);
            onComplete();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const trackOpacity = translateX.interpolate({
    inputRange: [0, MAX_TRANSLATE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const fillWidth = translateX.interpolate({
    inputRange: [0, MAX_TRANSLATE],
    outputRange: [THUMB_SIZE + 8, TRACK_WIDTH],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.track, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Slide to the right to complete"
    >
      {/* Fill */}
      <Animated.View
        style={[styles.fill, { width: fillWidth }]}
        pointerEvents="none"
      />

      {/* Label */}
      <Animated.Text style={[styles.label, { opacity: trackOpacity }]}>
        {completed ? '✓ Done!' : label}
      </Animated.Text>

      {/* Thumb */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.thumb,
          { transform: [{ translateX: completed ? MAX_TRANSLATE : translateX }] },
        ]}
      >
        <Text style={styles.thumbIcon}>{completed ? '✓' : '›'}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: THUMB_SIZE + 8,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  disabled: {
    opacity: 0.5,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.marigold,
    borderRadius: radii.full,
  },
  label: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.brandBrown,
    fontFamily: 'Inter',
    zIndex: 1,
  },
  thumb: {
    position: 'absolute',
    left: 4,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.brandBrown,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brandBrown,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 2,
  },
  thumbIcon: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
});
