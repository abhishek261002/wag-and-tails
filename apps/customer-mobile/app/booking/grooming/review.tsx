import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { useBookingStore } from '../../../src/store/booking.store';
import { format } from 'date-fns';

const PAYMENT_OPTIONS = [
  { label: '📱 UPI', value: 'upi' },
  { label: '💳 Card', value: 'card' },
  { label: '👛 Wallet', value: 'wallet' },
  { label: '💵 Cash after service', value: 'cash_after_service' },
] as const;

export default function ReviewGroomingBookingScreen() {
  const { groomingDraft, updateGroomingDraft, resetGroomingDraft } = useBookingStore();
  const [couponCode, setCouponCode] = useState(groomingDraft.couponCode ?? '');
  const [couponApplied, setCouponApplied] = useState(groomingDraft.discount > 0);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [loading, setLoading] = useState(false);

  const pkg = groomingDraft.package;
  const addOns = groomingDraft.addOns;
  const subtotal = (Number(pkg?.price ?? 0)) + addOns.reduce((s, a) => s + Number(a.price), 0);
  const discount = groomingDraft.discount;
  const total = subtotal - discount;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const res = await wagApi.bookings.applyCoupon(couponCode.trim(), 'grooming', subtotal);
      updateGroomingDraft({ couponCode: couponCode.trim(), discount: res.discount });
      setCouponApplied(true);
    } catch (err: any) {
      Alert.alert('Invalid Coupon', err?.message ?? 'Coupon not valid');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleConfirm = async () => {
    if (!groomingDraft.petId || !groomingDraft.packageId || !groomingDraft.scheduledAt || !groomingDraft.addressId) {
      Alert.alert('Missing info', 'Please complete all booking steps');
      return;
    }

    setLoading(true);
    try {
      const booking = await wagApi.bookings.createGroomingBooking({
        petId: groomingDraft.petId,
        packageId: groomingDraft.packageId,
        addOnIds: groomingDraft.addOnIds,
        scheduledAt: groomingDraft.scheduledAt,
        addressId: groomingDraft.addressId,
        notes: groomingDraft.notes || undefined,
        couponCode: groomingDraft.couponCode || undefined,
        paymentMethod: groomingDraft.paymentMethod,
        channel: 'app',
      });
      resetGroomingDraft();
      router.replace({ pathname: '/booking/confirmed', params: { id: booking.id } });
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.message ?? 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Review Booking</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pet & Package summary */}
        <Section title="Summary">
          <Row label="Pet" value={groomingDraft.pet?.name ?? '—'} />
          <Row label="Package" value={pkg?.name ?? '—'} />
          {addOns.map((a) => <Row key={a.id} label={a.name} value={`₹${a.price}`} />)}
          {groomingDraft.scheduledAt && (
            <Row label="Date & Time" value={format(new Date(groomingDraft.scheduledAt), 'EEE, d MMM · h:mm a')} />
          )}
          <Row label="Address" value={groomingDraft.addressLine ?? '—'} />
          {groomingDraft.notes ? <Row label="Note" value={groomingDraft.notes} /> : null}
        </Section>

        {/* Coupon */}
        <Section title="Coupon">
          <View style={styles.couponRow}>
            <Input
              value={couponCode}
              onChangeText={(v) => { setCouponCode(v.toUpperCase()); setCouponApplied(false); updateGroomingDraft({ discount: 0 }); }}
              placeholder="Enter coupon code"
              autoCapitalize="characters"
              containerStyle={{ flex: 1 }}
              accessibilityLabel="Coupon code"
            />
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={applyCoupon}
              disabled={applyingCoupon || !couponCode.trim()}
            >
              <Text style={styles.applyBtnText}>{applyingCoupon ? '...' : 'Apply'}</Text>
            </TouchableOpacity>
          </View>
          {couponApplied && discount > 0 && (
            <Text style={styles.couponSuccess}>🎉 ₹{discount} discount applied!</Text>
          )}
        </Section>

        {/* Payment Method */}
        <Section title="Payment Method">
          <View style={styles.paymentGrid}>
            {PAYMENT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.payOpt, groomingDraft.paymentMethod === opt.value && styles.payOptActive]}
                onPress={() => updateGroomingDraft({ paymentMethod: opt.value })}
                accessibilityRole="radio"
                accessibilityState={{ selected: groomingDraft.paymentMethod === opt.value }}
              >
                <Text style={[styles.payOptText, groomingDraft.paymentMethod === opt.value && styles.payOptTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Price breakdown */}
        <Section title="Price">
          <Row label="Subtotal" value={`₹${subtotal}`} />
          {discount > 0 && <Row label="Discount" value={`-₹${discount}`} valueStyle={{ color: colors.success }} />}
          <Row label="Total" value={`₹${total}`} bold />
        </Section>

        <Button onPress={handleConfirm} fullWidth loading={loading} style={styles.cta}>
          Confirm Booking · ₹{total}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value, bold, valueStyle }: { label: string; value: string; bold?: boolean; valueStyle?: object }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  backText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
  section: { marginBottom: spacing[5] },
  sectionLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[2] },
  sectionBody: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted },
  rowValue: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  bold: { fontWeight: '800', fontSize: typography.fontSize.base, color: colors.brandBrown },
  couponRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  applyBtn: { backgroundColor: colors.brandBrown, borderRadius: radii.md, paddingHorizontal: spacing[4], height: 52, justifyContent: 'center' },
  applyBtnText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.white },
  couponSuccess: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.success, fontWeight: '600', marginTop: spacing[2] },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  payOpt: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight },
  payOptActive: { borderColor: colors.brandBrown, backgroundColor: colors.brandBrown },
  payOptText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  payOptTextActive: { color: colors.white },
  cta: { marginTop: spacing[4] },
});
