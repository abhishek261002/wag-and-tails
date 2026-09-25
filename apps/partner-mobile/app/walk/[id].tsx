import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, SlideToComplete, LiveMapView, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../../src/lib/api';
import { CollectPaymentCard } from '../../src/components/CollectPaymentCard';
import * as ImagePicker from 'expo-image-picker';
import { useJobLocationBroadcast } from '../../src/hooks/useJobLocationBroadcast';
import { goBack } from '../../src/lib/nav';

export default function WalkDetailScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [ending, setEnding] = useState(false);
  const [beforeUploading, setBeforeUploading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [endOtpInput, setEndOtpInput] = useState('');
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

  const handleOnTheWay = async () => {
    setTransitioning(true);
    try {
      await wagApi.partner.markOnTheWay(bookingId!);
      await load();
      router.push({ pathname: '/navigate/[id]', params: { id: bookingId! } } as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update status');
    } finally {
      setTransitioning(false);
    }
  };

  const handleArrived = async () => {
    setTransitioning(true);
    try {
      await wagApi.partner.markArrived(bookingId!);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update status');
    } finally {
      setTransitioning(false);
    }
  };

  // Server refuses the start code until a before-photo of the dog is on file.
  const takeBeforePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera needed', 'Allow camera access to photograph the dog before starting.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setBeforeUploading(true);
    try {
      const url = await wagApi.partner.uploadJobPhoto(bookingId!, { uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' });
      await wagApi.partner.addBeforePhotos(bookingId!, [url]);
      await load();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.response?.data?.message ?? err?.message ?? 'Please try again.');
    } finally {
      setBeforeUploading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpInput.length < 4) return;
    setTransitioning(true);
    try {
      await wagApi.partner.verifyStartOtp(bookingId!, otpInput);
      setOtpInput('');
      await load();
    } catch (err: any) {
      const data = err?.response?.data;
      Alert.alert(data?.code === 'BEFORE_PHOTO_REQUIRED' ? 'Photo needed' : 'Incorrect code', data?.message ?? err?.message ?? 'Ask the customer for the code again.');
    } finally {
      setTransitioning(false);
    }
  };

  const myLocation = useJobLocationBroadcast(
    ['accepted', 'partner_on_the_way', 'arrived', 'in_progress'].includes((booking as any)?.status ?? '')
  );

  const pickPhoto = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      setPhotos((p) => [...p, res.assets[0]!.uri]);
    }
  };

  const handleEnd = async () => {
    if (endOtpInput.length < 4) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setEnding(true);
    try {
      const uploaded: string[] = [];
      for (const uri of photos) {
        uploaded.push(await wagApi.partner.uploadJobPhoto(bookingId!, { uri, name: `walk-${Date.now()}.jpg`, type: 'image/jpeg' }));
      }
      await wagApi.partner.completeJob(bookingId!, {
        otp: endOtpInput,
        checklistItems: [],
        afterPhotos: uploaded,
      });
      Alert.alert('Walk complete!', 'Great job! The customer has been notified.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/jobs') },
      ]);
    } catch (err: any) {
      Alert.alert('Incorrect code', err?.message ?? 'Ask the customer for the code again.');
    } finally {
      setEnding(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const status = (booking as any)?.status ?? '';
  // The end code only appears to the customer once the planned duration
  // has elapsed (see booking/walking/live.tsx) — mirrored here so the
  // partner isn't shown an OTP field they can't get a code for yet.
  const durationSeconds = ((booking as any)?.durationMinutes ?? 30) * 60;
  const timerDone = elapsed >= durationSeconds;
  const canComplete = timerDone && photos.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Dog Walk</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Pet summary */}
        <View style={styles.petCard}>
          <View style={styles.petIconBox}>
            <Icon name="paw" size={22} color={colors.marigoldDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.petName}>{(booking as any)?.petName} · {(booking as any)?.petBreed}</Text>
            <Text style={styles.petSize}>{(booking as any)?.durationMinutes} min walk · {(booking as any)?.petSize}</Text>
          </View>
        </View>

        {/* Care notes */}
        {(booking as any)?.petCareNotes && (
          <View style={styles.careNote}>
            <View style={styles.careNoteTitleRow}>
              <Icon name="doc" size={13} color={colors.warning} />
              <Text style={styles.careNoteTitle}>Care Notes (read carefully)</Text>
            </View>
            <Text style={styles.careNoteText}>{(booking as any).petCareNotes}</Text>
          </View>
        )}

        {/* Customer */}
        <View style={styles.customerCard}>
          <Text style={styles.customerName}>
            {(booking as any)?.customer?.profile?.firstName} {(booking as any)?.customer?.profile?.lastName}
          </Text>
          <View style={styles.addressRow}>
            <Icon name="pin" size={13} color={colors.textMuted} />
            <Text style={styles.addressText}>{(booking as any)?.addressLine}</Text>
          </View>
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() => router.push({ pathname: '/messaging/[bookingId]', params: { bookingId: bookingId! } } as any)}
            accessibilityLabel="Message customer"
          >
            <Icon name="chat" size={15} color={colors.brandBrown} />
            <Text style={styles.messageBtnText}>Message Customer</Text>
          </TouchableOpacity>
        </View>

        {/* Live map — shows this partner's own position heading to the
            customer's booking address; see packages/ui-mobile/src/LiveMapView
            for the Ola Maps integration point. */}
        {['accepted', 'partner_on_the_way', 'arrived'].includes(status) && (booking as any)?.address && (
          <View style={{ marginBottom: spacing[3] }}>
            <LiveMapView
              partner={myLocation ? { ...myLocation, label: 'You' } : null}
              destination={{ lat: (booking as any).address.lat, lng: (booking as any).address.lng, label: 'Customer' }}
            />
          </View>
        )}

        {/* Timer */}
        {status === 'in_progress' && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>{timerDone ? 'Planned duration reached' : 'Walk Duration'}</Text>
            <Text style={styles.timerValue}>{fmt(elapsed)}</Text>
            {!timerDone && (
              <Text style={styles.timerSub}>of {fmt(durationSeconds)} planned</Text>
            )}
          </View>
        )}

        {/* Photos */}
        {status === 'in_progress' && (
          <View style={styles.photosCard}>
            <View style={styles.sectionTitleRow}>
              <Icon name="cam" size={15} color={colors.textPrimary} />
              <Text style={styles.sectionTitle}>Walk Photos</Text>
            </View>
            <View style={styles.photosRow}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Icon name="cam" size={26} color={colors.textDisabled} />
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
            <Button onPress={handleOnTheWay} loading={transitioning} fullWidth>On my way to pickup</Button>
          )}
          {status === 'partner_on_the_way' && (
            <View style={{ gap: 8 }}>
              <Button variant="outline" onPress={() => router.push({ pathname: '/navigate/[id]', params: { id: bookingId! } } as any)} fullWidth>Open directions</Button>
              <Button onPress={handleArrived} loading={transitioning} fullWidth>I've arrived</Button>
            </View>
          )}
          {status === 'arrived' && (
            <View style={styles.otpCard}>
              <Text style={styles.otpTitle}>1. Photograph the dog</Text>
              <Text style={styles.otpSubtitle}>A clear before-photo is required before the walk can start.</Text>
              <View style={styles.photosRow}>
                {((booking?.beforePhotos ?? []) as string[]).map((u: string, i: number) => (
                  <Image key={i} source={{ uri: resolveMediaUrl(u) }} style={styles.photoThumb} />
                ))}
                <TouchableOpacity style={styles.addPhoto} onPress={takeBeforePhoto} disabled={beforeUploading} accessibilityLabel="Add before photo">
                  <Text style={{ fontSize: 24, color: colors.textMuted }}>{beforeUploading ? '…' : '+'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.otpTitle}>2. Ask the customer for their code</Text>
              <Text style={styles.otpSubtitle}>They see a 4-digit code once you accept. Enter it to start the walk.</Text>
              <TextInput
                style={styles.otpInput}
                value={otpInput}
                onChangeText={setOtpInput}
                placeholder="0000"
                keyboardType="number-pad"
                maxLength={4}
                accessibilityLabel="Start code"
              />
              <Button onPress={handleVerifyOtp} loading={transitioning} disabled={otpInput.length < 4 || ((booking?.beforePhotos ?? []) as string[]).length === 0} fullWidth>
                Start walk
              </Button>
            </View>
          )}
          {status === 'in_progress' && (
            !timerDone ? (
              <View style={styles.cannotComplete}>
                <View style={styles.cannotCompleteRow}>
                  <Icon name="clock" size={14} color={colors.warning} />
                  <Text style={styles.cannotCompleteText}>Walk in progress — the end code appears once the timer finishes</Text>
                </View>
              </View>
            ) : photos.length === 0 ? (
              <View style={styles.cannotComplete}>
                <View style={styles.cannotCompleteRow}>
                  <Icon name="alert" size={14} color={colors.warning} />
                  <Text style={styles.cannotCompleteText}>Add at least one photo from the walk first</Text>
                </View>
              </View>
            ) : booking?.paymentStatus !== 'paid' ? (
              <CollectPaymentCard bookingId={bookingId!} amount={Number(booking?.total ?? 0)} onCollected={load} />
            ) : (
              <View style={styles.otpCard}>
                <Text style={styles.otpTitle}>Ask the customer for their end code</Text>
                <Text style={styles.otpSubtitle}>They see a 4-digit code now that the walk time is up. Enter it to finish.</Text>
                <TextInput
                  style={styles.otpInput}
                  value={endOtpInput}
                  onChangeText={setEndOtpInput}
                  placeholder="0000"
                  keyboardType="number-pad"
                  maxLength={4}
                  accessibilityLabel="End code"
                />
                <SlideToComplete onComplete={handleEnd} label="Slide to end walk" disabled={endOtpInput.length < 4 || ending} />
              </View>
            )
          )}
          {status === 'completed' && (
            <View style={styles.completedBanner}>
              <Icon name="check" size={16} color={colors.success} />
              <Text style={styles.completedText}>Walk completed</Text>
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
  petIconBox: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  petName: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  petSize: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 3 },
  careNote: { backgroundColor: colors.warningLight, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[3] },
  careNoteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  careNoteTitle: { fontFamily: 'Inter', fontSize: 12, fontWeight: '800', color: colors.warning },
  careNoteText: { fontFamily: 'Inter', fontSize: 13, color: colors.warning, lineHeight: 19 },
  customerCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[3] },
  customerName: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing[3] },
  addressText: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted },
  messageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.brandBrown, paddingVertical: spacing[3] },
  messageBtnText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.brandBrown },
  timerCard: { backgroundColor: colors.brandBrown, borderRadius: radii.xl, padding: spacing[6], alignItems: 'center', marginBottom: spacing[3] },
  timerLabel: { fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  timerValue: { fontFamily: 'Inter', fontSize: 52, fontWeight: '800', color: colors.white },
  timerSub: { fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  cannotComplete: { backgroundColor: colors.warningLight, borderRadius: radii.xl, padding: spacing[4] },
  cannotCompleteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cannotCompleteText: { flex: 1, fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.warning },
  photosCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[3] },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing[3] },
  sectionTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  photoThumb: { width: 72, height: 72, borderRadius: radii.md, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  addPhoto: { width: 72, height: 72, borderRadius: radii.md, borderWidth: 2, borderColor: colors.borderLight, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: spacing[2], gap: spacing[3] },
  completedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.successLight, borderRadius: radii.xl, padding: spacing[5] },
  completedText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.success },
  otpCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.borderLight, gap: spacing[3] },
  otpTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  otpSubtitle: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: -spacing[2] },
  otpInput: {
    borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.md,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4], fontSize: 24,
    fontWeight: '800', letterSpacing: 8, textAlign: 'center', color: colors.textPrimary,
    fontFamily: 'Inter', backgroundColor: colors.white,
  },
});
