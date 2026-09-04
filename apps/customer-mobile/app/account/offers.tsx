import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { format } from 'date-fns';

export default function OffersScreen() {
  const [coupons, setCoupons] = useState<any[]>([]);

  useEffect(() => {
    wagApi.client.get<any[]>('/coupons').then(setCoupons).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Offers & Coupons</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={coupons}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: coupon }) => (
          <View style={styles.couponCard}>
            <View style={styles.couponLeft}>
              <Text style={styles.code}>{coupon.code}</Text>
              <Text style={styles.description}>{coupon.description}</Text>
              <Text style={styles.validity}>
                Valid till {format(new Date(coupon.validUntil), 'd MMM yyyy')}
              </Text>
            </View>
            <View style={styles.couponRight}>
              <Text style={styles.discount}>
                {coupon.discountType === 'flat' ? `₹${Number(coupon.discountValue)}` : `${Number(coupon.discountValue)}%`}
              </Text>
              <Text style={styles.discountLabel}>off</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>🎟</Text>
            <Text style={styles.emptyText}>No active offers right now</Text>
            <Text style={styles.emptySub}>Check back soon for exciting deals!</Text>
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
  list: { padding: spacing[5], gap: spacing[3] },
  couponCard: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1.5, borderColor: colors.marigold, borderStyle: 'dashed' },
  couponLeft: { flex: 1 },
  couponRight: { alignItems: 'center', justifyContent: 'center', paddingLeft: spacing[4] },
  code: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.brandBrown, letterSpacing: 2 },
  description: { fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  validity: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, marginTop: spacing[2] },
  discount: { fontFamily: 'Inter', fontSize: 28, fontWeight: '800', color: colors.marigold },
  discountLabel: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: 16, color: colors.textMuted, marginTop: spacing[3] },
  emptySub: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: spacing[1] },
});
