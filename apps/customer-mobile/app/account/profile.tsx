import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Button, DateField, Icon, Input } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

interface Form { fullName: string; email: string; dob: string }

// "Aarav Mehta" -> first "Aarav", last "Mehta"; "Aarav" -> first "Aarav", last "". Everything before the last space
// is the first name, so "Mary Ann Lee" keeps both given names.
function splitName(full: string): { firstName: string; lastName: string } {
  const t = full.trim().replace(/\s+/g, ' ');
  const i = t.lastIndexOf(' ');
  return i === -1 ? { firstName: t, lastName: '' } : { firstName: t.slice(0, i), lastName: t.slice(i + 1) };
}

/** Personal information (from the prototype): photo, name, phone (read-only), email and date of birth. */
export default function ProfileScreen() {
  const [loaded, setLoaded] = useState(false);
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ fullName: '', email: '', dob: '' });
  const [saved, setSaved] = useState<Form>({ fullName: '', email: '', dob: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const apply = (me: any) => {
    const name = [me?.profile?.firstName, me?.profile?.lastName].filter(Boolean).join(' ');
    const next: Form = { fullName: name, email: me?.email ?? '', dob: me?.profile?.dateOfBirth ? String(me.profile.dateOfBirth).slice(0, 10) : '' };
    setForm(next);
    setSaved(next);
    setPhone(me?.phone ?? '');
    setAvatar(me?.profile?.avatarUrl ?? null);
  };

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    wagApi.users.me().then((me) => { if (!cancelled) { apply(me); setLoaded(true); } }).catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []));

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const dirty = form.fullName !== saved.fullName || form.email !== saved.email || form.dob !== saved.dob;

  const validate = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    const { firstName } = splitName(form.fullName);
    if (!firstName) e.fullName = 'Please enter your name';
    else if (!/^[\p{L}][\p{L}\p{M} .'\-]*$/u.test(form.fullName.trim())) e.fullName = "Names can only contain letters, spaces and . ' -";
    else if (form.fullName.trim().length > 120) e.fullName = 'That name is too long';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'Please enter a valid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!dirty || saving || !validate()) return;
    setSaving(true);
    try {
      const { firstName, lastName } = splitName(form.fullName);
      const me = await wagApi.users.updateProfile({ firstName, lastName, email: form.email.trim(), dateOfBirth: form.dob || null });
      apply(me);
      Alert.alert('Saved', 'Your details have been updated.', [{ text: 'OK', onPress: () => goBack('/(tabs)/account') }]);
    } catch (err: any) {
      const msg = err?.message ?? 'Please try again.';
      if (/email/i.test(msg)) setErrors((e) => ({ ...e, email: msg }));
      else Alert.alert('Could not save', msg);
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = async () => {
    if (uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to choose a profile picture.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(true);
    try {
      const asset = res.assets[0];
      const url = await wagApi.users.uploadAvatar({ uri: asset.uri, name: asset.fileName ?? 'profile.jpg' });
      const me = await wagApi.users.updateProfile({ avatarUrl: url });
      setAvatar(me?.profile?.avatarUrl ?? url);
    } catch (err: any) {
      Alert.alert('Could not update your photo', err?.message ?? 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => goBack('/(tabs)/account')} accessibilityLabel="Go back">
            <Icon name="back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Personal information</Text>
        </View>

        {!loaded ? (
          <ActivityIndicator style={{ marginTop: spacing[10] }} color={colors.brandBrown} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.avatarWrap}>
              <TouchableOpacity onPress={changePhoto} activeOpacity={0.85} accessibilityLabel="Change photo">
                <View style={styles.avatar}>
                  {avatar
                    ? <Image source={{ uri: resolveMediaUrl(avatar) ?? undefined }} style={styles.avatarImg} />
                    : <Icon name="user" size={46} color="rgba(255,255,255,0.92)" />}
                  {uploading && <View style={styles.avatarBusy}><ActivityIndicator color={colors.white} /></View>}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={changePhoto} disabled={uploading}><Text style={styles.changePhoto}>{uploading ? 'Uploading…' : 'Change photo'}</Text></TouchableOpacity>
            </View>

            <Input label="Full name" value={form.fullName} onChangeText={(t) => set('fullName', t)} placeholder="Your name" maxLength={120} autoCapitalize="words" error={errors.fullName} />
            <View style={{ height: spacing[4] }} />

            <Text style={styles.label}>Phone</Text>
            <View style={styles.readonly}>
              <Text style={styles.readonlyText}>{phone}</Text>
              <View style={styles.verified}><Icon name="check" size={12} color={colors.success} /><Text style={styles.verifiedText}>Verified</Text></View>
            </View>
            <View style={{ height: spacing[4] }} />

            <Input label="Email" value={form.email} onChangeText={(t) => set('email', t)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} error={errors.email} />
            <View style={{ height: spacing[4] }} />

            <Text style={styles.label}>Date of birth</Text>
            <DateField value={form.dob} onChange={(v) => set('dob', v)} placeholder="Optional" minYear={new Date().getFullYear() - 100} />

            <Button onPress={save} loading={saving} disabled={!dirty} fullWidth style={{ marginTop: spacing[6] }}>Save changes</Button>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[2] },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  content: { padding: spacing[5], paddingBottom: spacing[10] },
  avatarWrap: { alignItems: 'center', marginBottom: spacing[6] },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.marigold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 96, height: 96 },
  avatarBusy: { ...StyleSheet.absoluteFill as any, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  changePhoto: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.marigoldDark, marginTop: spacing[3] },
  label: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing[2] },
  readonly: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.borderLight, paddingHorizontal: spacing[4], height: 50 },
  readonlyText: { fontFamily: 'Inter', fontSize: 15, color: colors.textSecondary },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  verifiedText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '800', color: colors.success },
});
