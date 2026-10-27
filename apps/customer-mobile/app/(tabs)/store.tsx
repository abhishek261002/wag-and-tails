import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Image, ActivityIndicator, Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { Icon } from '@wag/ui-mobile';
import { wagApi } from '../../src/lib/api';

export default function StoreScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // What is actually searched for: follows `search` after a short pause, so typing doesn't fire a request per key.
  const [query, setQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Only the newest request may update the screen: a slow answer for "do" must not overwrite the one for "dog".
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const mine = ++requestId.current;
    setLoading(true);
    try {
      const [cats, prods, cart] = await Promise.all([
        wagApi.store.listCategories(),
        wagApi.store.listProducts({ categoryId: selectedCategory ?? undefined, search: query || undefined }),
        wagApi.store.getCart(),
      ]);
      if (mine !== requestId.current) return;
      setCategories(cats);
      setProducts(prods.data);
      setCartCount(cart.items.length);
      setFailed(false);
    } catch {
      if (mine === requestId.current) setFailed(true);
    } finally {
      if (mine === requestId.current) setLoading(false);
    }
  }, [selectedCategory, query]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const addToCart = async (productId: string) => {
    try {
      const cart = await wagApi.store.addToCart(productId, 1);
      setCartCount(cart.items.length);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Pet Store</Text>
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => router.push('/store/cart' as any)}
          accessibilityLabel={`Cart with ${cartCount} items`}
        >
          <Icon name="bag" size={20} color={colors.textPrimary} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={() => { setQuery(search.trim()); Keyboard.dismiss(); }}
          autoCorrect={false}
          accessibilityLabel="Search products"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); setQuery(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Clear search">
            <Icon name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <FlatList
        data={[{ id: null, name: 'All', slug: 'all' }, ...categories]}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(c) => c.id ?? 'all'}
        // A horizontal list inside a column grows and shrinks with the space left by its siblings, which cropped
        // the pills (big product grid) or stretched them (few results, keyboard open). Pin it to its own height.
        style={styles.catListWrap}
        contentContainerStyle={styles.catList}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[styles.catChip, selectedCategory === cat.id && styles.catChipActive]}
            onPress={() => setSelectedCategory(cat.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedCategory === cat.id }}
          >
            <Text style={[styles.catText, selectedCategory === cat.id && styles.catTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Products */}
      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.productGrid}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.productList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBrown} />}
        columnWrapperStyle={{ gap: spacing[3] }}
        renderItem={({ item: product }) => (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => router.push({ pathname: '/store/[id]', params: { id: product.id } } as any)}
            activeOpacity={0.9}
            accessibilityLabel={product.name}
          >
            <View style={styles.productImage}>
              {product.imageUrls?.[0] ? (
                <Image source={{ uri: product.imageUrls[0] }} style={styles.productImg} />
              ) : (
                <Icon name="bag" size={32} color={colors.textDisabled} />
              )}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.productPrice}>₹{product.retailPrice}</Text>
                {Number(product.mrp) > Number(product.retailPrice) && (
                  <Text style={styles.productMrp}>₹{product.mrp}</Text>
                )}
              </View>
              {product.allergyWarnings?.length > 0 && (
                <Text style={styles.allergyWarn} numberOfLines={1}>
                  ⚠️ {product.allergyWarnings.join(', ')}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.addToCartBtn}
              onPress={() => addToCart(product.id)}
              accessibilityLabel={`Add ${product.name} to cart`}
            >
              <Text style={styles.addToCartText}>+ Cart</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color={colors.brandBrown} />
            ) : failed ? (
              <TouchableOpacity onPress={load} accessibilityRole="button">
                <Text style={styles.emptyText}>Couldn't load products. Tap to try again.</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Icon name="bag" size={40} color={colors.textDisabled} />
                <Text style={styles.emptyText}>{query ? `No products match "${query}"` : 'No products found'}</Text>
              </>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary },
  cartBtn: { position: 'relative', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.marigold, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { fontFamily: 'Inter', fontSize: 10, fontWeight: '800', color: colors.white },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing[5], marginBottom: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing[4], height: 48 },
  searchIcon: { fontSize: 16, marginRight: spacing[2] },
  searchInput: { flex: 1, fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary },
  catListWrap: { flexGrow: 0, flexShrink: 0, height: 48 },
  catList: { paddingHorizontal: spacing[5], gap: spacing[2], alignItems: 'center' },
  productList: { flex: 1 },
  catChip: { height: 36, justifyContent: 'center', paddingHorizontal: spacing[4], borderRadius: radii.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight },
  catChipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  catText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  catTextActive: { color: colors.white },
  productGrid: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  productCard: { flex: 1, backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginBottom: spacing[3] },
  productImage: { height: 120, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  productImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  productInfo: { padding: spacing[3] },
  productName: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
  productPrice: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '800', color: colors.brandBrown },
  productMrp: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, color: colors.textMuted, textDecorationLine: 'line-through' },
  allergyWarn: { fontFamily: 'Inter', fontSize: 10, color: colors.warning, marginTop: 2 },
  addToCartBtn: { marginHorizontal: spacing[3], marginBottom: spacing[3], backgroundColor: colors.brandBrown, borderRadius: radii.md, paddingVertical: spacing[2], alignItems: 'center' },
  addToCartText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.white },
  empty: { alignItems: 'center', paddingTop: spacing[12] },
  emptyText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, marginTop: spacing[3] },
});
