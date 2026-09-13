import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';
import { Icon, RowItem } from '@wag/ui-mobile';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

export default function PartnerAccountScreen() {
  const [profile, setProfile] = useState<any>(null);
  const { clearTokens } = useAuthStore();

  useEffect(() => {
    wagApi.partner.getProfile().then(setProfile).catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await clearTokens(); router.replace('/(auth)/login'); } },
    ]);
  };

  const name = profile?.user?.profile
    ? `${profile.user.profile.firstName} ${profile.user.profile.lastName}`
    : 'Partner';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Account</Text>

        <View style={styles.hero}>
          <View style={styles.avatar}><Text style={{ fontSize: 32, color: colors.white }}>{name.charAt(0)}</Text></View>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.heroStatRow}>
            <Icon name="star" size={13} color={colors.marigoldDark} variant="fill" />
            <Text style={styles.rating}>{profile?.rating ?? '5.0'} · {profile?.reviewCount ?? 0} reviews</Text>
          </View>
          <View style={styles.heroStatRow}>
            <Icon name="check" size={13} color={colors.success} />
            <Text style={styles.jobs}>{profile?.completedJobs ?? 0} jobs completed</Text>
          </View>
        </View>

        <MenuSection title="Service Settings">
          <RowItem icon="pin" title="Service City" onPress={() => router.push('/account/service-city' as any)} />
          <RowItem icon="cal" title="Working Hours" onPress={() => router.push('/account/working-hours' as any)} />
        </MenuSection>

        <MenuSection title="Account">
          <RowItem icon="doc" title="Documents & Verification" onPress={() => router.push('/account/documents' as any)} />
          <RowItem icon="wallet" title="Bank Account" onPress={() => {}} />
          <RowItem icon="star" title="Reviews" onPress={() => router.push('/account/reviews' as any)} />
        </MenuSection>

        <MenuSection title="Support">
          <RowItem icon="help" title="Help & Support" onPress={() => router.push('/account/support' as any)} />
          <RowItem icon="doc" title="Terms of Service" onPress={() => router.push('/account/terms' as any)} />
        </MenuSection>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Icon name="logout" size={16} color={colors.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Wag & Tails Partner v1.0.0</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: spacing[12] },
  title: { fontFamily: 'Inter', fontSize: 26, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing[5], paddingTop: spacing[5] },
  hero: { alignItems: 'center', paddingVertical: spacing[6] },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] },
  name: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  heroStatRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  rating: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted },
  jobs: { fontFamily: 'Inter', fontSize: 13, color: colors.success, fontWeight: '600' },
  section: { marginBottom: spacing[2] },
  sectionTitle: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: spacing[5], paddingVertical: spacing[2] },
  sectionCard: { backgroundColor: colors.white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderLight },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], marginHorizontal: spacing[5], marginTop: spacing[5], borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.error, paddingVertical: spacing[4] },
  logoutText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.error },
  version: { textAlign: 'center', fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: spacing[4] },
});
