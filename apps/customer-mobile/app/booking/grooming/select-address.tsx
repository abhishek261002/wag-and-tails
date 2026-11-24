import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { useBookingStore } from '../../../src/store/booking.store';
import { useBookingConfig, websiteCity, websiteAreasOf } from '../../../src/lib/website';
import type { WebsiteCity } from '@wag/api-client';
import { goBack } from '../../../src/lib/nav';

export default function SelectAddressScreen() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const { groomingDraft, updateGroomingDraft } = useBookingStore();
  const cfg = useBookingConfig();
  // One GPS city can be several website cities (Mumbai → North / South / Navi Mumbai): ask which one.
  const [choose, setChoose] = useState<{ addr: any; options: WebsiteCity[] } | null>(null);

  // Reload on focus so an address added from the next screen shows up when the user returns.
  useFocusEffect(useCallback(() => {
    wagApi.client.get<any>('/users/me').then((u) => setAddresses(u?.addresses ?? [])).catch(() => {});
  }, []));

  const pickAddress = (addr: any, city: WebsiteCity | null) => {
    updateGroomingDraft({
      addressId: addr.id,
      addressLine: `${addr.line1}, ${addr.city}`,
      cityId: city?.id ?? null,
      cityName: city?.name ?? null,
    });
    setChoose(null);
    // Connected: address was asked first, packages (with this city's prices) come next.
    router.push(cfg?.connected ? '/booking/grooming/select-package' : '/booking/grooming/groomer-note');
  };

  const selectAddress = (addr: any) => {
    if (!cfg?.connected) return pickAddress(addr, null);
    if (!/^\d{6}$/.test(String(addr.pincode ?? ''))) {
      Alert.alert('Pincode needed', 'Please add the 6-digit pincode to this address (Account → Addresses), or add a new address.');
      return;
    }
    const exact = websiteCity(cfg, addr.city);
    if (exact) return pickAddress(addr, exact);
    const areas = websiteAreasOf(cfg, addr.city);
    if (areas.length === 1) return pickAddress(addr, areas[0]!);
    if (areas.length > 1) return setChoose({ addr, options: areas });
    Alert.alert('Not in your area yet', `We do not offer home grooming in ${addr.city} yet. We are in ${(cfg.cities ?? []).map((c) => c.name).join(', ')}.`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Service Address</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: addr }) => {
          const isSelected = groomingDraft.addressId === addr.id;
          return (
            <TouchableOpacity
              style={[styles.addrCard, isSelected && styles.addrCardSelected]}
              onPress={() => selectAddress(addr)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.addrLabelRow}>
                  <Text style={styles.addrLabel}>{addr.label}</Text>
                  {addr.isDefault && (
                    <View style={styles.defaultBadge}><Text style={styles.defaultText}>Default</Text></View>
                  )}
                </View>
                <Text style={styles.addrLine}>{addr.line1}</Text>
                {addr.line2 && <Text style={styles.addrLine}>{addr.line2}</Text>}
                <Text style={styles.addrCity}>{addr.city}, {addr.state} {addr.pincode}</Text>
              </View>
              {isSelected && <Text style={{ fontSize: 22, color: colors.success }}>✓</Text>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="pin" size={40} color={colors.textDisabled} />
            <Text style={styles.emptyText}>No saved addresses</Text>
            <TouchableOpacity onPress={() => router.push('/account/address-new' as any)}>
              <Text style={styles.addAddr}>+ Add an address</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          addresses.length > 0 ? (
            <TouchableOpacity
              style={styles.addNewBtn}
              onPress={() => router.push('/account/address-new' as any)}
            >
              <Text style={styles.addNewText}>+ Add a new address</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      {choose ? (
        <View style={styles.chooser}>
          <Text style={styles.chooserTitle}>Which area is this address in?</Text>
          <Text style={styles.chooserSub}>{choose.addr.line1}, {choose.addr.city}</Text>
          {choose.options.map((c) => (
            <TouchableOpacity key={c.id} style={styles.chooserOpt} onPress={() => pickAddress(choose.addr, c)} accessibilityRole="button">
              <Text style={styles.chooserOptText}>{c.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setChoose(null)} style={{ marginTop: spacing[2] }}><Text style={styles.chooserCancel}>Cancel</Text></TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chooser: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing[5], paddingBottom: spacing[8], borderTopWidth: 1, borderColor: colors.borderLight, gap: spacing[2] },
  chooserTitle: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  chooserSub: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginBottom: spacing[2] },
  chooserOpt: { paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight },
  chooserOptText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  chooserCancel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.brandBrown, textAlign: 'center' },
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  list: { padding: spacing[5], gap: spacing[3] },
  addrCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1.5, borderColor: colors.borderLight, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  addrCardSelected: { borderColor: colors.success, backgroundColor: colors.successLight },
  addrLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 4 },
  addrLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  defaultBadge: { backgroundColor: colors.marigoldBg, borderRadius: radii.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  defaultText: { fontFamily: 'Inter', fontSize: 10, fontWeight: '700', color: colors.marigoldDark },
  addrLine: { fontFamily: 'Inter', fontSize: 14, color: colors.textSecondary },
  addrCity: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: 15, color: colors.textMuted, marginTop: spacing[3] },
  addAddr: { fontFamily: 'Inter', fontSize: 15, color: colors.marigoldDark, fontWeight: '700', marginTop: spacing[2] },
  addNewBtn: { marginTop: spacing[2], alignItems: 'center', paddingVertical: spacing[4] },
  addNewText: { fontFamily: 'Inter', fontSize: 14, color: colors.marigoldDark, fontWeight: '700' },
});
