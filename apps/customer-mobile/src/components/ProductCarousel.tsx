import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import type { Product } from '@wag/shared-types';
import { Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../lib/api';

const COUNT = 7;

/** A short strip of store products on the home page, with "See all" going to the Store tab. Hidden if the store is empty. */
export function ProductCarousel() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let alive = true;
    wagApi.store.listProducts({ page: 1, pageSize: COUNT })
      .then((r) => { if (alive) setProducts((r.data ?? []).filter((p) => p.isActive !== false).slice(0, COUNT)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (products.length === 0) return null;

  return (
    <View>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Shop for your pet</Text>
          <Text style={styles.sub}>Food, treats and grooming care</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/store' as any)} accessibilityRole="button" accessibilityLabel="See all products">
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {products.map((p) => {
          const img = resolveMediaUrl(p.imageUrls?.[0]);
          const off = Number(p.mrp) > Number(p.retailPrice) ? Math.round((1 - Number(p.retailPrice) / Number(p.mrp)) * 100) : 0;
          return (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/store/[id]', params: { id: p.id } } as any)}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ₹${Number(p.retailPrice)}`}
            >
              <View style={styles.imgBox}>
                {img ? <Image source={{ uri: img }} style={styles.img} resizeMode="cover" /> : <Icon name="bag" size={26} color={colors.textDisabled} />}
                {off > 0 && <View style={styles.off}><Text style={styles.offText}>{off}% off</Text></View>}
              </View>
              <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
              <Text style={styles.price}>₹{Number(p.retailPrice)}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={[styles.card, styles.more]} onPress={() => router.push('/(tabs)/store' as any)} accessibilityRole="button" accessibilityLabel="See all products">
          <View style={styles.moreIcon}><Icon name="chev" size={18} color={colors.brandBrown} /></View>
          <Text style={styles.moreText}>See all</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const CARD_W = 112;
const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing[5], marginBottom: spacing[3] },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.25 },
  sub: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  seeAll: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.marigoldDark },
  row: { gap: spacing[3], paddingRight: spacing[2] },
  card: { width: CARD_W, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.lg, padding: spacing[2] },
  imgBox: { height: 76, borderRadius: radii.md, backgroundColor: colors.biscuitLighter, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  off: { position: 'absolute', top: 4, left: 4, backgroundColor: colors.success, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  offText: { fontFamily: 'Inter', fontSize: 9.5, fontWeight: '800', color: colors.white },
  name: { fontFamily: 'Inter', fontSize: 11.5, fontWeight: '600', color: colors.textPrimary, marginTop: 6, minHeight: 30, lineHeight: 15 },
  price: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.brandBrown, marginTop: 2 },
  more: { alignItems: 'center', justifyContent: 'center', gap: spacing[2], width: 84, backgroundColor: colors.biscuitLighter },
  moreIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: 'Inter', fontSize: 12.5, fontWeight: '800', color: colors.brandBrown },
});
