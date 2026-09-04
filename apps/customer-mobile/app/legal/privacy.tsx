import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@wag/design-tokens';

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: 1 January 2026</Text>
        <Text style={styles.heading}>1. Data We Collect</Text>
        <Text style={styles.body}>We collect your name, phone number, email, pet information, location (for walk tracking), and payment details to provide our services.</Text>
        <Text style={styles.heading}>2. How We Use Your Data</Text>
        <Text style={styles.body}>We use your data to book and manage services, match you with partners, process payments, and improve our platform. We do not sell your data to third parties.</Text>
        <Text style={styles.heading}>3. Pet Care Notes</Text>
        <Text style={styles.body}>Pet care notes you add are shared with assigned groomers, walkers, and support staff to ensure the best care for your pet.</Text>
        <Text style={styles.heading}>4. Location Data</Text>
        <Text style={styles.body}>Location is used only during active walk sessions for live tracking. Background location access is not used by the customer app.</Text>
        <Text style={styles.heading}>5. Data Retention</Text>
        <Text style={styles.body}>We retain your account data for as long as your account is active. You may request deletion by contacting support.</Text>
        <Text style={styles.heading}>6. Security</Text>
        <Text style={styles.body}>All data is transmitted over HTTPS and stored securely. Payment data is handled by our payment processor and never stored on Wag & Tails servers.</Text>
        <Text style={styles.heading}>7. Contact</Text>
        <Text style={styles.body}>Privacy questions: privacy@wagandtails.in</Text>
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
