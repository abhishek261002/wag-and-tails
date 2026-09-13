import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { Icon, RowItem } from '@wag/ui-mobile';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

export default function AccountScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [petCount, setPetCount] = useState(0);
  const { clearTokens } = useAuthStore();

  useEffect(() => {
    wagApi.client.get('/users/me').then((d) => setProfile(d)).catch(() => {});
    wagApi.client.get('/users/me/wallet').then((d) => setWallet(d as any)).catch(() => {});
    wagApi.pets.list().then((p) => setPetCount(p.length)).catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await clearTokens();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const name = profile?.profile
    ? `${profile.profile.firstName} ${profile.profile.lastName}`
    : 'My Account';
  const addressCount = profile?.addresses?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Account</Text>

        {/* Profile hero — mirrors the prototype's card--brand */}
        <TouchableOpacity style={styles.heroCard} onPress={() => {}} activeOpacity={0.9}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{name}</Text>
            <Text style={styles.heroPhone}>{profile?.phone ?? ''}</Text>
            <View style={styles.memberPill}>
              <Text style={styles.memberPillText}>Member</Text>
            </View>
          </View>
          <Icon name="chev" size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {/* Stat tiles */}
        <View style={styles.statsRow}>
          <StatTile icon="wallet" tone="ok" value={`₹${wallet?.balance ?? 0}`} label="Wallet" onPress={() => {}} />
          <StatTile icon="gift" tone="accent" value="0" label="Offers" onPress={() => router.push('/account/offers')} />
          <StatTile icon="bell" tone="brand" value="" label="Alerts" onPress={() => router.push('/account/notifications')} />
        </View>

        <Section title="Your details">
          <RowItem icon="user" title="Personal information" sub="Name, phone, email" onPress={() => {}} />
          <RowItem icon="pin" title="Saved addresses" value={String(addressCount)} onPress={() => router.push('/account/addresses' as any)} />
          <RowItem icon="card" title="Payment methods" onPress={() => {}} />
          <RowItem icon="paw" title="My pets" value={String(petCount)} onPress={() => router.push('/(tabs)/bookings')} />
        </Section>

        <Section title="Preferences">
          <RowItem icon="bell" title="Notifications" sub="Booking updates, offers, reminders" onPress={() => router.push('/account/notifications')} />
          <RowItem icon="globe" title="Language" value="English" chevron={false} />
        </Section>

        <Section title="Support">
          <RowItem icon="help" title="Help & support" sub="FAQs and contact" onPress={() => router.push('/support')} />
          <RowItem icon="gift" title="Refer a friend" sub="Both of you get ₹200" onPress={() => {}} />
          <RowItem icon="doc" title="Terms of service" onPress={() => router.push('/legal/terms' as any)} />
          <RowItem icon="shield" title="Privacy policy" onPress={() => router.push('/legal/privacy' as any)} />
        </Section>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Log out">
          <Icon name="logout" size={17} color={colors.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Wag & Tails v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function StatTile({ icon, tone, value, label, onPress }: {
  icon: any; tone: 'brand' | 'accent' | 'ok'; value: string; label: string; onPress: () => void;
}) {
  const bg = tone === 'ok' ? colors.successLight : tone === 'accent' ? colors.marigoldBg : colors.biscuitLighter;
  const fg = tone === 'ok' ? colors.success : tone === 'accent' ? colors.marigoldDark : colors.brandBrown;
  return (
    <TouchableOpacity style={styles.statTile} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={18} color={fg} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: spacing[12] },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[4] },

  heroCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.brandBrown, borderRadius: radii.xl, padding: spacing[4], marginHorizontal: spacing[5] },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.marigold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.white },
  heroName: { fontFamily: 'Inter', fontSize: 15.5, fontWeight: '700', color: colors.white },
  heroPhone: { fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  memberPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 3, marginTop: spacing[2] },
  memberPillText: { fontFamily: 'Inter', fontSize: 11, fontWeight: '600', color: colors.white },

  statsRow: { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing[5], marginTop: spacing[4] },
  statTile: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.lg, paddingVertical: spacing[4], alignItems: 'center' },
  statIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: spacing[2] },
  statLabel: { fontFamily: 'Inter', fontSize: 10.5, color: colors.textMuted, marginTop: 1 },

  section: { marginTop: spacing[6] },
  sectionTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: spacing[5], paddingBottom: spacing[2] },
  sectionCard: { backgroundColor: colors.white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderLight },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], marginHorizontal: spacing[5], marginTop: spacing[6], borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.error, paddingVertical: spacing[4] },
  logoutText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.error },
  version: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing[5] },
});
