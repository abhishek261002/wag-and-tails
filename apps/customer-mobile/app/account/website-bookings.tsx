import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';
import type { WebsiteBooking } from '@wag/api-client';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';
import { errorMessage } from '../../src/lib/website';

// Bookings made on wagandtails.in or by phone with the same mobile number (one identity, ground rule 4).
export default function WebsiteBookingsScreen() {
  const [list, setList] = useState<WebsiteBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    wagApi.website.websiteBookings()
      .then((r) => { setList(r.bookings ?? []); setError(null); })
      .catch((e) => { setError(errorMessage(e, 'Could not load your bookings')); setList((l) => l ?? []); });
  }, []));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Website & phone bookings</Text>
        <View style={{ width: 50 }} />
      </View>
      {!list ? (
        <ActivityIndicator color={colors.brandBrown} style={{ marginTop: spacing[8] }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(b) => b.ref}
          contentContainerStyle={styles.list}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          renderItem={({ item: b }) => (
            <TouchableOpacity
              style={styles.card}
              disabled={!b.bookingId}
              onPress={() => b.bookingId && router.push({ pathname: '/booking/[id]', params: { id: b.bookingId } } as any)}
              accessibilityRole="button"
            >
              <View style={styles.cardTop}>
                <Text style={styles.pkg}>{b.package}</Text>
                <Text style={[styles.status, b.status === 'Cancelled' && { color: colors.error }, b.status === 'Completed' && { color: colors.success }]}>{b.status}</Text>
              </View>
              <Text style={styles.meta}>{b.date} · {b.slot}</Text>
              {b.pet ? <Text style={styles.meta}>{b.pet}</Text> : null}
              <Text style={styles.meta}>₹{b.total}{b.payMode ? ` · ${b.payMode}` : ''} · {b.source} · {b.ref}{b.groomer ? ` · ${b.groomer}` : ''}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No website or phone bookings with this number yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  list: { paddingHorizontal: spacing[5], paddingBottom: spacing[10], gap: spacing[3] },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pkg: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary, flex: 1, paddingRight: spacing[2] },
  status: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.brandBrown },
  meta: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing[8] },
  error: { fontFamily: 'Inter', fontSize: 13, color: colors.error, marginBottom: spacing[3] },
});
