import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: 1 January 2026</Text>
        <Text style={styles.heading}>1. Acceptance of Terms</Text>
        <Text style={styles.body}>By using Wag & Tails, you agree to these Terms of Service. If you do not agree, please discontinue use immediately.</Text>
        <Text style={styles.heading}>2. Services</Text>
        <Text style={styles.body}>Wag & Tails provides pet grooming, dog walking, and pet supplies delivery services. Services are subject to availability and partner acceptance.</Text>
        <Text style={styles.heading}>3. Bookings & Cancellations</Text>
        <Text style={styles.body}>Free cancellations are available up to 4 hours before a scheduled appointment. Late cancellations may incur a fee. Wag & Tails reserves the right to cancel bookings due to partner unavailability, with a full refund.</Text>
        <Text style={styles.heading}>4. Payments</Text>
        <Text style={styles.body}>All payments are processed securely. Refunds for cancelled services are returned to the original payment method within 5–7 business days.</Text>
        <Text style={styles.heading}>5. Partner Conduct</Text>
        <Text style={styles.body}>All Wag & Tails partners are background-verified. However, you are encouraged to review partner profiles and ratings before booking.</Text>
        <Text style={styles.heading}>6. Liability</Text>
        <Text style={styles.body}>Wag & Tails is not liable for any injury, loss, or damage to your pet beyond the direct cost of the booked service. We strongly recommend keeping pet health records up to date.</Text>
        <Text style={styles.heading}>7. Contact</Text>
        <Text style={styles.body}>For questions, contact support@wagandtails.in</Text>
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
