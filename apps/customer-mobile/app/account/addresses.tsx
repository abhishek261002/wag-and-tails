import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const load = () => {
    wagApi.client.get<any>('/users/me').then((u) => setAddresses(u?.addresses ?? [])).catch(() => {});
  };

  // Reload whenever the screen comes back into view (e.g. after adding an address).
  useFocusEffect(useCallback(() => { load(); }, []));

  const deleteAddress = (id: string) => {
    Alert.alert('Delete address?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await wagApi.client.delete(`/users/me/addresses/${id}`);
          load();
        } catch {}
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Saved Addresses</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: addr }) => (
          <View style={styles.addrCard}>
            <View style={{ flex: 1 }}>
              <View style={styles.addrRow}>
                <Text style={styles.addrLabel}>{addr.label}</Text>
                {addr.isDefault && <View style={styles.defaultBadge}><Text style={styles.defaultText}>Default</Text></View>}
              </View>
              <Text style={styles.addrLine}>{addr.line1}</Text>
              {addr.line2 && <Text style={styles.addrLine}>{addr.line2}</Text>}
              <Text style={styles.addrCity}>{addr.city}, {addr.state} {addr.pincode}</Text>
              {addr.serviceable === false && <Text style={styles.outside}>Outside our service area</Text>}
            </View>
            <TouchableOpacity onPress={() => deleteAddress(addr.id)} accessibilityLabel="Delete address">
              <Icon name="trash" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No saved addresses yet.</Text>}
        ListFooterComponent={
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/account/address-new' as any)}>
            <Text style={styles.addBtnText}>+ Add a New Address</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing[6] },
  outside: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.error, marginTop: 4 },
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  list: { padding: spacing[5], gap: spacing[3] },
  addrCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 4 },
  addrLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  defaultBadge: { backgroundColor: colors.marigoldBg, borderRadius: radii.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  defaultText: { fontFamily: 'Inter', fontSize: 10, fontWeight: '700', color: colors.marigoldDark },
  addrLine: { fontFamily: 'Inter', fontSize: 14, color: colors.textSecondary },
  addrCity: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  addBtn: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], borderWidth: 2, borderColor: colors.borderLight, borderStyle: 'dashed', alignItems: 'center', marginTop: spacing[2] },
  addBtnText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.marigoldDark },
  addForm: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.borderLight, marginTop: spacing[2] },
  addTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[4] },
  fieldRow: { marginBottom: spacing[3] },
  fieldLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: spacing[1] },
  fieldInput: { backgroundColor: colors.canvas, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, paddingHorizontal: spacing[3], paddingVertical: spacing[3], fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary },
});
