import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

const PAYMENT_OPTIONS = [
  { label: '📱 UPI', value: 'upi' },
  { label: '💳 Card', value: 'card' },
  { label: '💵 Cash on Delivery', value: 'cod' },
] as const;

export default function CheckoutScreen() {
  const [cart, setCart] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('upi');
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    Promise.all([
      wagApi.client.get<any>('/store/cart'),
      wagApi.client.get<any[]>('/users/addresses'),
    ]).then(([c, addrs]) => {
      setCart(c);
      setAddresses(addrs);
      const def = addrs.find((a: any) => a.isDefault) ?? addrs[0];
      if (def) setSelectedAddressId(def.id);
    }).catch(() => {});
  }, []);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const subtotal = cart?.items?.reduce((s: number, i: any) => s + Number(i.unitPrice) * i.quantity, 0) ?? 0;
      const res = await wagApi.bookings.applyCoupon(couponCode, 'store', subtotal);
      setDiscount(res.discount);
      Alert.alert('Coupon applied!', `₹${res.discount} discount applied`);
    } catch (err: any) {
      Alert.alert('Invalid coupon', err?.message ?? 'Coupon not valid');
    }
  };

  const subtotal = cart?.items?.reduce((s: number, i: any) => s + Number(i.unitPrice) * i.quantity, 0) ?? 0;
  const total = subtotal - discount;

  const placeOrder = async () => {
    if (!selectedAddressId) {
      Alert.alert('Select address', 'Please select a delivery address');
      return;
    }
    setPlacing(true);
    try {
      const order = await wagApi.client.post<any>('/orders', {
        addressId: selectedAddressId,
        paymentMethod,
        couponCode: couponCode || undefined,
      });
      router.replace({ pathname: '/store/order/[id]', params: { id: order.id } } as any);
    } catch (err: any) {
      Alert.alert('Order failed', err?.message ?? 'Please try again');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Delivery address */}
        <SectionTitle title="Delivery Address" />
        {addresses.map((addr) => {
          const active = selectedAddressId === addr.id;
          return (
            <TouchableOpacity
              key={addr.id}
              style={[styles.addrCard, active && styles.addrCardActive]}
              onPress={() => setSelectedAddressId(addr.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.addrLabel}>{addr.label}</Text>
                <Text style={styles.addrLine}>{addr.line1}, {addr.city}</Text>
              </View>
              {active && <Text style={{ color: colors.success, fontSize: 20 }}>✓</Text>}
            </TouchableOpacity>
          );
        })}

        {/* Order items */}
        <SectionTitle title="Order Summary" />
        <View style={styles.itemsList}>
          {cart?.items?.map((item: any) => (
            <View key={item.id} style={styles.orderItem}>
              <Text style={styles.orderItemName} numberOfLines={1}>{item.product?.name}</Text>
              <Text style={styles.orderItemQty}>×{item.quantity}</Text>
              <Text style={styles.orderItemPrice}>₹{Number(item.unitPrice) * item.quantity}</Text>
            </View>
          ))}
        </View>

        {/* Coupon */}
        <SectionTitle title="Coupon" />
        <View style={styles.couponRow}>
          <TextInput
            style={styles.couponInput}
            value={couponCode}
            onChangeText={(v) => { setCouponCode(v.toUpperCase()); setDiscount(0); }}
            placeholder="Enter coupon code"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            accessibilityLabel="Coupon code"
          />
          <TouchableOpacity style={styles.applyBtn} onPress={applyCoupon}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Payment */}
        <SectionTitle title="Payment Method" />
        <View style={styles.paymentGrid}>
          {PAYMENT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.payBtn, paymentMethod === opt.value && styles.payBtnActive]}
              onPress={() => setPaymentMethod(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: paymentMethod === opt.value }}
            >
              <Text style={[styles.payBtnText, paymentMethod === opt.value && styles.payBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalBox}>
          <PriceRow label="Subtotal" value={`₹${subtotal}`} />
          {discount > 0 && <PriceRow label="Coupon discount" value={`-₹${discount}`} accent={colors.success} />}
          <PriceRow label="Shipping" value="Free" accent={colors.success} />
          <PriceRow label="Total" value={`₹${total}`} bold />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={placeOrder} fullWidth loading={placing}>
          Place Order · ₹{total}
        </Button>
      </View>
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
  sectionTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing[5], marginBottom: spacing[3] },
  addrCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing[4], borderWidth: 1.5, borderColor: colors.borderLight, marginBottom: spacing[2] },
  addrCardActive: { borderColor: colors.success },
  addrLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  addrLine: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  itemsList: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, gap: spacing[2] },
  orderItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderItemName: { fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary, flex: 1 },
  orderItemQty: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginHorizontal: spacing[3] },
  orderItemPrice: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  couponRow: { flexDirection: 'row', gap: spacing[2] },
  couponInput: { flex: 1, backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary },
  applyBtn: { backgroundColor: colors.brandBrown, borderRadius: radii.lg, paddingHorizontal: spacing[5], justifyContent: 'center' },
  applyBtnText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.white },
  paymentGrid: { flexDirection: 'row', gap: spacing[2] },
  payBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, alignItems: 'center', backgroundColor: colors.white },
  payBtnActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  payBtnText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  payBtnTextActive: { color: colors.white },
  totalBox: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginTop: spacing[4], gap: spacing[2] },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted },
  priceValue: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  priceBold: { fontWeight: '800', fontSize: 16, color: colors.brandBrown },
  footer: { padding: spacing[5], paddingBottom: spacing[8], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
