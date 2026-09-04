import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { format } from 'date-fns';

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<{ avg: number; count: number } | null>(null);

  useEffect(() => {
    wagApi.client.get<any>('/partners/me/reviews').then((data: any) => {
      setReviews(data.reviews ?? data ?? []);
      if (data.avg !== undefined) setStats({ avg: data.avg, count: data.count });
    }).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Reviews</Text>
        <View style={{ width: 50 }} />
      </View>
      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.avgRating}>{stats.avg.toFixed(1)}</Text>
          <Text style={styles.stars}>{'★'.repeat(Math.round(stats.avg))}</Text>
          <Text style={styles.reviewCount}>{stats.count} reviews</Text>
        </View>
      )}
      <FlatList
        data={reviews}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: review }) => (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewerName}>{review.reviewerName}</Text>
              <Text style={styles.reviewRating}>{'★'.repeat(review.rating)}</Text>
            </View>
            {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
            <Text style={styles.reviewDate}>{format(new Date(review.createdAt), 'd MMM yyyy')}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>⭐</Text>
            <Text style={styles.emptyText}>No reviews yet</Text>
          </View>
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
  statsCard: { alignItems: 'center', padding: spacing[6], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  avgRating: { fontFamily: 'Inter', fontSize: 56, fontWeight: '800', color: colors.brandBrown },
  stars: { fontSize: 24, color: colors.marigold },
  reviewCount: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginTop: spacing[1] },
  list: { padding: spacing[5], gap: spacing[3] },
  reviewCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  reviewerName: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  reviewRating: { fontSize: 16, color: colors.marigold },
  reviewComment: { fontFamily: 'Inter', fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing[2] },
  reviewDate: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: 16, color: colors.textMuted, marginTop: spacing[3] },
});
