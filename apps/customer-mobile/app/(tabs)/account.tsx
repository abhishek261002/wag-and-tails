import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

export default function AccountScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const { clearTokens } = useAuthStore();

  useEffect(() => {
    wagApi.client.get('/users/me').then((d) => setProfile(d)).catch(() => {});
    wagApi.client.get('/users/me/wallet').then((d) => setWallet(d as any)).catch(() => {});
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Account</Text>

        {/* Profile hero */}
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.phone}>{profile?.phone ?? ''}</Text>
          {wallet && (
            <View style={styles.walletBadge}>
              <Text style={styles.walletText}>💰 Wallet: ₹{wallet.balance}</Text>
            </View>
          )}
        </View>

        {/* Menu sections */}
        <MenuSection title="Services">
          <MenuItem emoji="📅" label="My Bookings" onPress={() => router.push('/(tabs)/bookings')} />
          <MenuItem emoji="🛒" label="My Orders" onPress={() => router.push('/store/orders' as any)} />
          <MenuItem emoji="📍" label="Saved Addresses" onPress={() => router.push('/account/addresses' as any)} />
        </MenuSection>

        <MenuSection title="Offers">
          <MenuItem emoji="🎟" label="Coupons & Offers" onPress={() => {}} />
          <MenuItem emoji="🎁" label="Referrals" onPress={() => {}} />
          <MenuItem emoji="💰" label="Wallet & Credits" onPress={() => {}} />
        </MenuSection>

        <MenuSection title="Preferences">
          <MenuItem emoji="🔔" label="Notifications" onPress={() => {}} />
          <MenuItem emoji="💳" label="Payment Methods" onPress={() => {}} />
        </MenuSection>

        <MenuSection title="Support">
          <MenuItem emoji="💬" label="Help & Support" onPress={() => {}} />
          <MenuItem emoji="📄" label="Terms of Service" onPress={() => {}} />
          <MenuItem emoji="🔒" label="Privacy Policy" onPress={() => {}} />
        </MenuSection>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Log out">
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Wag & Tails v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function MenuItem({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: spacing[12] },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing[5], paddingTop: spacing[5] },
  profileHero: { alignItems: 'center', paddingVertical: spacing[8] },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.white },
  name: { fontFamily: 'Inter', fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.textPrimary },
  phone: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  walletBadge: { marginTop: spacing[3], backgroundColor: colors.marigoldBg, borderRadius: radii.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  walletText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.marigoldDark },
  section: { marginBottom: spacing[2] },
  sectionTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: spacing[5], paddingVertical: spacing[2] },
  sectionCard: { backgroundColor: colors.white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderLight },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5], paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  menuEmoji: { fontSize: 20, width: 28 },
  menuLabel: { flex: 1, fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary },
  menuChevron: { fontSize: 22, color: colors.textMuted },
  logoutBtn: { marginHorizontal: spacing[5], marginTop: spacing[6], borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.error, paddingVertical: spacing[4], alignItems: 'center' },
  logoutText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.error },
  version: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing[5] },
});
