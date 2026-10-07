import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  PanResponder,
  Dimensions,
  Keyboard,
  Platform,
  ViewStyle,
} from 'react-native';
import { colors, radii } from '@wag/design-tokens';

export interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  snapPoints?: ('50%' | '70%' | '90%' | 'auto');
  style?: ViewStyle;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Space kept above the sheet so it never slides under the status bar.
const TOP_GAP = 56;

/**
 * A sheet that slides up from the bottom. Its content area is a flex column, so a ScrollView inside it with
 * `style={{ flex: 1 }}` scrolls to the very last item. When the keyboard opens (e.g. a search field in the sheet),
 * the sheet moves up above it and shrinks if needed, so the field and the results stay visible.
 */
export function BottomSheet({ visible, onDismiss, children, snapPoints = '50%', style }: BottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [keyboard, setKeyboard] = useState(0);

  // The pan handler is created once; read the latest onDismiss through a ref so it never calls a stale one.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }).start();
      setKeyboard(0);
    }
  }, [visible, slideAnim]);

  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKeyboard(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKeyboard(0));
    return () => { s.remove(); h.remove(); };
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 10,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 100 || gesture.vy > 0.5) dismissRef.current();
      },
    })
  ).current;

  const wanted =
    snapPoints === '50%' ? SCREEN_HEIGHT * 0.5
    : snapPoints === '70%' ? SCREEN_HEIGHT * 0.7
    : snapPoints === '90%' ? SCREEN_HEIGHT * 0.9
    : undefined;
  const room = SCREEN_HEIGHT - keyboard - TOP_GAP;
  const sheetHeight = wanted !== undefined ? Math.min(wanted, room) : undefined;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => dismissRef.current()} statusBarTranslucent>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => dismissRef.current()} />

      <Animated.View
        style={[
          styles.sheet,
          { bottom: keyboard, paddingBottom: keyboard > 0 ? 8 : 34 },
          sheetHeight ? { height: sheetHeight } : { maxHeight: room },
          { transform: [{ translateY: slideAnim }] },
          style,
        ]}
      >
        {/* Handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        <View style={sheetHeight ? styles.body : undefined}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(74,30,11,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    overflow: 'hidden',
  },
  // Fixed-height sheets give their content the remaining height, so an inner ScrollView can use flex: 1.
  body: { flex: 1, minHeight: 0 },
  handleArea: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMedium,
  },
});
