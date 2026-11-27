import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, TextInput, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

type Side = 'front' | 'back';
const groups = (v: string) => v.replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');

/**
 * Aadhaar number and photos of the card. Kept encrypted on our server for verification only; the team that approves
 * partners can look at them (every look is recorded). Asked of new partners before approval and of existing partners
 * once. The app never gets the number back: it only learns whether it is saved.
 */
export default function AadhaarScreen() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const [status, setStatus] = useState<{ done: boolean; front: boolean; back: boolean; numberSaved: boolean; last4: string | null } | null>(null);
  const [number, setNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<'front' | 'back' | 'save' | null>(null);
  const [local, setLocal] = useState<{ front?: string; back?: string }>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setStatus(await wagApi.partner.aadhaarStatus()); } catch { setError('Could not load. Check your connection and try again.'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pick = async (side: Side, camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', camera ? 'Allow the camera to take a photo of your card.' : 'Allow access to your photos.'); return; }
    const res = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setBusy(side); setError('');
    try {
      const st = await wagApi.partner.uploadAadhaarPhoto(side, { uri: a.uri, name: a.fileName ?? `${side}.jpg` });
      setLocal((l) => ({ ...l, [side]: a.uri }));
      setStatus((s) => ({ ...(s ?? { done: false, numberSaved: false, last4: null, front: false, back: false }), front: st.front, back: st.back, done: st.done }));
    } catch (err: any) {
      setError(err?.message ?? 'Could not upload the photo. Please try again.');
    } finally { setBusy(null); }
  };

  const choose = (side: Side) => Alert.alert(`Aadhaar ${side}`, 'Add a clear photo of the whole card.', [
    { text: 'Take a photo', onPress: () => pick(side, true) },
    { text: 'Choose from gallery', onPress: () => pick(side, false) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const save = async () => {
    setError('');
    if (!status?.front || !status?.back) { setError('Add photos of both the front and the back first.'); return; }
    if (number.replace(/\D/g, '').length !== 12) { setError('Enter the 12-digit number from your card.'); return; }
    if (!consent) { setError('Please tick the box to agree.'); return; }
    setBusy('save');
    try {
      await wagApi.partner.saveAadhaarNumber(number, true);
      Alert.alert('Saved', 'Thank you. Your Aadhaar details are saved.', [{ text: 'OK', onPress: () => (onboarding === '1' ? router.back() : goBack()) }]);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save. Please try again.');
    } finally { setBusy(null); }
  };

  const PhotoBox = ({ side }: { side: Side }) => {
    const has = status?.[side];
    return (
      <TouchableOpacity style={[styles.photo, has && styles.photoDone]} onPress={() => choose(side)} disabled={busy !== null} accessibilityRole="button" accessibilityLabel={`Add Aadhaar ${side} photo`}>
        {busy === side ? <ActivityIndicator color={colors.brandBrown} /> : local[side] ? <Image source={{ uri: local[side] }} style={styles.thumb} /> : <Icon name={has ? 'check' : 'cam'} size={28} color={has ? colors.success : colors.textMuted} />}
        <Text style={styles.photoText}>{has ? `${side === 'front' ? 'Front' : 'Back'} added. Tap to replace` : `Add ${side} of the card`}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Aadhaar details</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!status && !error ? <ActivityIndicator color={colors.brandBrown} /> : null}
        {status?.done ? (
          <View style={[styles.card, { borderColor: colors.success }]}>
            <Text style={styles.cardTitle}>All saved</Text>
            <Text style={styles.cardText}>Your Aadhaar number{status.last4 ? ` ending ${status.last4}` : ''} and both photos are on file. You can replace the photos below if they were not clear.</Text>
          </View>
        ) : (
          <Text style={styles.intro}>We need your Aadhaar number and photos of the card to verify you before you start taking jobs.</Text>
        )}

        <Text style={styles.label}>Photos of your Aadhaar card</Text>
        <View style={styles.photos}><PhotoBox side="front" /><PhotoBox side="back" /></View>

        {!status?.done ? (
          <>
            <Text style={styles.label}>Aadhaar number</Text>
            <TextInput
              style={styles.input}
              value={number}
              onChangeText={(v) => setNumber(groups(v))}
              placeholder="XXXX XXXX XXXX"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={14}
              accessibilityLabel="Aadhaar number"
              autoComplete="off"
            />
            {status?.last4 ? <Text style={styles.hint}>It must end in {status.last4}, the digits you verified with DigiLocker.</Text> : null}
            <TouchableOpacity style={styles.consent} onPress={() => setConsent((c) => !c)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
              <View style={[styles.box, consent && styles.boxOn]}>{consent ? <Icon name="check" size={14} color={colors.white} /> : null}</View>
              <Text style={styles.consentText}>I agree that Wag & Tails keeps my Aadhaar number and card photos, encrypted, only to verify who I am. Only the verification team can see them, and they are deleted if my application is rejected.</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        {!status?.done ? <Button onPress={save} fullWidth loading={busy === 'save'} disabled={busy !== null}>Save Aadhaar details</Button> : null}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  content: { padding: spacing[5], gap: spacing[3] },
  intro: { fontFamily: 'Inter', fontSize: 14, color: colors.textSecondary ?? colors.textMuted, lineHeight: 20 },
  label: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing[3] },
  photos: { flexDirection: 'row', gap: spacing[3] },
  photo: { flex: 1, minHeight: 130, borderRadius: radii.xl, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderLight, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: spacing[3], gap: spacing[2] },
  photoDone: { borderStyle: 'solid', borderColor: colors.success },
  thumb: { width: '100%', height: 80, borderRadius: radii.lg, resizeMode: 'cover' },
  photoText: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  input: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontFamily: 'Inter', fontSize: 18, letterSpacing: 1.5, color: colors.textPrimary },
  hint: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted },
  consent: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start', marginVertical: spacing[3] },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.brandBrown },
  consentText: { flex: 1, fontFamily: 'Inter', fontSize: 12.5, color: colors.textPrimary, lineHeight: 18 },
  error: { fontFamily: 'Inter', fontSize: 13, color: '#B42318' },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1.5, padding: spacing[4], gap: spacing[1] },
  cardTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardText: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
