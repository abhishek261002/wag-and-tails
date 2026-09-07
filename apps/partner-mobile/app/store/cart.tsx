import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

export default function PartnerCartScreen() {
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const c = await wagApi.store.getCart();
      setCart(c);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateQty = async (item: any, quantity: number) => {
    try {
      if (quantity === 0) await wagApi.store.removeCartItem(item.id);
      else await wagApi.store.updateCartItem(item.id, quantity);
      load();
    } catch {}
  };

  const subtotal = Number(cart?.subtotal ?? 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Cart</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={cart?.items ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
            <View style={styles.itemImage}><Text style={{ fontSize: 32 }}>📦</Text></View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
              {item.variantName && <Text style={styles.itemVariant}>{item.variantName}</Text>}
              <Text style={styles.itemPrice}>₹{Number(item.unitPrice)}</Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item, item.quantity - 1)} accessibilityLabel="Decrease quantity">
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item, item.quantity + 1)} accessibilityLabel="Increase quantity">
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>🛒</Text>
              <Text style={styles.emptyText}>Your cart is empty</Text>
              <TouchableOpacity onPress={() => router.replace('/(tabs)/store' as any)}>
                <Text style={styles.shopLink}>Browse products</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {cart?.items?.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal ({cart.items.length} items)</Text>
            <Text style={styles.totalValue}>₹{subtotal}</Text>
          </View>
          <Button onPress={() => router.push('/store/checkout' as any)} fullWidth>
            Proceed to Checkout · ₹{subtotal}
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  list: { padding: spacing[5], gap: spacing[3] },
  cartItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  itemImage: { width: 60, height: 60, borderRadius: radii.lg, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  itemVariant: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemPrice: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.success, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.borderMedium, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  qtyValue: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary, minWidth: 24, textAlign: 'center' },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: 16, color: colors.textMuted, marginTop: spacing[3] },
  shopLink: { fontFamily: 'Inter', fontSize: 15, color: colors.marigoldDark, fontWeight: '700', marginTop: spacing[2] },
  footer: { padding: spacing[5], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas, gap: spacing[3] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted },
  totalValue: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.success },
});
