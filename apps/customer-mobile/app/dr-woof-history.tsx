import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import type { DrWoofSessionSummary } from '@wag/shared-types';
import { Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../src/lib/api';
import { goBack } from '../src/lib/nav';
import { useDrWoofStore } from '../src/store/drWoof.store';

const whenLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, 'h:mm a')}`;
  return `${format(d, 'd MMM yyyy')} (${formatDistanceToNow(d, { addSuffix: true })})`;
};

/** Past conversations with Dr. Woof: open one to continue it, delete one, or start a fresh chat. */
export default function DrWoofHistoryScreen() {
  const [sessions, setSessions] = useState<DrWoofSessionSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const send = useDrWoofStore((s) => s.send);

  const load = useCallback(async () => {
    try { setSessions(await wagApi.ai.drWoofSessions()); setError(false); } catch { setError(true); setSessions((cur) => cur ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (s: DrWoofSessionSummary) => { send({ kind: 'open', sessionId: s.id }); goBack('/dr-woof'); };
  const startNew = () => { send({ kind: 'new' }); goBack('/dr-woof'); };

  const remove = (s: DrWoofSessionSummary) => {
    Alert.alert('Delete this chat?', `"${s.title}" and its ${s.messageCount} message${s.messageCount === 1 ? '' : 's'} will be removed. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await wagApi.ai.deleteDrWoofSession(s.id);
            setSessions((cur) => cur?.filter((x) => x.id !== s.id) ?? cur);
            send({ kind: 'deleted', sessionId: s.id });
          } catch (err: any) {
            Alert.alert('Could not delete', err?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/dr-woof')} accessibilityLabel="Go back"><Icon name="back" size={18} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Chat history</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={startNew} accessibilityLabel="Start a new chat"><Icon name="plus" size={18} color={colors.textPrimary} /></TouchableOpacity>
      </View>

      {sessions === null ? (
        <ActivityIndicator style={{ marginTop: spacing[10] }} color={colors.brandBrown} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.marigold} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Icon name="chat" size={30} color={colors.marigoldDark} /></View>
              {error ? (
                <TouchableOpacity onPress={load} accessibilityRole="button"><Text style={styles.emptyTitle}>Couldn't load your chats. Tap to try again.</Text></TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>No chats yet</Text>
                  <Text style={styles.emptySub}>Your conversations with Dr. Woof will show up here.</Text>
                  <TouchableOpacity style={styles.newBtn} onPress={startNew}><Text style={styles.newBtnText}>Ask Dr. Woof</Text></TouchableOpacity>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity style={styles.rowMain} onPress={() => open(item)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Open chat: ${item.title}`}>
                <View style={styles.avatar}><Icon name="paw" size={18} color={colors.marigoldDark} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  {!!item.preview && <Text style={styles.rowPreview} numberOfLines={2}>{item.preview}</Text>}
                  <Text style={styles.rowMeta}>{whenLabel(item.updatedAt)} · {item.messageCount} message{item.messageCount === 1 ? '' : 's'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.trash} onPress={() => remove(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Delete chat: ${item.title}`}>
                <Icon name="trash" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3] },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  list: { paddingHorizontal: spacing[5], paddingBottom: spacing[10], gap: spacing[3], flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4] },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '800', color: colors.textPrimary },
  rowPreview: { fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  rowMeta: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: 4 },
  trash: { paddingHorizontal: spacing[4], alignSelf: 'stretch', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: spacing[12], paddingHorizontal: spacing[6] },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  emptyTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  emptySub: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2], lineHeight: 19 },
  newBtn: { marginTop: spacing[5], backgroundColor: colors.brandBrown, borderRadius: radii.lg, height: 46, paddingHorizontal: spacing[6], alignItems: 'center', justifyContent: 'center' },
  newBtnText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.white },
});
