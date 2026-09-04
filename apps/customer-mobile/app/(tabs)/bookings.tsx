import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { bookingStatusVariantMobile } from '../../src/utils/booking';
import { format } from 'date-fns';

type FilterType = 'all' | 'grooming' | 'walking';

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await wagApi.bookings.list({
        type: filter === 'all' ? undefined : filter,
        pageSize: 50,
      });
      setBookings(res.data);
    } catch {}
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'grooming', 'walking'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f }}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All' : f === 'grooming' ? '✂️ Grooming' : '🐾 Walking'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBrown} />}
        renderItem={({ item: b }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
            activeOpacity={0.85}
            accessibilityLabel={`${b.type} booking for ${b.petName}`}
          >
            <Card style={styles.bookingCard}>
              <View style={styles.row}>
                <View style={styles.typeIcon}>
                  <Text style={{ fontSize: 22 }}>{b.type === 'grooming' ? '✂️' : '🐾'}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.petName}>{b.petName}</Text>
                  <Text style={styles.detail}>
                    {b.type === 'grooming' ? b.packageName : `${b.durationMinutes} min walk`}
                  </Text>
                  {b.scheduledAt && (
                    <Text style={styles.date}>
                      {format(new Date(b.scheduledAt), 'EEE d MMM · h:mm a')}
                    </Text>
                  )}
                </View>
                <View style={styles.right}>
                  <Badge variant={bookingStatusVariantMobile(b.status)} label={b.status.replace(/_/g, ' ')} />
                  <Text style={styles.price}>₹{b.total}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>📅</Text>
            <Text style={styles.emptyText}>No bookings yet</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
              <Text style={styles.bookNow}>Book a service</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing[5], gap: spacing[2], marginBottom: spacing[4] },
  filterTab: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radii.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight },
  filterTabActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  filterTabText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  filterTabTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  bookingCard: { marginBottom: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  typeIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  petName: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary },
  detail: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  date: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, color: colors.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: spacing[2] },
  price: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.brandBrown },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, marginTop: spacing[3] },
  bookNow: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.marigoldDark, fontWeight: '700', marginTop: spacing[2] },
});
