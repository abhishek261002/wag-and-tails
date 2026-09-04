import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { useBookingStore } from '../../../src/store/booking.store';

export default function SelectAddressScreen() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const { groomingDraft, updateGroomingDraft } = useBookingStore();

  useEffect(() => {
    wagApi.client.get<any[]>('/users/addresses').then(setAddresses).catch(() => {});
  }, []);

  const selectAddress = (addr: any) => {
    updateGroomingDraft({
      addressId: addr.id,
      addressLine: `${addr.line1}, ${addr.city}`,
    });
    router.push('/booking/grooming/groomer-note');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
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
            <Text style={{ fontSize: 40 }}>📍</Text>
            <Text style={styles.emptyText}>No saved addresses</Text>
            <TouchableOpacity onPress={() => router.push('/account/addresses' as any)}>
              <Text style={styles.addAddr}>+ Add an address</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          addresses.length > 0 ? (
            <TouchableOpacity
              style={styles.addNewBtn}
              onPress={() => router.push('/account/addresses' as any)}
            >
              <Text style={styles.addNewText}>+ Add a new address</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
