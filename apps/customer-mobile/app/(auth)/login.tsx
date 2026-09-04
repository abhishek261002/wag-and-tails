import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { Input } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleContinue = () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setError('');
    const formatted = cleaned.startsWith('91') ? `+${cleaned}` : `+91${cleaned}`;
    router.push({ pathname: '/(auth)/otp', params: { phone: formatted } });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Brand */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <Text style={styles.brandName}>Wag & Tails</Text>
            <Text style={styles.brandTagline}>Grooming · Walking · Products</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Enter your phone number to continue</Text>

            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChangeText={(t) => { setPhone(t); setError(''); }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  error={error || undefined}
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                  accessibilityLabel="Phone number"
                />
              </View>
            </View>

            <Button
              onPress={handleContinue}
              fullWidth
              style={styles.ctaButton}
              accessibilityLabel="Continue to OTP verification"
            >
              Continue
            </Button>
          </View>

          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, paddingHorizontal: spacing[6], paddingTop: spacing[12] },
  brand: { alignItems: 'center', marginBottom: spacing[10] },
  logoCircle: {
    width: 80, height: 80, borderRadius: radii.full,
    backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
  },
  logoEmoji: { fontSize: 36 },
  brandName: {
    fontFamily: 'Inter', fontSize: typography.fontSize['3xl'],
    fontWeight: '800', color: colors.brandBrown,
  },
  brandTagline: {
    fontFamily: 'Inter', fontSize: typography.fontSize.sm,
    color: colors.textMuted, marginTop: spacing[1],
    letterSpacing: typography.letterSpacing.wide,
  },
  card: {
    backgroundColor: colors.white, borderRadius: radii['2xl'],
    padding: spacing[6], borderWidth: 1, borderColor: colors.borderLight,
    shadowColor: colors.brandBrown, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  title: {
    fontFamily: 'Inter', fontSize: typography.fontSize['2xl'],
    fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[1],
  },
  subtitle: {
    fontFamily: 'Inter', fontSize: typography.fontSize.base,
    color: colors.textMuted, marginBottom: spacing[5],
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[5] },
  countryCode: {
    height: 52, paddingHorizontal: spacing[3], borderRadius: radii.md,
    borderWidth: 1.5, borderColor: colors.borderLight,
    backgroundColor: colors.surfaceAlt, justifyContent: 'center',
  },
  countryCodeText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary },
  ctaButton: { marginTop: spacing[1] },
  terms: {
    textAlign: 'center', fontFamily: 'Inter', fontSize: typography.fontSize.xs,
    color: colors.textMuted, marginTop: spacing[6],
  },
  link: { color: colors.marigoldDark, fontWeight: '600' },
});
