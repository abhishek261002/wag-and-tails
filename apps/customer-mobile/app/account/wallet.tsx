import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

export default function WalletScreen() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    wagApi.client.get<any>('/users/me').then(setProfile).catch(() => {});
  }, []);

  const balance = Number(profile?.customerProfile?.walletBalance ?? 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Wallet & Credits</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>₹{balance.toFixed(2)}</Text>
          <Text style={styles.balanceNote}>Credits are applied automatically at checkout</Text>
        </View>
        <View style={styles.emptyTransactions}>
          <Text style={{ fontSize: 40 }}>📋</Text>
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySub}>Your wallet activity will appear here</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { padding: spacing[5] },
  balanceCard: { backgroundColor: colors.brandBrown, borderRadius: radii['2xl'], padding: spacing[8], alignItems: 'center', marginBottom: spacing[6] },
  balanceLabel: { fontFamily: 'Inter', fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: spacing[2] },
  balanceValue: { fontFamily: 'Inter', fontSize: 48, fontWeight: '800', color: colors.white },
  balanceNote: { fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: spacing[2], textAlign: 'center' },
  emptyTransactions: { alignItems: 'center', paddingTop: spacing[8] },
  emptyText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: spacing[3] },
  emptySub: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: spacing[1] },
});
