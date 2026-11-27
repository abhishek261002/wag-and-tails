import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, KeyboardAvoidingView } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radii } from '@wag/design-tokens';
import { Button } from '@wag/ui-mobile';
import type { Complaint } from '@wag/api-client';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';
import { errorMessage } from '../../src/lib/website';

type Data = Awaited<ReturnType<typeof wagApi.website.complaints>>;

// Complaints go to the website's Complaints list (the desk resolves them, as for website complaints). A complaint
// about a grooming can be raised within 24 hours of it; the desk may book a free redo. Opened with ?ref=WT-… from a
// booking to preselect it.
export default function ComplaintsScreen() {
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(!!ref);
  const [booking, setBooking] = useState<string>(ref ?? '');
  const [category, setCategory] = useState<string>('');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<{ local: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await wagApi.website.complaints());
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'Could not load complaints'));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (data?.bookings ?? []).filter((b) => b.left > 0 && !b.complaintRef);

  const addPhoto = async () => {
    if (photos.length >= 3) return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'] as any });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const url = await wagApi.website.uploadComplaintPhoto({ uri: a.uri, name: a.fileName ?? `complaint-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' });
      setPhotos((p) => [...p, { local: a.uri, url }]);
    } catch (e) {
      Alert.alert('Upload failed', errorMessage(e, 'Please try another photo.'));
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    if (!category || text.trim().length < 10) return;
    setSending(true);
    try {
      const r = await wagApi.website.complain({ booking: booking || undefined, category, text: text.trim(), photos: photos.map((p) => p.url) });
      Alert.alert('Complaint registered', `Your complaint ${r.complaint.id} is with our team. We will call you within 24 hours.`);
      setWriting(false);
      setBooking(''); setCategory(''); setText(''); setPhotos([]);
      await load();
    } catch (e) {
      Alert.alert('Could not send', errorMessage(e, 'Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Complaints</Text>
        <View style={{ width: 50 }} />
      </View>
      {!data && !error ? (
        <ActivityIndicator color={colors.brandBrown} style={{ marginTop: spacing[8] }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {writing ? (
            <View style={styles.card}>
              <Text style={styles.h}>What went wrong?</Text>
              <Text style={styles.label}>BOOKING</Text>
              <View style={styles.chips}>
                <Chip label="Not about a booking" active={!booking} onPress={() => setBooking('')} />
                {open.map((b) => <Chip key={b.id} label={b.label} active={booking === b.id} onPress={() => setBooking(b.id)} />)}
              </View>
              {open.length === 0 ? <Text style={styles.hint}>Complaints about a grooming can be raised within {data?.hours ?? 24} hours of it.</Text> : null}
              <Text style={styles.label}>TOPIC</Text>
              <View style={styles.chips}>
                {(data?.cats ?? []).map((c) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
              </View>
              <Text style={styles.label}>DETAILS</Text>
              <TextInput style={styles.input} value={text} onChangeText={setText} multiline maxLength={1500} placeholder="Tell us what happened (at least a sentence)" accessibilityLabel="Complaint details" />
              <Text style={styles.label}>PHOTOS (OPTIONAL, UP TO 3)</Text>
              <View style={styles.chips}>
                {photos.map((p) => <Image key={p.url} source={{ uri: p.local }} style={styles.thumb} />)}
                {photos.length < 3 && (
                  <TouchableOpacity style={styles.addPhoto} onPress={addPhoto} disabled={uploading} accessibilityLabel="Add photo">
                    <Text style={{ fontSize: 22, color: colors.textMuted }}>{uploading ? '…' : '+'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
                <View style={{ flex: 1 }}><Button variant="outline" onPress={() => setWriting(false)} fullWidth>Cancel</Button></View>
                <View style={{ flex: 1 }}><Button onPress={send} loading={sending} disabled={!category || text.trim().length < 10} fullWidth>Send</Button></View>
              </View>
            </View>
          ) : (
            <Button onPress={() => setWriting(true)} fullWidth>Raise a complaint</Button>
          )}

          <Text style={[styles.label, { marginTop: spacing[6] }]}>YOUR COMPLAINTS</Text>
          {(data?.complaints ?? []).length === 0 ? (
            <Text style={styles.hint}>No complaints. We hope it stays that way!</Text>
          ) : (
            (data?.complaints ?? []).map((c: Complaint) => (
              <View key={c.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.cid}>{c.id}</Text>
                  <Text style={[styles.status, c.status === 'Resolved' && { color: colors.success }]}>{c.status}</Text>
                </View>
                <Text style={styles.cat}>{c.category}{c.bkLabel ? ` · ${c.bkLabel}` : ''}</Text>
                <Text style={styles.body}>{c.text}</Text>
                {c.resolution ? <Text style={[styles.body, { color: colors.success }]}>Resolution: {c.resolution}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView></SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[3] },
  h: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  label: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginTop: spacing[4], marginBottom: spacing[2] },
  hint: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, maxWidth: '100%' },
  chipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  chipText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  input: { borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.md, padding: spacing[3], minHeight: 100, fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary, textAlignVertical: 'top' },
  thumb: { width: 64, height: 64, borderRadius: radii.md },
  addPhoto: { width: 64, height: 64, borderRadius: radii.md, borderWidth: 2, borderColor: colors.borderLight, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  cid: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  status: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.brandBrown },
  cat: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 4 },
  body: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 19 },
  error: { fontFamily: 'Inter', fontSize: 13, color: colors.error, marginBottom: spacing[3] },
});
