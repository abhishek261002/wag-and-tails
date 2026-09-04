import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

export default function EarningsScreen() {
  const [earnings, setEarnings] = useState<any>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    wagApi.partner.getEarnings().then(setEarnings).catch(() => {});
  }, []);

  const handleRequestPayout = async () => {
    if (!earnings?.pending || earnings.pending <= 0) {
      Alert.alert('Nothing to withdraw', 'You have no pending earnings to request.');
      return;
    }
    Alert.alert(
      'Request Payout',
      `Request ₹${earnings.pending} payout to your registered bank account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: async () => {
            setRequesting(true);
            try {
              await wagApi.partner.requestPayout(earnings.pending);
              Alert.alert('Payout requested! 💰', 'You\'ll receive payment within 2-3 business days.');
              wagApi.partner.getEarnings().then(setEarnings).catch(() => {});
            } catch (err: any) {
              Alert.alert('Failed', err?.message ?? 'Please try again.');
            } finally {
              setRequesting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Earnings</Text>

        {/* Summary cards */}
        <View style={styles.kpiRow}>
          <KpiCard label="Total Earned" value={`₹${earnings?.total ?? 0}`} emoji="💰" />
          <KpiCard label="Pending" value={`₹${earnings?.pending ?? 0}`} emoji="⏳" accent={colors.warning} />
        </View>

        <Card style={styles.payoutCard}>
          <Text style={styles.payoutTitle}>Available for withdrawal</Text>
          <Text style={styles.payoutAmount}>₹{earnings?.pending ?? 0}</Text>
          <Button
            onPress={handleRequestPayout}
            loading={requesting}
            fullWidth
            style={{ marginTop: spacing[4] }}
          >
            Request Payout
          </Button>
        </Card>

        {/* Recent payouts */}
        <Text style={styles.sectionTitle}>Recent Payouts</Text>
        {(earnings?.payouts ?? []).length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 36 }}>📊</Text>
            <Text style={styles.emptyText}>No payouts yet</Text>
          </View>
        ) : (
          earnings.payouts.map((p: any) => (
            <Card key={p.id} style={styles.payoutRow}>
              <View style={styles.payoutLeft}>
                <Text style={styles.payoutNet}>₹{p.netAmount}</Text>
                <Text style={styles.payoutDate}>
                  {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(p.status) }]}>
                <Text style={styles.statusText}>{p.status}</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ label, value, emoji, accent }: { label: string; value: string; emoji: string; accent?: string }) {
  return (
    <View style={[styles.kpiCard, accent ? { borderColor: accent } : {}]}>
      <Text style={{ fontSize: 28, marginBottom: spacing[2] }}>{emoji}</Text>
      <Text style={[styles.kpiValue, accent ? { color: accent } : {}]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    paid: colors.successLight,
    approved: colors.infoLight,
    pending: colors.warningLight,
    requested: colors.marigoldBg,
    failed: colors.errorLight,
  };
  return map[status] ?? colors.gray100;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[5], paddingBottom: spacing[12] },
  title: { fontFamily: 'Inter', fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[5] },
  kpiRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] },
  kpiCard: { flex: 1, backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center' },
  kpiValue: { fontFamily: 'Inter', fontSize: 22, fontWeight: '800', color: colors.brandBrown },
  kpiLabel: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  payoutCard: { marginBottom: spacing[5], alignItems: 'center', padding: spacing[6] },
  payoutTitle: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginBottom: spacing[2] },
  payoutAmount: { fontFamily: 'Inter', fontSize: 40, fontWeight: '800', color: colors.brandBrown },
  sectionTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[3] },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2], padding: spacing[4] },
  payoutLeft: {},
  payoutNet: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  payoutDate: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: radii.full, paddingHorizontal: spacing[3], paddingVertical: 4 },
  statusText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: spacing[8] },
  emptyText: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginTop: spacing[2] },
});
