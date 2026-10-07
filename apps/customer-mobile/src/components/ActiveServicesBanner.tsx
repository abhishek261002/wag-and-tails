import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, AppState } from 'react-native';
import { router } from 'expo-router';
import { format, isToday, isTomorrow } from 'date-fns';
import { Icon, PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { resolveMediaUrl } from '../lib/api';

const ROTATE_MS = 4000;
const SLIDE_SETTLE_MS = 450;

interface Props {
  services: any[];
  petPhotos: Record<string, string | null | undefined>;
}

const STATUS: Record<string, { label: string; tone: 'live' | 'work' | 'wait' }> = {
  partner_on_the_way: { label: 'On the way', tone: 'live' },
  arrived: { label: 'Arrived', tone: 'live' },
  in_progress: { label: 'In progress', tone: 'live' },
  accepted: { label: 'Partner assigned', tone: 'work' },
  assigned: { label: 'Partner assigned', tone: 'work' },
  needs_partner: { label: 'Finding a partner', tone: 'work' },
  searching_partner: { label: 'Finding a partner', tone: 'work' },
  confirmed: { label: 'Confirmed', tone: 'wait' },
};

function when(b: any): string {
  if (!b.scheduledAt) return '';
  const d = new Date(b.scheduledAt);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`;
  return format(d, 'EEE d MMM, h:mm a');
}

function detail(b: any): string {
  const p = b.partner?.user?.profile;
  const partner = [p?.firstName, p?.lastName].filter(Boolean).join(' ');
  switch (b.status) {
    case 'partner_on_the_way': return `${partner || 'Your partner'} is on the way`;
    case 'arrived': return `${partner || 'Your partner'} has arrived`;
    case 'in_progress': return `${partner || 'Your partner'} is with ${b.petName}`;
    case 'accepted':
    case 'assigned': return `${partner || 'A partner'} · ${when(b)}`;
    case 'needs_partner':
    case 'searching_partner': return 'Looking for a partner near you';
    default: return when(b);
  }
}

/**
 * A strip docked above the tab bar that lists every pending and ongoing service. With more than one it scrolls by
 * itself in a loop, one service at a time (like the order tracker in a delivery app); it pauses while the customer
 * is dragging it and when the app is in the background. Tapping a service opens it.
 */
export function ActiveServicesBanner({ services, petPhotos }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const paused = useRef(false);
  const current = useRef(0);
  const multiple = services.length > 1;

  // For a seamless loop the first service is repeated after the last; reaching the copy jumps back to the start.
  const slides = useMemo(() => (multiple ? [...services, services[0]] : services), [services, multiple]);

  const goTo = useCallback((i: number, animated = true) => {
    if (!width) return;
    current.current = i;
    scroller.current?.scrollTo({ x: i * width, animated });
  }, [width]);

  // The list changed (a service finished, or a new one appeared): start again from the first.
  const key = services.map((s) => s.id).join('|');
  useEffect(() => { current.current = 0; setIndex(0); scroller.current?.scrollTo({ x: 0, animated: false }); }, [key]);

  useEffect(() => {
    if (!multiple || !width) return;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const tick = setInterval(() => {
      if (paused.current || AppState.currentState !== 'active') return;
      const next = current.current + 1;
      goTo(next);
      setIndex(next % services.length);
      if (next >= services.length) {
        // Landed on the repeated first slide: jump back to the real one without animating.
        settle = setTimeout(() => { goTo(0, false); }, SLIDE_SETTLE_MS);
      }
    }, ROTATE_MS);
    return () => { clearInterval(tick); if (settle) clearTimeout(settle); };
  }, [multiple, width, services.length, goTo]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    paused.current = false;
    if (!width) return;
    let i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (multiple && i >= services.length) { goTo(0, false); i = 0; }
    current.current = i;
    setIndex(Math.min(i, services.length - 1));
  };

  if (services.length === 0) return null;
  const onLayout = (e: LayoutChangeEvent) => { const w = Math.round(e.nativeEvent.layout.width); if (w !== width) setWidth(w); };

  return (
    <View style={styles.wrap} onLayout={onLayout} accessibilityLabel={`${services.length} active service${services.length === 1 ? '' : 's'}`}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        scrollEnabled={multiple}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => { paused.current = true; }}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={(e) => { if (e.nativeEvent.velocity?.x === 0) onEnd(e); }}
      >
        {slides.map((b, i) => {
          const st = STATUS[b.status] ?? { label: String(b.status).replace(/_/g, ' '), tone: 'wait' as const };
          const service = b.type === 'grooming' ? b.packageName ?? 'Grooming' : `${b.durationMinutes ?? 30} min walk`;
          return (
            <TouchableOpacity
              key={`${b.id}-${i}`}
              style={[styles.slide, multiple && styles.slideDots, width ? { width } : { width: 320 }]}
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${service} for ${b.petName}, ${st.label}. Open`}
            >
              <PetAvatar name={b.petName ?? '?'} imageUrl={resolveMediaUrl(petPhotos[b.petId] ?? null)} size={42} ringState={st.tone === 'live' ? 'active' : 'idle'} />
              <View style={styles.text}>
                <Text style={styles.title} numberOfLines={1}>{service} · {b.petName}</Text>
                <Text style={styles.sub} numberOfLines={1}>{detail(b)}</Text>
              </View>
              <View style={[styles.pill, st.tone === 'live' ? styles.pillLive : st.tone === 'work' ? styles.pillWork : styles.pillWait]}>
                <Text style={[styles.pillText, st.tone === 'wait' && styles.pillTextWait]}>{st.label}</Text>
              </View>
              <Icon name="chev" size={15} color={colors.textDisabled} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {multiple && (
        <View style={styles.dots} pointerEvents="none">
          {services.map((s, i) => <View key={s.id} style={[styles.dot, i === index && styles.dotOn]} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing[4], marginBottom: spacing[2], backgroundColor: colors.white, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  slide: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  slideDots: { paddingBottom: spacing[4] },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  sub: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillLive: { backgroundColor: colors.marigold },
  pillWork: { backgroundColor: colors.brandBrown },
  pillWait: { backgroundColor: colors.marigoldBg },
  pillText: { fontFamily: 'Inter', fontSize: 11, fontWeight: '800', color: colors.white },
  pillTextWait: { color: colors.marigoldDark },
  dots: { position: 'absolute', bottom: 4, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.borderMedium },
  dotOn: { width: 14, backgroundColor: colors.marigold },
});
