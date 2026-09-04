import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, SlideToComplete } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import * as ImagePicker from 'expo-image-picker';

export default function WalkDetailScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [ending, setEnding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const b = await wagApi.bookings.get(bookingId!);
      setBooking(b);
    } catch {}
  };

  useEffect(() => {
    load();
  }, [bookingId]);

  useEffect(() => {
    if ((booking as any)?.status === 'in_progress') {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [booking?.status]);

  const handleStart = async () => {
    try {
      await wagApi.partner.startWalk(bookingId!);
      load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not start walk');
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      setPhotos((p) => [...p, res.assets[0]!.uri]);
    }
  };

  const handleEnd = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setEnding(true);
    try {
      await wagApi.partner.endWalk(bookingId!, photos);
      Alert.alert('Walk complete! 🏁', 'Great job! The customer has been notified.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/jobs') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not end walk');
    } finally {
      setEnding(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const status = (booking as any)?.status ?? '';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Dog Walk</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Pet summary */}
        <View style={styles.petCard}>
          <Text style={styles.petEmoji}>🐾</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.petName}>{(booking as any)?.petName} · {(booking as any)?.petBreed}</Text>
            <Text style={styles.petSize}>{(booking as any)?.durationMinutes} min walk · {(booking as any)?.petSize}</Text>
          </View>
        </View>

        {/* Care notes */}
        {(booking as any)?.petCareNotes && (
          <View style={styles.careNote}>
            <Text style={styles.careNoteTitle}>📝 Care Notes (read carefully)</Text>
            <Text style={styles.careNoteText}>{(booking as any).petCareNotes}</Text>
          </View>
        )}

        {/* Customer */}
        <View style={styles.customerCard}>
          <Text style={styles.customerName}>
            {(booking as any)?.customer?.profile?.firstName} {(booking as any)?.customer?.profile?.lastName}
          </Text>
          <Text style={styles.addressText}>📍 {(booking as any)?.addressLine}</Text>
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() => router.push({ pathname: '/messaging/[bookingId]', params: { bookingId: bookingId! } } as any)}
            accessibilityLabel="Message customer"
          >
            <Text style={styles.messageBtnText}>💬 Message Customer</Text>
          </TouchableOpacity>
        </View>

        {/* Timer */}
        {status === 'in_progress' && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Walk Duration</Text>
            <Text style={styles.timerValue}>{fmt(elapsed)}</Text>
          </View>
        )}

        {/* Photos */}
        {status === 'in_progress' && (
          <View style={styles.photosCard}>
            <Text style={styles.sectionTitle}>📸 Walk Photos</Text>
            <View style={styles.photosRow}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Text style={{ fontSize: 30 }}>🖼</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.addPhoto} onPress={pickPhoto} accessibilityLabel="Add photo">
                <Text style={{ fontSize: 24, color: colors.textMuted }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {status === 'accepted' && (
            <Button onPress={handleStart} fullWidth>Navigate to Pickup & Start</Button>
          )}
          {status === 'in_progress' && (
            <SlideToComplete onComplete={handleEnd} label="Slide to end walk" />
          )}
          {status === 'completed' && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedText}>✅ Walk completed</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  pageTitle: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[16] },
  petCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[3] },
  petEmoji: { fontSize: 40 },
  petName: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  petSize: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 3 },
  careNote: { backgroundColor: colors.warningLight, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[3] },
  careNoteTitle: { fontFamily: 'Inter', fontSize: 12, fontWeight: '800', color: colors.warning, marginBottom: 4 },
  careNoteText: { fontFamily: 'Inter', fontSize: 13, color: colors.warning, lineHeight: 19 },
  customerCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[3] },
  customerName: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  addressText: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginBottom: spacing[3] },
  messageBtn: { borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.brandBrown, paddingVertical: spacing[3], alignItems: 'center' },
  messageBtnText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.brandBrown },
  timerCard: { backgroundColor: colors.brandBrown, borderRadius: radii.xl, padding: spacing[6], alignItems: 'center', marginBottom: spacing[3] },
  timerLabel: { fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  timerValue: { fontFamily: 'Inter', fontSize: 52, fontWeight: '800', color: colors.white },
  photosCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[3] },
  sectionTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[3] },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  photoThumb: { width: 72, height: 72, borderRadius: radii.md, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  addPhoto: { width: 72, height: 72, borderRadius: radii.md, borderWidth: 2, borderColor: colors.borderLight, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: spacing[2], gap: spacing[3] },
  completedBanner: { backgroundColor: colors.successLight, borderRadius: radii.xl, padding: spacing[5], alignItems: 'center' },
  completedText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.success },
});
