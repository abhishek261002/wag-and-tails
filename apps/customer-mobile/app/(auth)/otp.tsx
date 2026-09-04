import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { setTokens } = useAuthStore();

  useEffect(() => {
    sendOtp();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const sendOtp = async () => {
    setRequestingOtp(true);
    try {
      const res = await wagApi.auth.requestOtp({ phone: phone! });
      // In mock mode the backend returns the OTP for testing
      if ((res as any).otp) {
        setMockOtp((res as any).otp);
      }
      setResendTimer(30);
    } catch {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Paste scenario
      const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
      const next = Array(OTP_LENGTH).fill('');
      digits.split('').forEach((d, i) => { next[i] = d; });
      setOtp(next);
      inputs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) return;

    setLoading(true);
    try {
      // Try direct login first (existing user)
      try {
        const { sessionToken } = await wagApi.auth.verifyOtp({ phone: phone!, otp: code });
        // Existing customer — try to get auth response
        // For new users, redirect to register
        router.push({ pathname: '/(auth)/register', params: { phone: phone!, otp: code } });
        return;
      } catch (e: any) {
        if (e?.statusCode !== 404) throw e;
      }
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.message ?? 'Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const pinValue = otp.join('');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phone}>{phone}</Text>
          </Text>

          {mockOtp && (
            <View style={styles.devBanner}>
              <Text style={styles.devText}>🧪 Dev OTP: {mockOtp}</Text>
            </View>
          )}

          {/* OTP Input Boxes */}
          <View style={styles.otpRow}>
            {Array(OTP_LENGTH).fill(null).map((_, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputs.current[i] = ref; }}
                style={[styles.otpBox, otp[i] ? styles.otpBoxFilled : null]}
                maxLength={OTP_LENGTH}
                keyboardType="number-pad"
                value={otp[i]}
                onChangeText={(v) => handleChange(v, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                selectTextOnFocus
                accessibilityLabel={`OTP digit ${i + 1}`}
              />
            ))}
          </View>

          <Button
            onPress={handleVerify}
            fullWidth
            loading={loading}
            disabled={pinValue.length < OTP_LENGTH}
            style={styles.verifyBtn}
          >
            Verify & Continue
          </Button>

          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive the code? </Text>
            {resendTimer > 0 ? (
              <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
            ) : (
              <TouchableOpacity onPress={sendOtp} disabled={requestingOtp}>
                <Text style={styles.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, paddingHorizontal: spacing[6], paddingTop: spacing[6] },
  backBtn: { marginBottom: spacing[8] },
  backText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize['3xl'], fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[2] },
  subtitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, marginBottom: spacing[8], lineHeight: 24 },
  phone: { fontWeight: '700', color: colors.textPrimary },
  devBanner: { backgroundColor: colors.infoLight, borderRadius: radii.md, padding: spacing[3], marginBottom: spacing[5] },
  devText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.info, fontWeight: '600' },
  otpRow: { flexDirection: 'row', gap: spacing[2], justifyContent: 'center', marginBottom: spacing[8] },
  otpBox: {
    width: 48, height: 56, borderRadius: radii.md, borderWidth: 2,
    borderColor: colors.borderLight, textAlign: 'center',
    fontSize: typography.fontSize.xl, fontWeight: '700',
    color: colors.textPrimary, backgroundColor: colors.white,
  },
  otpBoxFilled: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  verifyBtn: { marginBottom: spacing[5] },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted },
  timerText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, fontWeight: '600' },
  resendLink: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.marigoldDark, fontWeight: '700' },
});
