import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

export default function PartnerProductDetailScreen() {
  const { id: productId } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!productId) return;
    wagApi.store.getProduct(productId).then((p) => {
      setProduct(p);
      if (p.variants?.length > 0) setSelectedVariant(p.variants[0]);
    }).catch(() => {});
  }, [productId]);

  const addToCart = async () => {
    if (!product) return;
    setAdding(true);
    try {
      await wagApi.store.addToCart(product.id, 1, selectedVariant?.id);
      Alert.alert('Added to cart! 🛒', product.name, [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'View Cart', onPress: () => router.push('/store/cart' as any) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not add to cart');
    } finally {
      setAdding(false);
    }
  };

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter' }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tradePrice = Number(selectedVariant ? selectedVariant.tradePrice : product.tradePrice);
  const retailPrice = Number(selectedVariant ? selectedVariant.retailPrice : product.retailPrice);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/store/cart' as any)} accessibilityLabel="View cart">
          <Text style={{ fontSize: 24 }}>🛒</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}><Text style={{ fontSize: 80 }}>📦</Text></View>

        <View style={styles.tradeBadge}><Text style={styles.tradeText}>Partner trade price</Text></View>
        <Text style={styles.productName}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{tradePrice}</Text>
          <Text style={styles.mrp}>₹{retailPrice}</Text>
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{Math.round((1 - tradePrice / retailPrice) * 100)}% below retail</Text>
          </View>
        </View>
        <Text style={styles.rating}>⭐ {product.rating} ({product.reviewCount} reviews)</Text>

        {product.variants?.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Size / Variant</Text>
            <View style={styles.variantsRow}>
              {product.variants.map((v: any) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.variantChip, selectedVariant?.id === v.id && styles.variantChipActive]}
                  onPress={() => setSelectedVariant(v)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedVariant?.id === v.id }}
                >
                  <Text style={[styles.variantText, selectedVariant?.id === v.id && styles.variantTextActive]}>{v.name}</Text>
                  {v.stockQty === 0 && <Text style={styles.outOfStock}>Out of stock</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {product.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this product</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerPrice}>
          <Text style={styles.footerPriceLabel}>Trade price</Text>
          <Text style={styles.footerPriceValue}>₹{tradePrice}</Text>
        </View>
        <Button onPress={addToCart} loading={adding} style={{ flex: 1 }} disabled={selectedVariant?.stockQty === 0}>
          {selectedVariant?.stockQty === 0 ? 'Out of Stock' : 'Add to Cart 🛒'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
  imageContainer: { height: 260, backgroundColor: colors.white, borderRadius: radii['2xl'], alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  tradeBadge: { alignSelf: 'flex-start', backgroundColor: colors.successLight, borderRadius: radii.full, paddingHorizontal: spacing[3], paddingVertical: 3, marginBottom: spacing[2] },
  tradeText: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.success },
  productName: { fontFamily: 'Inter', fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[3] },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[2] },
  price: { fontFamily: 'Inter', fontSize: 28, fontWeight: '800', color: colors.success },
  mrp: { fontFamily: 'Inter', fontSize: 16, color: colors.textMuted, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: colors.successLight, borderRadius: radii.full, paddingHorizontal: spacing[2], paddingVertical: 3 },
  discountText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.success },
  rating: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginBottom: spacing[4] },
  section: { marginBottom: spacing[4] },
  sectionTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[3] },
  variantsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  variantChip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  variantChipActive: { borderColor: colors.brandBrown, backgroundColor: colors.biscuitLight },
  variantText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  variantTextActive: { color: colors.brandBrown },
  outOfStock: { fontFamily: 'Inter', fontSize: 10, color: colors.error },
  description: { fontFamily: 'Inter', fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
  footerPrice: { alignItems: 'flex-start' },
  footerPriceLabel: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted },
  footerPriceValue: { fontFamily: 'Inter', fontSize: 22, fontWeight: '800', color: colors.success },
});
