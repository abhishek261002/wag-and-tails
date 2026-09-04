import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { format } from 'date-fns';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  placed: 'info',
  packed: 'warning',
  out_for_delivery: 'warning',
  delivered: 'success',
  cancelled: 'error',
  refunded: 'error',
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wagApi.client.get<any>('/orders').then((data) => {
      setOrders(data.data ?? data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Orders</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: order }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/store/order/[id]', params: { id: order.id } } as any)}
            accessibilityLabel={`View order ${order.orderNumber}`}
          >
            <Card style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderNum}>#{order.orderNumber}</Text>
                  <Text style={styles.orderDate}>
                    {format(new Date(order.createdAt), 'd MMM yyyy')}
                  </Text>
                </View>
                <Badge
                  variant={STATUS_VARIANT[order.status] ?? 'info'}
                  label={order.status.replace(/_/g, ' ')}
                />
              </View>
              <Text style={styles.orderItems} numberOfLines={1}>
                {order.items?.map((i: any) => i.productName).join(', ') ?? '—'}
              </Text>
              <View style={styles.orderFooter}>
                <Text style={styles.orderTotal}>₹{Number(order.total)}</Text>
                <Text style={styles.viewDetails}>View details →</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>📦</Text>
              <Text style={styles.emptyText}>No orders yet</Text>
              <TouchableOpacity onPress={() => router.replace('/(tabs)/store' as any)}>
                <Text style={styles.shopLink}>Shop now</Text>
              </TouchableOpacity>
            </View>
          ) : null
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
  orderCard: { padding: spacing[4] },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[2] },
  orderNum: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  orderDate: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  orderItems: { fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, marginBottom: spacing[3] },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTotal: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.brandBrown },
  viewDetails: { fontFamily: 'Inter', fontSize: 13, color: colors.marigoldDark, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: 16, color: colors.textMuted, marginTop: spacing[3] },
  shopLink: { fontFamily: 'Inter', fontSize: 15, color: colors.marigoldDark, fontWeight: '700', marginTop: spacing[2] },
});
