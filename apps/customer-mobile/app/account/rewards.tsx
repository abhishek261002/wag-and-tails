import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';
import { Icon } from '@wag/ui-mobile';
import type { PointsEntry, RewardRules } from '@wag/api-client';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';
import { errorMessage } from '../../src/lib/website';

// Reward points: one balance for the website and the app (same mobile number). Earned on completed groomings,
// usable at checkout (decision 10A).
export default function RewardsScreen() {
  const [data, setData] = useState<{ connected: boolean; points: number; ledger: PointsEntry[]; rules?: RewardRules | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await wagApi.website.rewards());
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'Could not load your points'));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rules = data?.rules;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Reward points</Text>
        <View style={{ width: 50 }} />
      </View>
      {!data && !error ? (
        <ActivityIndicator color={colors.brandBrown} style={{ marginTop: spacing[8] }} />
      ) : (
        <FlatList
          data={data?.ledger ?? []}
          keyExtractor={(e, i) => e.id ?? String(i)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListHeaderComponent={
            <View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.balanceCard}>
                <Icon name="gift" size={22} color={colors.white} />
                <Text style={styles.balance}>{data?.points ?? 0}</Text>
                <Text style={styles.balanceLabel}>points</Text>
              </View>
              {rules?.enabled ? (
                <Text style={styles.rules}>
                  You earn {rules.bookingRate} points for every ₹100 of grooming. From {rules.minRedeem} points you can pay up to {rules.maxPct}% of a booking with points (1 point = ₹{rules.pointValue}). Same points on wagandtails.in.
                </Text>
              ) : data && !data.connected ? (
                <Text style={styles.rules}>Points are not available right now.</Text>
              ) : null}
              <Text style={styles.sectionLabel}>HISTORY</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reason}>{item.reason || 'Points'}</Text>
                <Text style={styles.when}>{item.created ?? item.at ?? ''}{item.ref ? ` · ${item.ref}` : ''}</Text>
              </View>
              <Text style={[styles.pts, { color: Number(item.pts) >= 0 ? colors.success : colors.error }]}>{Number(item.pts) >= 0 ? '+' : ''}{item.pts}</Text>
            </View>
          )}
          ListEmptyComponent={data ? <Text style={styles.empty}>No points yet. Book a grooming to start earning.</Text> : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  list: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  balanceCard: { backgroundColor: colors.brandBrown, borderRadius: radii.xl, padding: spacing[5], alignItems: 'center', gap: 2 },
  balance: { fontFamily: 'Inter', fontSize: 40, fontWeight: '800', color: colors.white },
  balanceLabel: { fontFamily: 'Inter', fontSize: 13, color: colors.white, opacity: 0.85 },
  rules: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: spacing[3], lineHeight: 19 },
  sectionLabel: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginTop: spacing[5], marginBottom: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reason: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  when: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pts: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800' },
  empty: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing[6] },
  error: { fontFamily: 'Inter', fontSize: 13, color: colors.error, marginBottom: spacing[3] },
});
