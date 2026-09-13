import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

// Operations run in exactly these three cities — see account/service-city.tsx.
const CITY_OPTIONS = ['Kanpur', 'Lucknow', 'Delhi'];

export default function PartnerSignupScreen() {
  const { setTokens } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add your photo.');
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

  const handleSignup = async () => {
    const ageNum = parseInt(age, 10);
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      Alert.alert('Missing fields', 'Please fill in your name, email, password and phone number.');
      return;
    }
    if (!age.trim() || Number.isNaN(ageNum) || ageNum < 18) {
      Alert.alert('Invalid age', 'You must be at least 18 years old to sign up as a partner.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Missing address', 'Please enter your address.');
      return;
    }
    if (!aadhaarNumber.trim()) {
      Alert.alert('Missing Aadhaar number', 'Please enter your Aadhaar number.');
      return;
    }
    if (!city) {
      Alert.alert('Select a city', 'Please choose the city you want to operate in.');
      return;
    }

    setLoading(true);
    try {
      const res = await wagApi.auth.registerPartner({
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        age: ageNum,
        address: address.trim(),
        aadhaarNumber: aadhaarNumber.trim(),
        city,
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
      Alert.alert('Sign up failed', err?.message ?? 'Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
              <Text style={styles.back}>← Back</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Become a partner</Text>
          <Text style={styles.subtitle}>Tell us about yourself. Our team reviews every application before you can start taking jobs.</Text>

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
          <View style={{ height: spacing[4] }} />

          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Email address" />
          <View style={{ height: spacing[4] }} />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry accessibilityLabel="Password" />
          <View style={{ height: spacing[4] }} />
          <Input label="Phone number" value={phone} onChangeText={setPhone} placeholder="+919900001111" keyboardType="phone-pad" accessibilityLabel="Phone number" />
          <View style={{ height: spacing[4] }} />
          <Input label="Age" value={age} onChangeText={setAge} placeholder="28" keyboardType="number-pad" maxLength={2} accessibilityLabel="Age" />
          <View style={{ height: spacing[4] }} />
          <Input label="Address" value={address} onChangeText={setAddress} placeholder="Your home address" multiline accessibilityLabel="Address" />
          <View style={{ height: spacing[4] }} />
          <Input label="Aadhaar number" value={aadhaarNumber} onChangeText={setAadhaarNumber} placeholder="XXXX XXXX XXXX" keyboardType="number-pad" maxLength={12} accessibilityLabel="Aadhaar number" />
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

          <Button onPress={handleSignup} fullWidth loading={loading} style={{ marginTop: spacing[7] }}>
            Submit application
          </Button>

          <Text style={styles.hint}>
            Already have an account?{' '}
            <Text style={styles.link} onPress={() => router.replace('/(auth)/login')}>Log in</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { paddingHorizontal: spacing[6], paddingBottom: spacing[10] },
  topBar: { paddingTop: spacing[4], paddingBottom: spacing[2] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[1] },
  subtitle: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginBottom: spacing[6], lineHeight: 20 },
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
  hint: { textAlign: 'center', fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: spacing[5] },
  link: { color: colors.marigoldDark, fontWeight: '700' },
});
