import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { ToolMedia, ToolsResponse } from '@wag/api-client';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

const MB = 1024 * 1024;
const MAX_PHOTO = 10 * MB;
const MAX_VIDEO = 50 * MB;

interface Pending { key: string; kind: 'image' | 'video'; uri: string; name: string; status: 'uploading' | 'failed'; error?: string }

const sizeLabel = (b: number) => (b >= MB ? `${(b / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * "Show us your tools": photos and videos of the equipment a groomer will use. Staff review them before approving
 * the application. Opened right after sign-up (onboarding) and again from Account.
 */
export default function ToolsScreen() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';
  const [data, setData] = useState<ToolsResponse | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const running = useRef(false);

  const load = useCallback(async () => {
    try { setData(await wagApi.partner.tools()); setError(false); } catch { setError(true); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rules = data?.rules ?? { minPhotos: 3, maxPhotos: 10, maxVideos: 3 };
  const photos = data?.counts.photos ?? 0;
  const videos = data?.counts.videos ?? 0;
  const inFlight = (k: 'image' | 'video') => pending.filter((p) => p.kind === k && p.status === 'uploading').length;

  // Upload one file at a time, so a bad connection fails one item, not the whole batch.
  const upload = async (item: Pending) => {
    setPending((cur) => cur.map((p) => (p.key === item.key ? { ...p, status: 'uploading', error: undefined } : p)));
    try {
      await wagApi.partner.addToolFile({ uri: item.uri, name: item.name });
      setPending((cur) => cur.filter((p) => p.key !== item.key));
      await load();
    } catch (err: any) {
      const message = err?.message ?? 'Upload failed';
      setPending((cur) => cur.map((p) => (p.key === item.key ? { ...p, status: 'failed', error: message } : p)));
    }
  };

  const enqueue = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const problems: string[] = [];
    let photoRoom = rules.maxPhotos - photos - inFlight('image');
    let videoRoom = rules.maxVideos - videos - inFlight('video');
    const items: Pending[] = [];
    for (const a of assets) {
      const kind: 'image' | 'video' = a.type === 'video' ? 'video' : 'image';
      const label = a.fileName ?? (kind === 'video' ? 'a video' : 'a photo');
      if (kind === 'image' ? photoRoom <= 0 : videoRoom <= 0) { problems.push(`${label}: you can add up to ${kind === 'image' ? rules.maxPhotos + ' photos' : rules.maxVideos + ' videos'}`); continue; }
      if (a.fileSize && a.fileSize > (kind === 'image' ? MAX_PHOTO : MAX_VIDEO)) { problems.push(`${label}: too large (limit ${kind === 'image' ? 10 : 50} MB)`); continue; }
      if (kind === 'image') photoRoom--; else videoRoom--;
      items.push({ key: `${Date.now()}-${items.length}-${Math.random().toString(36).slice(2, 7)}`, kind, uri: a.uri, name: a.fileName ?? (kind === 'video' ? 'tools.mp4' : 'tools.jpg'), status: 'uploading' });
    }
    if (problems.length) Alert.alert('Some files were skipped', problems.join('\n'));
    if (!items.length) return;
    setPending((cur) => [...cur, ...items]);
    if (running.current) return; // the running loop below will pick them up
    running.current = true;
    try { for (const it of items) await upload(it); } finally { running.current = false; }
  };

  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow access to your photos and videos to add them.'); return; }
    const room = Math.max(1, (rules.maxPhotos - photos) + (rules.maxVideos - videos));
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.7 });
    if (!res.canceled) await enqueue(res.assets);
  };

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow camera access to take photos of your tools.'); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], videoMaxDuration: 60, quality: 0.7 });
    if (!res.canceled) await enqueue(res.assets);
  };

  const remove = (m: ToolMedia) => {
    Alert.alert('Remove this file?', undefined, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { try { await wagApi.partner.removeTool(m.id); await load(); } catch (e: any) { Alert.alert('Could not remove', e?.message ?? 'Please try again.'); } } },
    ]);
  };

  const needMore = data ? Math.max(0, rules.minPhotos - photos) : 0;
  const canContinue = !!data && data.complete && inFlight('image') === 0 && inFlight('video') === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appbar}>
        {!isOnboarding && <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/(tabs)/account')} accessibilityLabel="Go back"><Icon name="back" size={18} color={colors.textPrimary} /></TouchableOpacity>}
        <Text style={[styles.title, isOnboarding && { marginLeft: spacing[1] }]}>Show us your tools</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Add clear photos of the grooming tools you will use: clippers, scissors, brushes, dryer and towels. Our team checks them before approving you. Videos are optional.
        </Text>

        {!data && !error && <ActivityIndicator style={{ marginTop: spacing[8] }} color={colors.brandBrown} />}
        {error && <TouchableOpacity onPress={load}><Text style={styles.error}>Could not load. Tap to try again.</Text></TouchableOpacity>}

        {!!data && (
          <>
            <View style={styles.counts}>
              <View style={[styles.count, photos >= rules.minPhotos && styles.countOk]}>
                <Text style={styles.countNum}>{photos}<Text style={styles.countOf}> / {rules.maxPhotos}</Text></Text>
                <Text style={styles.countLabel}>Photos{data.required ? ` (min ${rules.minPhotos})` : ''}</Text>
              </View>
              <View style={styles.count}>
                <Text style={styles.countNum}>{videos}<Text style={styles.countOf}> / {rules.maxVideos}</Text></Text>
                <Text style={styles.countLabel}>Videos (optional)</Text>
              </View>
            </View>

            <View style={styles.grid}>
              {data.items.map((m) => (
                <View key={m.id} style={styles.tile}>
                  {m.kind === 'image'
                    ? <Image source={{ uri: resolveMediaUrl(m.url) ?? undefined }} style={styles.tileImg} />
                    : <View style={styles.videoTile}><Text style={styles.play}>▶</Text><Text style={styles.videoLabel}>Video</Text><Text style={styles.videoSize}>{sizeLabel(m.sizeBytes)}</Text></View>}
                  <TouchableOpacity style={styles.x} onPress={() => remove(m)} accessibilityLabel="Remove"><Icon name="close" size={12} color={colors.white} /></TouchableOpacity>
                </View>
              ))}
              {pending.map((p) => (
                <View key={p.key} style={styles.tile}>
                  {p.kind === 'image' ? <Image source={{ uri: p.uri }} style={[styles.tileImg, p.status === 'uploading' && { opacity: 0.45 }]} /> : <View style={styles.videoTile}><Text style={styles.play}>▶</Text><Text style={styles.videoLabel}>Video</Text></View>}
                  {p.status === 'uploading' ? (
                    <View style={styles.overlay}><ActivityIndicator color={colors.white} /></View>
                  ) : (
                    <View style={styles.overlay}>
                      <Text style={styles.failText} numberOfLines={2}>{p.error}</Text>
                      <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: 4 }}>
                        <TouchableOpacity onPress={() => upload(p)}><Text style={styles.failBtn}>Retry</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setPending((cur) => cur.filter((x) => x.key !== p.key))}><Text style={styles.failBtn}>Remove</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.addRow}>
              <TouchableOpacity style={styles.addBtn} onPress={fromCamera} accessibilityRole="button"><Icon name="cam" size={18} color={colors.brandBrown} /><Text style={styles.addText}>Take photo</Text></TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={fromLibrary} accessibilityRole="button"><Icon name="plus" size={18} color={colors.brandBrown} /><Text style={styles.addText}>Photos & videos</Text></TouchableOpacity>
            </View>

            {data.required && needMore > 0 && <Text style={styles.need}>Add {needMore} more photo{needMore === 1 ? '' : 's'} to continue.</Text>}
            {!data.required && <Text style={styles.need}>Photos are optional for walkers, but they help staff get to know you.</Text>}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {isOnboarding ? (
          <Button onPress={() => router.replace('/(auth)/pending-approval')} fullWidth disabled={!canContinue}>Continue</Button>
        ) : (
          <Button onPress={() => goBack('/(tabs)/account')} fullWidth>Done</Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const TILE = '31%';
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  appbar: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[2] },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[8] },
  intro: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, lineHeight: 21, marginBottom: spacing[4] },
  error: { fontFamily: 'Inter', fontSize: 14, color: colors.error, textAlign: 'center', marginTop: spacing[6] },

  counts: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] },
  count: { flex: 1, backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.borderLight, padding: spacing[3] },
  countOk: { borderColor: colors.success, backgroundColor: colors.successLight },
  countNum: { fontFamily: 'Inter', fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  countOf: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  countLabel: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: { width: TILE, aspectRatio: 1, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.biscuitLight },
  tileImg: { width: '100%', height: '100%' },
  videoTile: { flex: 1, backgroundColor: '#2A1A10', alignItems: 'center', justifyContent: 'center', gap: 2 },
  play: { fontSize: 22, color: colors.white },
  videoLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '800', color: colors.white },
  videoSize: { fontFamily: 'Inter', fontSize: 10.5, color: 'rgba(255,255,255,0.7)' },
  x: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(30,20,12,0.7)', alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,20,12,0.35)', alignItems: 'center', justifyContent: 'center', padding: 4 },
  failText: { fontFamily: 'Inter', fontSize: 10.5, color: colors.white, textAlign: 'center' },
  failBtn: { fontFamily: 'Inter', fontSize: 11.5, fontWeight: '800', color: colors.white, textDecorationLine: 'underline' },

  addRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] },
  addBtn: { flex: 1, height: 48, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderMedium, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], backgroundColor: colors.white },
  addText: { fontFamily: 'Inter', fontSize: 13.5, fontWeight: '800', color: colors.brandBrown },
  need: { fontFamily: 'Inter', fontSize: 13, color: colors.marigoldDark, marginTop: spacing[4], textAlign: 'center' },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[6], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
