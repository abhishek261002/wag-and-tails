import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { format } from 'date-fns';

export default function OrderDetailScreen() {
  const { id: orderId } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (orderId) wagApi.client.get<any>(`/orders/${orderId}`).then(setOrder).catch(() => {});
  }, [orderId]);

  const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
    placed: 'info', packed: 'warning', out_for_delivery: 'warning',
    delivered: 'success', cancelled: 'error', refunded: 'error',
  };

  const STATUS_STEPS = ['placed', 'packed', 'out_for_delivery', 'delivered'];

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter' }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stepIndex = STATUS_STEPS.indexOf(order.status);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Order Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <View style={styles.statusHeader}>
          <Text style={styles.orderNum}>#{order.orderNumber}</Text>
          <Badge variant={STATUS_VARIANT[order.status] ?? 'info'} label={order.status.replace(/_/g, ' ')} />
        </View>
        <Text style={styles.orderDate}>Placed {format(new Date(order.createdAt), 'EEE, d MMM yyyy · h:mm a')}</Text>

        {/* Progress tracker */}
        {!['cancelled', 'refunded'].includes(order.status) && (
          <View style={styles.tracker}>
            {STATUS_STEPS.map((step, i) => (
              <View key={step} style={styles.trackerStep}>
                <View style={[styles.trackerDot, i <= stepIndex && styles.trackerDotActive]} />
                <Text style={[styles.trackerLabel, i <= stepIndex && styles.trackerLabelActive]}>
                  {step.replace(/_/g, ' ')}
                </Text>
                {i < STATUS_STEPS.length - 1 && (
                  <View style={[styles.trackerLine, i < stepIndex && styles.trackerLineActive]} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Items */}
        <SectionTitle title="Items" />
        <View style={styles.itemsCard}>
          {order.items?.map((item: any) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemImg}><Text style={{ fontSize: 24 }}>📦</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.productName}</Text>
                {item.variantName && <Text style={styles.itemVariant}>{item.variantName}</Text>}
                <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>₹{Number(item.totalPrice)}</Text>
            </View>
          ))}
        </View>

        {/* Delivery address */}
        <SectionTitle title="Delivery Address" />
        <View style={styles.card}>
          <Text style={styles.addrText}>{order.addressLine}</Text>
        </View>

        {/* Tracking */}
        {order.trackingNumber && (
          <>
            <SectionTitle title="Tracking" />
            <View style={styles.card}>
              <Text style={styles.tracking}>#{order.trackingNumber}</Text>
            </View>
          </>
        )}

        {/* Price breakdown */}
        <SectionTitle title="Payment" />
        <View style={styles.card}>
          <PriceRow label="Subtotal" value={`₹${Number(order.subtotal)}`} />
          {Number(order.discount) > 0 && (
            <PriceRow label="Discount" value={`-₹${Number(order.discount)}`} accent={colors.success} />
          )}
          <PriceRow label="Shipping" value={Number(order.shippingFee) === 0 ? 'Free' : `₹${Number(order.shippingFee)}`} />
          <PriceRow label="Total" value={`₹${Number(order.total)}`} bold />
          <PriceRow label="Payment" value={order.paymentMethod ?? '—'} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function PriceRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: string }) {
  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={[styles.priceValue, bold && styles.priceBold, accent ? { color: accent } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[1] },
  orderNum: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  orderDate: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginBottom: spacing[5] },
  tracker: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[5] },
  trackerStep: { flex: 1, alignItems: 'center', position: 'relative' },
  trackerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.borderMedium, marginBottom: 6 },
  trackerDotActive: { backgroundColor: colors.marigold },
  trackerLabel: { fontFamily: 'Inter', fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  trackerLabelActive: { color: colors.marigoldDark, fontWeight: '700' },
  trackerLine: { position: 'absolute', top: 7, left: '50%', right: '-50%', height: 2, backgroundColor: colors.borderLight },
  trackerLineActive: { backgroundColor: colors.marigold },
  sectionTitle: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing[4], marginBottom: spacing[2] },
  itemsCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, gap: spacing[3] },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  itemImg: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  itemVariant: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted },
  itemQty: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted },
  itemPrice: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.brandBrown },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  addrText: { fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary },
  tracking: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.brandBrown },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[1] },
  priceLabel: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted },
  priceValue: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  priceBold: { fontWeight: '800', fontSize: 16, color: colors.brandBrown },
});
