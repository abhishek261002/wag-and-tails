import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { Icon } from '@wag/ui-mobile';
import { wagApi } from '../../src/lib/api';

const PAGE_SIZE = 20;

export default function PartnerStoreScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const nextPage = useRef(2);
  const fetchingMore = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [prods, cart] = await Promise.all([
        wagApi.store.listProducts({ page: 1, pageSize: PAGE_SIZE }),
        wagApi.store.getCart(),
      ]);
      setProducts(prods.data);
      setTotal(prods.total);
      nextPage.current = 2;
      setCartCount(cart.items.length);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (fetchingMore.current || loading || products.length >= total) return;
    fetchingMore.current = true;
    setLoadingMore(true);
    try {
      const res = await wagApi.store.listProducts({ page: nextPage.current, pageSize: PAGE_SIZE });
      nextPage.current += 1;
      setTotal(res.total);
      setProducts((cur) => [...cur, ...res.data.filter((p) => !cur.some((c) => c.id === p.id))]);
    } catch {
      // The next scroll tries again.
    } finally {
      fetchingMore.current = false;
      setLoadingMore(false);
    }
  };

  // The plugin's "Partner discount %" decides this. At 0 partners pay the website's price, so nothing claims otherwise.
  const partnerPrices = products.some((p) => Number(p.tradePrice) < Number(p.retailPrice));

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
        {partnerPrices && <View style={styles.tradeBadge}><Text style={styles.tradeText}>Partner prices</Text></View>}
        <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/store/cart' as any)} accessibilityLabel={`Cart, ${cartCount} items`}>
          <Icon name="bag" size={20} color={colors.textPrimary} />
          {cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}
        </TouchableOpacity>
      </View>
      <Text style={styles.tradeSub}>Grooming supplies and pet products{partnerPrices ? ' at partner prices' : ''}</Text>

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: spacing[3] }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: spacing[4] }} color={colors.brandBrown} /> : null}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: spacing[10] }} color={colors.brandBrown} />
          : failed ? (
            <TouchableOpacity onPress={load} accessibilityRole="button"><Text style={styles.emptyText}>Could not load products. Tap to try again.</Text></TouchableOpacity>
          ) : <Text style={styles.emptyText}>No products yet</Text>
        }
        renderItem={({ item: p }) => (
          <TouchableOpacity style={styles.productCard} onPress={() => router.push({ pathname: '/store/[id]', params: { id: p.id } } as any)} accessibilityLabel={`View ${p.name}`}>
            <View style={styles.productImg}>
              {p.imageUrls?.[0]
                ? <Image source={{ uri: p.imageUrls[0] }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                : <Icon name="bag" size={28} color={colors.textDisabled} />}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.tradePrice}>₹{Number(p.tradePrice)}</Text>
                {/* Struck through: the website price when partners pay less, otherwise the MRP, as the website shows it. */}
                {struckPrice(p.tradePrice, p.retailPrice, p.mrp) != null && <Text style={styles.retailPrice}>₹{struckPrice(p.tradePrice, p.retailPrice, p.mrp)}</Text>}
              </View>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(p.id)} accessibilityLabel={`Add ${p.name} to cart`}>
              <Text style={styles.addBtnText}>+ Cart</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function struckPrice(pay: unknown, retail: unknown, mrp: unknown): number | null {
  const reference = Number(pay) < Number(retail) ? Number(retail) : Number(mrp);
  return reference > Number(pay) ? reference : null;
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing[10] },
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
