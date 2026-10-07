import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Icon, type IconName } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../lib/api';
import { openNotification } from '../lib/push';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

const SHOWN = 3;

const iconFor = (type: string): IconName =>
  type.startsWith('reminder.vaccination') ? 'syringe'
  : type.startsWith('reminder.checkup') ? 'heart'
  : type.startsWith('reminder.grooming') ? 'scissors'
  : type.startsWith('tip') ? 'spark'
  : type.startsWith('booking') ? 'cal'
  : 'bell';

/**
 * The home page's notifications card (replaces the bell in the header): the three most recent notifications, one
 * below the other, and "See all" for the full list. Refreshes whenever the home tab comes into view.
 */
export function HomeNotifications() {
  const [items, setItems] = useState<Notif[] | null>(null);
  const [unread, setUnread] = useState(0);

  useFocusEffect(useCallback(() => {
    let alive = true;
    Promise.all([
      wagApi.client.get<Notif[]>(`/notifications?limit=${SHOWN}`),
      wagApi.client.get<{ count: number }>('/notifications/unread-count').catch(() => ({ count: 0 })),
    ])
      .then(([list, c]) => { if (alive) { setItems(list.slice(0, SHOWN)); setUnread(c.count); } })
      .catch(() => { if (alive) setItems((cur) => cur ?? []); });
    return () => { alive = false; };
  }, []));

  if (items === null) return null;

  const open = (n: Notif) => {
    if (!n.isRead) {
      setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? cur);
      setUnread((u) => Math.max(0, u - 1));
      wagApi.client.patch(`/notifications/${n.id}/read`, {}).catch(() => {});
    }
    openNotification({ ...(n.data ?? {}), type: n.type });
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headIcon}><Icon name="bell" size={16} color={colors.brandBrown} /></View>
        <Text style={styles.title}>Notifications</Text>
        {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread} new</Text></View>}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => router.push('/account/notifications')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="See all notifications">
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>You're all caught up.</Text>
      ) : (
        items.map((n, i) => (
          <TouchableOpacity
            key={n.id}
            style={[styles.row, i > 0 && styles.rowBorder]}
            onPress={() => open(n)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${n.isRead ? '' : 'Unread. '}${n.title}. ${n.body}`}
          >
            <View style={styles.rowIcon}><Icon name={iconFor(n.type)} size={15} color={colors.marigoldDark} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, !n.isRead && styles.rowTitleUnread]} numberOfLines={1}>{n.title}</Text>
              <Text style={styles.rowBody} numberOfLines={1}>{n.body}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.time}>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: false })}</Text>
              {!n.isRead && <View style={styles.dot} />}
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.lg, paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  headIcon: { width: 28, height: 28, borderRadius: radii.sm, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter', fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  badge: { backgroundColor: colors.marigoldMid, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: 'Inter', fontSize: 10.5, fontWeight: '800', color: colors.white },
  seeAll: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.marigoldDark },
  empty: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted, paddingVertical: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] + 2 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  rowIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  rowTitleUnread: { fontWeight: '800', color: colors.textPrimary },
  rowBody: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  time: { fontFamily: 'Inter', fontSize: 10.5, color: colors.textMuted },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.marigold },
});
