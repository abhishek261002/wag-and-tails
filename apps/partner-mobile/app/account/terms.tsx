import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@wag/design-tokens';

export default function PartnerTermsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Partner Terms</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: 1 January 2026</Text>
        <Text style={styles.heading}>1. Partner Agreement</Text>
        <Text style={styles.body}>By registering as a Wag & Tails partner, you agree to provide professional pet care services in accordance with our quality standards.</Text>
        <Text style={styles.heading}>2. Commission Structure</Text>
        <Text style={styles.body}>Wag & Tails retains 20% of each booking value as a platform fee. The remaining 80% is your earnings and will be paid out per your payout schedule.</Text>
        <Text style={styles.heading}>3. Service Standards</Text>
        <Text style={styles.body}>Partners must always review pet care notes before each job, maintain punctuality, and notify customers of any issues immediately.</Text>
        <Text style={styles.heading}>4. Insurance & Liability</Text>
        <Text style={styles.body}>Wag & Tails provides basic job insurance. Partners are responsible for any damage caused through negligence or failure to follow care notes.</Text>
        <Text style={styles.heading}>5. Termination</Text>
        <Text style={styles.body}>Accounts with consistent negative reviews, policy violations, or verified complaints may be suspended or permanently removed from the platform.</Text>
        <Text style={styles.heading}>6. Contact</Text>
        <Text style={styles.body}>Partner queries: partners@wagandtails.in</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
  updated: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginBottom: spacing[4] },
  heading: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: spacing[4], marginBottom: spacing[2] },
  body: { fontFamily: 'Inter', fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});
