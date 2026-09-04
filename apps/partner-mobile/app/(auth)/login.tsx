import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

export default function PartnerLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setTokens } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await wagApi.auth.login({ email: email.trim().toLowerCase(), password });
      if (res.user.role !== 'partner') {
        Alert.alert('Access denied', 'This app is for Wag & Tails partners only.');
        return;
      }
      await setTokens(res.tokens.accessToken, res.tokens.refreshToken, res.user.id);
      router.replace('/(tabs)/jobs');
    } catch (err: any) {
      Alert.alert('Login failed', err?.message ?? 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Text style={{ fontSize: 36 }}>🐾</Text>
            </View>
            <Text style={styles.brandName}>Wag & Tails</Text>
            <Text style={styles.brandSub}>Partner App</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Partner login</Text>
            <Text style={styles.subtitle}>Sign in with your partner account</Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="ritika@wagpartner.in"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              accessibilityLabel="Email address"
            />
            <View style={{ height: spacing[4] }} />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              accessibilityLabel="Password"
            />

            <Button onPress={handleLogin} fullWidth loading={loading} style={{ marginTop: spacing[6] }}>
              Sign In
            </Button>
          </View>

          <Text style={styles.hint}>
            Not a partner yet?{' '}
            <Text style={styles.link}>Apply at wagandtails.in</Text>
          </Text>

          {/* Dev hint */}
          <View style={styles.devBox}>
            <Text style={styles.devTitle}>🧪 Test accounts</Text>
            <Text style={styles.devText}>ritika.sharma@wagpartner.in / Partner@123 (grooming)</Text>
            <Text style={styles.devText}>karan.joshi@wagpartner.in / Partner@123 (walking)</Text>
            <Text style={styles.devText}>aman.verma@wagpartner.in / Partner@123 (both)</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { paddingHorizontal: spacing[6], paddingTop: spacing[10], paddingBottom: spacing[10] },
  brand: { alignItems: 'center', marginBottom: spacing[10] },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  brandName: { fontFamily: 'Inter', fontSize: 28, fontWeight: '800', color: colors.brandBrown },
  brandSub: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginTop: 2, letterSpacing: 1 },
  card: { backgroundColor: colors.white, borderRadius: radii['2xl'], padding: spacing[6], borderWidth: 1, borderColor: colors.borderLight },
  title: { fontFamily: 'Inter', fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[1] },
  subtitle: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginBottom: spacing[5] },
  hint: { textAlign: 'center', fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: spacing[5] },
  link: { color: colors.marigoldDark, fontWeight: '700' },
  devBox: { marginTop: spacing[6], backgroundColor: colors.infoLight, borderRadius: radii.lg, padding: spacing[4] },
  devTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.info, marginBottom: 6 },
  devText: { fontFamily: 'Inter', fontSize: 12, color: colors.info, marginBottom: 2 },
});
