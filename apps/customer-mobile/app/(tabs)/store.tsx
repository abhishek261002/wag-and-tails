import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

export default function StoreScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cats, prods, cart] = await Promise.all([
        wagApi.store.listCategories(),
        wagApi.store.listProducts({ categoryId: selectedCategory ?? undefined, search: search || undefined }),
        wagApi.store.getCart(),
      ]);
      setCategories(cats);
      setProducts(prods.data);
      setCartCount(cart.items.length);
    } catch {}
  }, [selectedCategory, search]);

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
          <Text style={{ fontSize: 22 }}>🛒</Text>
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          accessibilityLabel="Search products"
        />
      </View>

      {/* Categories */}
      <FlatList
        data={[{ id: null, name: 'All', slug: 'all' }, ...categories]}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(c) => c.id ?? 'all'}
        contentContainerStyle={styles.catList}
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
                <Text style={{ fontSize: 36 }}>📦</Text>
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
            <Text style={{ fontSize: 40 }}>🛒</Text>
            <Text style={styles.emptyText}>No products found</Text>
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
  catList: { paddingHorizontal: spacing[5], gap: spacing[2], marginBottom: spacing[3] },
  catChip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radii.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight },
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
