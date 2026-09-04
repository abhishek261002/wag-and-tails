import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

export default function PartnerStoreScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    Promise.all([
      wagApi.store.listProducts(),
      wagApi.store.getCart(),
    ]).then(([prods, cart]) => {
      setProducts(prods.data);
      setCartCount(cart.items.length);
    }).catch(() => {});
  }, []);

  const addToCart = async (productId: string) => {
    try {
      const cart = await wagApi.store.addToCart(productId, 1);
      setCartCount(cart.items.length);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Partner Store</Text>
        <View style={styles.tradeBadge}><Text style={styles.tradeText}>Trade Pricing</Text></View>
        <TouchableOpacity style={styles.cartBtn} accessibilityLabel={`Cart, ${cartCount} items`}>
          <Text style={{ fontSize: 22 }}>🛒</Text>
          {cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}
        </TouchableOpacity>
      </View>
      <Text style={styles.tradeSub}>Grooming supplies and pet products at exclusive partner prices</Text>

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: spacing[3] }}
        renderItem={({ item: p }) => (
          <View style={styles.productCard}>
            <View style={styles.productImg}>
              {p.imageUrls?.[0]
                ? <Image source={{ uri: p.imageUrls[0] }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                : <Text style={{ fontSize: 32 }}>📦</Text>}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.tradePrice}>₹{p.tradePrice}</Text>
                <Text style={styles.retailPrice}>₹{p.retailPrice}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(p.id)} accessibilityLabel={`Add ${p.name} to cart`}>
              <Text style={styles.addBtnText}>+ Cart</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[2], gap: spacing[2] },
  title: { fontFamily: 'Inter', fontSize: 22, fontWeight: '800', color: colors.textPrimary, flex: 1 },
  tradeBadge: { backgroundColor: colors.successLight, borderRadius: radii.full, paddingHorizontal: spacing[3], paddingVertical: 3 },
  tradeText: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.success },
  cartBtn: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.marigold, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white },
  tradeSub: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, paddingHorizontal: spacing[5], marginBottom: spacing[3] },
  grid: { paddingHorizontal: spacing[4], paddingBottom: spacing[10] },
  productCard: { flex: 1, backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginBottom: spacing[3] },
  productImg: { height: 110, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  productInfo: { padding: spacing[3] },
  productName: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
  tradePrice: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.success },
  retailPrice: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, textDecorationLine: 'line-through' },
  addBtn: { marginHorizontal: spacing[3], marginBottom: spacing[3], backgroundColor: colors.brandBrown, borderRadius: radii.md, paddingVertical: spacing[2], alignItems: 'center' },
  addBtnText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.white },
});
