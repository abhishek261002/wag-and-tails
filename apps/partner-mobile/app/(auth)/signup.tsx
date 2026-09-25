import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';
import { goBack as safeBack } from '../../src/lib/nav';

// Operations run in exactly these three cities — see account/service-city.tsx.
const CITY_OPTIONS = ['Kanpur', 'Lucknow', 'Delhi'];

type Role = 'groomer' | 'walker' | 'both';
const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: 'groomer', label: 'Groomer', hint: 'Bath, haircut and care at the customer\'s home' },
  { value: 'walker', label: 'Walker', hint: 'Dog walks near the customer' },
  { value: 'both', label: 'Both', hint: 'Take grooming and walking jobs' },
];
const rolesToModes = (r: Role): ('grooming' | 'walking')[] =>
  r === 'both' ? ['grooming', 'walking'] : r === 'groomer' ? ['grooming'] : ['walking'];

const STEP_LABELS = ['Your details', 'Verify with DigiLocker'];

export default function PartnerSignupScreen() {
  const { setTokens } = useAuthStore();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [groomsCats, setGroomsCats] = useState(true);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [consent, setConsent] = useState(false);
  const [kyc, setKyc] = useState<{ token: string; name: string | null; last4: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const includesGrooming = role === 'groomer' || role === 'both';

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add your picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  };

  const errMsg = (err: any, fallback: string) =>
    err?.response?.data?.message ?? err?.message ?? fallback;

  const validateDetails = (): string | null => {
    const ageNum = parseInt(age, 10);
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !phone.trim()) {
      return 'Please fill in your name, email, password and phone number.';
    }
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/^\+?\d{10,15}$/.test(phone.trim())) return 'Enter a valid phone number.';
    if (!age.trim() || Number.isNaN(ageNum) || ageNum < 18) return 'You must be at least 18 years old to sign up as a partner.';
    if (!address.trim()) return 'Please enter your address.';
    if (!city) return 'Please choose the city you want to operate in.';
    if (!role) return 'Choose what you want to do: groomer, walker or both.';
    return null;
  };

  const goToVerify = () => {
    const problem = validateDetails();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setStep(1);
  };

  // Reads the verification result from the server. The deep link is only a hint; this is the truth, so it
  // also recovers cleanly when the browser was dismissed or the app was restarted mid-flow.
  const checkStatus = async (id: string): Promise<boolean> => {
    try {
      const st = await wagApi.auth.getDigilockerStatus(id);
      if (st.status === 'verified') {
        setKyc({ token: st.kycToken, name: st.name, last4: st.aadhaarLast4 });
        setError('');
        return true;
      }
      if (st.status === 'pending') {
        setError('Verification is not finished yet. Complete it in DigiLocker, then tap "Verify with DigiLocker" again.');
      } else {
        setError(st.message);
      }
    } catch (err: any) {
      setError(errMsg(err, 'Could not check the verification. Please try again.'));
    }
    return false;
  };

  const startDigilocker = async () => {
    if (!consent) {
      setError('Please agree to the Aadhaar verification consent to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const returnUrl = Linking.createURL('kyc');
      const res = await wagApi.auth.startDigilocker({
        consent: true,
        appRedirect: returnUrl,
        name: `${firstName.trim()} ${lastName.trim()}`,
        age: parseInt(age, 10),
      });
      await WebBrowser.openAuthSessionAsync(res.authorizeUrl, returnUrl);
      await checkStatus(res.requestId);
    } catch (err: any) {
      setError(errMsg(err, 'Could not open DigiLocker. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const submitApplication = async () => {
    if (!kyc) return;
    setError('');
    setLoading(true);
    try {
      const res = await wagApi.auth.registerPartner({
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        age: parseInt(age, 10),
        address: address.trim(),
        city: city!,
        modes: rolesToModes(role!),
        groomsCats: includesGrooming ? groomsCats : undefined,
        kycToken: kyc.token,
      });
      await setTokens(res.tokens.accessToken, res.tokens.refreshToken, res.user.id);

      if (photo) {
        try {
          await wagApi.partner.uploadProfilePhoto(res.user.id, {
            uri: photo.uri,
            name: photo.fileName ?? 'photo.jpg',
            type: photo.mimeType ?? 'image/jpeg',
          });
        } catch {
          // Photo upload failing shouldn't block the application from going through.
        }
      }

      router.replace('/(auth)/pending-approval');
    } catch (err: any) {
      const msg = errMsg(err, 'Could not submit your application. Please try again.');
      // The verification is single-use; if it is no longer valid the partner must verify again.
      if (/verif/i.test(msg)) setKyc(null);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setError('');
    if (step === 0) safeBack('/(auth)/login');
    else setStep(step - 1);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <TouchableOpacity onPress={goBack} accessibilityLabel="Go back" style={styles.backRow}>
              <Icon name="back" size={18} color={colors.brandBrown} />
              <Text style={styles.back}>Back</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Become a partner</Text>
          <Text style={styles.subtitle}>
            Step {step + 1} of 2 · {STEP_LABELS[step]}
          </Text>
          <View style={styles.progressRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.progressSeg, i <= step && styles.progressSegActive]} />
            ))}
          </View>

          {step === 0 && (
            <>
              <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto} accessibilityLabel="Add your photo">
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                ) : (
                  <>
                    <Icon name="cam" size={32} color={colors.textMuted} />
                    <Text style={styles.photoLabel}>Add photo</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Input label="First name" value={firstName} onChangeText={setFirstName} placeholder="Ritika" accessibilityLabel="First name" />
                </View>
                <View style={{ width: spacing[3] }} />
                <View style={{ flex: 1 }}>
                  <Input label="Last name" value={lastName} onChangeText={setLastName} placeholder="Sharma" accessibilityLabel="Last name" />
                </View>
              </View>
              <Text style={styles.hint}>Use your name exactly as it appears on your Aadhaar.</Text>
              <View style={{ height: spacing[4] }} />

              <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Email address" />
              <View style={{ height: spacing[4] }} />
              <Input label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry accessibilityLabel="Password" />
              <View style={{ height: spacing[4] }} />
              <Input label="Phone number" value={phone} onChangeText={setPhone} placeholder="+919900001111" keyboardType="phone-pad" accessibilityLabel="Phone number" />
              <View style={{ height: spacing[4] }} />
              <Input label="Age" value={age} onChangeText={setAge} placeholder="28" keyboardType="number-pad" maxLength={2} accessibilityLabel="Age" />
              <View style={{ height: spacing[4] }} />
              <Input label="Address" value={address} onChangeText={setAddress} placeholder="Your home address" multiline accessibilityLabel="Address" />
              <View style={{ height: spacing[5] }} />

              <Text style={styles.fieldLabel}>City you want to operate in</Text>
              <View style={styles.cityOptions}>
                {CITY_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.cityOption, city === c && styles.cityOptionActive]}
                    onPress={() => setCity(c)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: city === c }}
                  >
                    <Text style={[styles.cityOptionLabel, city === c && styles.cityOptionLabelActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing[2] }]}>What would you like to do?</Text>
              {ROLE_OPTIONS.map((r) => {
                const active = role === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.roleRow, active && styles.roleRowActive]}
                    onPress={() => setRole(r.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleLabel}>{r.label}</Text>
                      <Text style={styles.roleHint}>{r.hint}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {includesGrooming && (
                <TouchableOpacity style={styles.checkRow} onPress={() => setGroomsCats(!groomsCats)} accessibilityRole="checkbox" accessibilityState={{ checked: groomsCats }}>
                  <View style={[styles.checkBox, groomsCats && styles.checkBoxActive]}>
                    {groomsCats && <Icon name="check" size={14} color={colors.white} />}
                  </View>
                  <Text style={styles.checkLabel}>I also groom cats</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <View style={styles.infoCard}>
                <Icon name="shield" size={20} color={colors.brandBrown} />
                <Text style={styles.infoText}>
                  You will be taken to DigiLocker, the Government of India service, to verify your Aadhaar. When you are done you come straight back here. We never see or store your full Aadhaar number.
                </Text>
              </View>

              {kyc ? (
                <View style={[styles.infoCard, { marginTop: spacing[4] }]}>
                  <Icon name="check" size={20} color={colors.brandBrown} />
                  <Text style={styles.infoText}>
                    Aadhaar verified{kyc.name ? ` as ${kyc.name}` : ''}{kyc.last4 ? ` (XXXX XXXX ${kyc.last4})` : ''}.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.checkRow} onPress={() => { setConsent(!consent); setError(''); }} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
                  <View style={[styles.checkBox, consent && styles.checkBoxActive]}>
                    {consent && <Icon name="check" size={14} color={colors.white} />}
                  </View>
                  <Text style={[styles.checkLabel, { flex: 1 }]}>
                    I consent to Wag & Tails verifying my identity through DigiLocker and retaining my name, date of birth and last 4 Aadhaar digits for KYC.
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 0 && (
            <Button onPress={goToVerify} fullWidth style={{ marginTop: spacing[6] }}>Continue</Button>
          )}
          {step === 1 && !kyc && (
            <Button onPress={startDigilocker} fullWidth loading={loading} disabled={!consent} style={{ marginTop: spacing[6] }}>
              Verify with DigiLocker
            </Button>
          )}
          {step === 1 && kyc && (
            <Button onPress={submitApplication} fullWidth loading={loading} style={{ marginTop: spacing[6] }}>
              Submit application
            </Button>
          )}

          {step === 0 && (
            <Text style={styles.footerHint}>
              Already have an account?{' '}
              <Text style={styles.link} onPress={() => router.replace('/(auth)/login')}>Log in</Text>
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { paddingHorizontal: spacing[6], paddingBottom: spacing[10] },
  topBar: { paddingTop: spacing[4], paddingBottom: spacing[2] },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[1] },
  subtitle: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginBottom: spacing[3], lineHeight: 20 },
  progressRow: { flexDirection: 'row', gap: 4, marginBottom: spacing[6] },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderLight },
  progressSegActive: { backgroundColor: colors.brandBrown },
  photoPicker: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.borderLight, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[6], overflow: 'hidden' },
  photoPreview: { width: 96, height: 96, borderRadius: 48 },
  photoLabel: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, marginTop: 4 },
  row: { flexDirection: 'row' },
  fieldLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[3] },
  cityOptions: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  cityOption: { flex: 1, paddingVertical: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, alignItems: 'center' },
  cityOptionActive: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  cityOptionLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  cityOptionLabelActive: { color: colors.marigoldDark },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, marginBottom: spacing[2] },
  roleRowActive: { borderColor: colors.brandBrown, backgroundColor: colors.biscuitLighter },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.brandBrown },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandBrown },
  roleLabel: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  roleHint: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], marginTop: spacing[4] },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderLight, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkBoxActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  checkLabel: { fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  infoCard: { flexDirection: 'row', gap: spacing[3], padding: spacing[4], borderRadius: radii.lg, backgroundColor: colors.biscuitLighter, marginBottom: spacing[5], alignItems: 'flex-start' },
  infoText: { flex: 1, fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  hint: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: spacing[2] },
  error: { fontFamily: 'Inter', fontSize: 13, color: colors.error, marginTop: spacing[4], lineHeight: 18 },
  footerHint: { textAlign: 'center', fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: spacing[5] },
  link: { color: colors.marigoldDark, fontWeight: '700', fontFamily: 'Inter', fontSize: 14 },
});
