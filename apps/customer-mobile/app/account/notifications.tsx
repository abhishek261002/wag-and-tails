import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';
import { Icon, type IconName } from '@wag/ui-mobile';
import { wagApi } from '../../src/lib/api';
import { openNotification } from '../../src/lib/push';
import { formatDistanceToNow } from 'date-fns';
import { goBack } from '../../src/lib/nav';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

const PAGE = 30;

const iconFor = (type: string): IconName =>
  type.startsWith('reminder.vaccination') ? 'syringe'
  : type.startsWith('reminder.grooming') ? 'scissors'
  : type.startsWith('tip') ? 'spark'
  : type.startsWith('booking') ? 'cal'
  : 'bell';

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notif[]>([]);
  const [prefs, setPrefs] = useState<{ reminders: boolean; tips: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, p] = await Promise.all([
        wagApi.client.get<Notif[]>(`/notifications?limit=${PAGE}`),
        wagApi.client.get<{ reminders: boolean; tips: boolean }>('/notifications/preferences'),
      ]);
      setItems(list);
      setDone(list.length < PAGE);
      setPrefs(p);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (more || done || items.length === 0) return;
    setMore(true);
    try {
      const older = await wagApi.client.get<Notif[]>(`/notifications?limit=${PAGE}&before=${encodeURIComponent(items[items.length - 1]!.createdAt)}`);
      setItems((prev) => [...prev, ...older]);
      if (older.length < PAGE) setDone(true);
    } catch {}
    setMore(false);
  };

  const open = async (n: Notif) => {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      wagApi.client.patch(`/notifications/${n.id}/read`, {}).catch(() => {});
    }
    // The bell screen is where this list lives; only leave it when the notification points somewhere.
    if (n.data?.bookingId || n.data?.petId) openNotification({ ...(n.data ?? {}), type: n.type });
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    wagApi.client.post('/notifications/read-all', {}).catch(() => {});
  };

  const setPref = async (key: 'reminders' | 'tips', value: boolean) => {
    const prev = prefs;
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    try {
      setPrefs(await wagApi.client.put<{ reminders: boolean; tips: boolean }>('/notifications/preferences', { [key]: value }));
    } catch {
      setPrefs(prev); // could not save: put the switch back
    }
  };

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={markAll} disabled={unread === 0} accessibilityLabel="Mark all as read">
          <Text style={[styles.back, unread === 0 && { color: colors.textDisabled }]}>Read all</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          prefs ? (
            <View style={styles.prefs}>
              <Text style={styles.prefsTitle}>Send me</Text>
              <View style={styles.prefRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>Vaccination and grooming reminders</Text>
                  <Text style={styles.prefHint}>Before a vaccine is due, and when a groom is due</Text>
                </View>
                <Switch value={prefs.reminders} onValueChange={(v) => setPref('reminders', v)} trackColor={{ true: colors.marigold }} accessibilityLabel="Reminders" />
              </View>
              <View style={styles.prefRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>Weekly pet-care tips</Text>
                  <Text style={styles.prefHint}>One short tip a week</Text>
                </View>
                <Switch value={prefs.tips} onValueChange={(v) => setPref('tips', v)} trackColor={{ true: colors.marigold }} accessibilityLabel="Care tips" />
              </View>
              <Text style={styles.prefHint}>Booking updates and payment receipts are always sent.</Text>
            </View>
          ) : null
        }
        renderItem={({ item: notif }) => (
          <TouchableOpacity
            style={[styles.notifCard, !notif.isRead && styles.notifCardUnread]}
            onPress={() => open(notif)}
            accessibilityLabel={notif.title}
          >
            <View style={styles.iconBox}><Icon name={iconFor(notif.type)} size={16} color={colors.brandBrown} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>{notif.title}</Text>
              <Text style={styles.notifBody}>{notif.body}</Text>
              <Text style={styles.notifTime}>{formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}</Text>
            </View>
            {!notif.isRead && <View style={[styles.dot, styles.dotActive]} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Icon name="bell" size={48} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  list: { padding: spacing[5], gap: spacing[2] },
  prefs: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[3], gap: spacing[3] },
  prefsTitle: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  prefLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  prefHint: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  notifCardUnread: { backgroundColor: colors.marigoldBg, borderColor: colors.marigold },
  iconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderMedium, marginTop: 6 },
  dotActive: { backgroundColor: colors.marigold },
  notifTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  notifBody: { fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  notifTime: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: 16, color: colors.textMuted, marginTop: spacing[3] },
});
