import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

export default function RegisterScreen() {
  const { phone, otp } = useLocalSearchParams<{ phone: string; otp: string }>();
  const { setTokens } = useAuthStore();

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', dateOfBirth: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.firstName.trim().length < 2) errs['firstName'] = 'First name is too short';
    if (!form.lastName.trim()) errs['lastName'] = 'Last name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs['email'] = 'Invalid email address';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) errs['dateOfBirth'] = 'Enter date as YYYY-MM-DD';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await wagApi.auth.register({
        phone: phone!,
        otp: otp!,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
      });
      await setTokens(
        res.tokens.accessToken,
        res.tokens.refreshToken,
        res.user.id,
        res.user.role
      );
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Tell us a bit about yourself</Text>
          </View>

          <View style={styles.card}>
            <Input
              label="First name"
              value={form.firstName}
              onChangeText={(v) => update('firstName', v)}
              error={errors['firstName']}
              placeholder="Arjun"
              autoCapitalize="words"
              accessibilityLabel="First name"
            />

            <View style={styles.gap} />

            <Input
              label="Last name"
              value={form.lastName}
              onChangeText={(v) => update('lastName', v)}
              error={errors['lastName']}
              placeholder="Mehta"
              autoCapitalize="words"
              accessibilityLabel="Last name"
            />

            <View style={styles.gap} />

            <Input
              label="Email address"
              value={form.email}
              onChangeText={(v) => update('email', v)}
              error={errors['email']}
              placeholder="arjun@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="Email address"
            />

            <View style={styles.gap} />

            <Input
              label="Date of birth"
              value={form.dateOfBirth}
              onChangeText={(v) => update('dateOfBirth', v)}
              error={errors['dateOfBirth']}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
              accessibilityLabel="Date of birth"
              hint="Format: YYYY-MM-DD"
            />

            <View style={styles.gap} />

            <View style={styles.phoneRow}>
              <Text style={styles.phoneLabel}>Phone</Text>
              <Text style={styles.phoneValue}>{phone}</Text>
            </View>

            <Button
              onPress={handleRegister}
              fullWidth
              loading={loading}
              style={styles.ctaButton}
            >
              Create Account
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { paddingHorizontal: spacing[6], paddingTop: spacing[8], paddingBottom: spacing[10] },
  header: { marginBottom: spacing[6] },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, marginTop: spacing[1] },
  card: {
    backgroundColor: colors.white, borderRadius: radii['2xl'],
    padding: spacing[6], borderWidth: 1, borderColor: colors.borderLight,
  },
  gap: { height: spacing[4] },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt, borderRadius: radii.md,
    padding: spacing[3], marginBottom: spacing[5],
  },
  phoneLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted },
  phoneValue: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.textPrimary },
  ctaButton: { marginTop: spacing[2] },
});
