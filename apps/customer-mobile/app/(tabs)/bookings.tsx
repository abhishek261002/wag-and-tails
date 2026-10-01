import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isToday, isTomorrow } from 'date-fns';
import { PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../../src/lib/api';

type Scope = 'upcoming' | 'past';
type TypeFilter = 'all' | 'grooming' | 'walking';

const PAGE_SIZE = 15;
const POLL_MS = 15_000;

interface Pill { label: string; tone: 'orange' | 'tan' | 'green' | 'grey' | 'red'; dot?: boolean }

const STATUS_PILL: Record<string, Pill> = {
  confirmed: { label: 'Confirmed', tone: 'tan' },
  needs_partner: { label: 'Finding partner', tone: 'tan' },
  searching_partner: { label: 'Finding partner', tone: 'tan' },
  assigned: { label: 'Partner assigned', tone: 'tan' },
  accepted: { label: 'Partner assigned', tone: 'tan' },
  partner_on_the_way: { label: 'On the way', tone: 'orange', dot: true },
  arrived: { label: 'Arrived', tone: 'green', dot: true },
  in_progress: { label: 'In progress', tone: 'green', dot: true },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
  refunded: { label: 'Refunded', tone: 'grey' },
  expired: { label: 'Expired', tone: 'red' },
};

const TRACKABLE = new Set(['partner_on_the_way', 'arrived']);
const RESCHEDULABLE = new Set(['confirmed', 'needs_partner', 'assigned']);

function when(b: any): string {
  const d = new Date(b.scheduledAt ?? b.createdAt);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`;
  return format(d, 'EEE, d MMM · h:mm a');
}

function partnerLine(b: any): string {
  const p = b.partner?.user?.profile;
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ');
  const code = `#${String(b.id).slice(0, 8).toUpperCase()}`;
  return name ? `${name} · ${code}` : code;
}

/** Bookings, per the prototype: two big tabs (Upcoming / Past), a card per booking with the actions that matter. */
export default function BookingsScreen() {
  const [scope, setScope] = useState<Scope>('upcoming');
  const [type, setType] = useState<TypeFilter>('all');
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [petPhotos, setPetPhotos] = useState<Record<string, string | null>>({});
  const request = useRef(0);

  // First page (also used by pull-to-refresh and the poll). A response for an older tab/filter is discarded.
  const loadFirst = useCallback(async (quiet = false) => {
    const mine = ++request.current;
    if (!quiet) setLoading(true);
    try {
      const res = await wagApi.bookings.list({ scope, type: type === 'all' ? undefined : type, page: 1, pageSize: PAGE_SIZE });
      if (mine !== request.current) return;
      setItems(res.data as any[]);
      setTotal(res.total);
      setPage(1);
      setFailed(false);
    } catch {
      if (mine === request.current) setFailed(true);
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, [scope, type]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || items.length >= total) return;
    const mine = request.current;
    setLoadingMore(true);
    try {
      const res = await wagApi.bookings.list({ scope, type: type === 'all' ? undefined : type, page: page + 1, pageSize: PAGE_SIZE });
      if (mine !== request.current) return;
      setItems((cur) => {
        const seen = new Set(cur.map((b) => b.id));
        return [...cur, ...(res.data as any[]).filter((b) => !seen.has(b.id))];
      });
      setPage(page + 1);
      setTotal(res.total);
    } catch { /* the next scroll retries */ }
    finally { setLoadingMore(false); }
  }, [loadingMore, loading, items.length, total, scope, type, page]);

  // Reload on focus and every 15 s while visible, so a partner accepting or setting off shows without a refresh.
  useFocusEffect(useCallback(() => {
    loadFirst();
    const t = setInterval(() => loadFirst(true), POLL_MS);
    return () => clearInterval(t);
  }, [loadFirst]));

  useEffect(() => {
    wagApi.pets.list().then((ps) => setPetPhotos(Object.fromEntries(ps.map((p) => [p.id, p.avatarUrl])))).catch(() => {});
  }, []);

  const onRefresh = async () => { setRefreshing(true); await loadFirst(true); setRefreshing(false); };

  const open = (b: any) => router.push({ pathname: '/booking/[id]', params: { id: b.id } });
  const track = (b: any) => router.push({ pathname: '/booking/confirmed', params: { id: b.id } });
  const reschedule = (b: any) => router.push({ pathname: '/booking/reschedule', params: { id: b.id } });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.sub}>Grooming and walks</Text>
      </View>

      {/* The two tabs that matter */}
      <View style={styles.tabs}>
        {(['upcoming', 'past'] as Scope[]).map((s) => (
          <TouchableOpacity key={s} style={[styles.tab, scope === s && styles.tabActive]} onPress={() => setScope(s)} accessibilityRole="tab" accessibilityState={{ selected: scope === s }}>
            <Text style={[styles.tabText, scope === s && styles.tabTextActive]}>{s === 'upcoming' ? 'Upcoming' : 'Past'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quiet secondary filter */}
      <View style={styles.filters}>
        {(['all', 'grooming', 'walking'] as TypeFilter[]).map((f) => (
          <TouchableOpacity key={f} onPress={() => setType(f)} style={[styles.filter, type === f && styles.filterActive]} accessibilityRole="button" accessibilityState={{ selected: type === f }}>
            <Text style={[styles.filterText, type === f && styles.filterTextActive]}>{f === 'all' ? 'All' : f === 'grooming' ? 'Grooming' : 'Walking'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.marigold} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: spacing[10] }} color={colors.brandBrown} />
          : failed ? (
            <TouchableOpacity onPress={() => loadFirst()}><Text style={styles.error}>Could not load your bookings. Tap to try again.</Text></TouchableOpacity>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{scope === 'upcoming' ? 'Nothing coming up' : 'No past bookings yet'}</Text>
              <Text style={styles.emptyBody}>{scope === 'upcoming' ? 'Book a groom or a walk and it will show up here.' : 'Finished and cancelled bookings appear here.'}</Text>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: spacing[4] }} color={colors.brandBrown} /> : null}
        renderItem={({ item: b }) => {
          const pill = STATUS_PILL[b.status] ?? { label: String(b.status).replace(/_/g, ' '), tone: 'tan' as const };
          const live = b.status === 'partner_on_the_way';
          const service = b.type === 'grooming' ? b.packageName ?? 'Grooming' : `${b.durationMinutes ?? 30} min walk`;
          return (
            <TouchableOpacity style={styles.card} onPress={() => open(b)} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={`${service} for ${b.petName}, ${pill.label}`}>
              <View style={styles.cardTop}>
                <View style={live ? styles.liveRing : undefined}>
                  <PetAvatar name={b.petName} imageUrl={resolveMediaUrl(petPhotos[b.petId] ?? null)} size={48} ringState={live ? 'active' : 'idle'} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.service} numberOfLines={1}>{service}</Text>
                    <View style={[styles.pill, styles[`pill_${pill.tone}` as const]]}>
                      {pill.dot && <View style={[styles.pillDot, pill.tone === 'orange' ? styles.dotOn : styles.dotGreen]} />}
                      <Text style={[styles.pillText, styles[`pillText_${pill.tone}` as const]]}>{pill.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.line} numberOfLines={1}>{b.petName} · {when(b)}</Text>
                  <Text style={styles.line} numberOfLines={1}>{partnerLine(b)}</Text>
                </View>
              </View>

              <View style={styles.divider} />
              <View style={styles.cardBottom}>
                <Text style={styles.price}>₹{Number(b.total ?? 0).toLocaleString('en-IN')}</Text>
                <View style={styles.actions}>
                  {TRACKABLE.has(b.status) ? (
                    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => track(b)} accessibilityLabel="Track"><Text style={styles.btnPrimaryText}>Track</Text></TouchableOpacity>
                  ) : (
                    <>
                      {RESCHEDULABLE.has(b.status) && (
                        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => reschedule(b)} accessibilityLabel="Reschedule"><Text style={styles.btnOutlineText}>Reschedule</Text></TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => open(b)} accessibilityLabel="Details"><Text style={styles.btnPrimaryText}>Details</Text></TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  title: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 30, color: colors.textPrimary },
  sub: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginTop: 2 },

  tabs: { flexDirection: 'row', marginHorizontal: spacing[5], marginTop: spacing[4], backgroundColor: colors.biscuitLight, borderRadius: radii.xl, padding: 4 },
  tab: { flex: 1, height: 44, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { fontWeight: '800', color: colors.textPrimary },

  filters: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[5], marginTop: spacing[3] },
  filter: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  filterActive: { backgroundColor: colors.biscuitLight },
  filterText: { fontFamily: 'Inter', fontSize: 12.5, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.brandBrown, fontWeight: '800' },

  list: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[10], gap: spacing[3] },
  error: { fontFamily: 'Inter', fontSize: 14, color: colors.error, textAlign: 'center', marginTop: spacing[8] },
  empty: { alignItems: 'center', marginTop: spacing[10], paddingHorizontal: spacing[6] },
  emptyTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptyBody: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing[1] },

  card: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing[4] },
  cardTop: { flexDirection: 'row', gap: spacing[3] },
  liveRing: { borderRadius: 40, padding: 4, backgroundColor: colors.marigoldBg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  service: { flex: 1, fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  line: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 3 },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pill_orange: { backgroundColor: colors.marigold },
  pill_tan: { backgroundColor: colors.marigoldBg },
  pill_green: { backgroundColor: colors.successLight },
  pill_grey: { backgroundColor: colors.biscuitLight },
  pill_red: { backgroundColor: '#FDECEC' },
  pillText: { fontFamily: 'Inter', fontSize: 11.5, fontWeight: '800' },
  pillText_orange: { color: colors.white },
  pillText_tan: { color: colors.marigoldDark },
  pillText_green: { color: colors.success },
  pillText_grey: { color: colors.textSecondary },
  pillText_red: { color: colors.error },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { backgroundColor: colors.white },
  dotGreen: { backgroundColor: colors.success },

  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing[3] },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontFamily: 'Inter', fontSize: 19, fontWeight: '800', color: colors.textPrimary },
  actions: { flexDirection: 'row', gap: spacing[2] },
  btn: { height: 40, borderRadius: radii.md, paddingHorizontal: spacing[4], alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.brandBrown },
  btnPrimaryText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.white },
  btnOutline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.borderMedium },
  btnOutlineText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.textPrimary },
});
