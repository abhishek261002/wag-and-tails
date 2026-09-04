import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Linking, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, SlideToComplete } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import * as ImagePicker from 'expo-image-picker';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const b = await wagApi.bookings.get(id);
      setBooking(b);
      // Build checklist from package inclusions + add-ons
      const items: string[] = [];
      if ((b as any).package?.items) {
        (b as any).package.items.forEach((i: any) => items.push(i.description));
      }
      if ((b as any).addOns) {
        (b as any).addOns.forEach((a: any) => items.push(a.name));
      }
      setChecklist(items);
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleCheck = (item: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(item) ? next.delete(item) : next.add(item);
      return next;
    });
  };

  const pickPhoto = async (type: 'before' | 'after') => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (type === 'before') setBeforePhotos((p) => [...p, uri]);
      else setAfterPhotos((p) => [...p, uri]);
    }
  };

  const handleStart = async () => {
    if (!id) return;
    try {
      await wagApi.partner.startJob(id);
      load();
    } catch (err: any) {
      Alert.alert('Error', err?.message);
    }
  };

  const canComplete = checklist.length === 0 || (checklist.every((i) => checked.has(i)) && afterPhotos.length > 0);

  const handleComplete = async () => {
    if (!id) return;
    setCompleting(true);
    try {
      await wagApi.partner.completeJob(id, {
        checklistItems: [...checked],
        beforePhotos,
        afterPhotos,
      });
      Alert.alert('Job Complete! 🎉', 'Great work! The customer has been notified.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/jobs') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message);
    } finally {
      setCompleting(false);
    }
  };

  const callCustomer = () => {
    if (booking?.customer?.phone) {
      Linking.openURL(`tel:${booking.customer.phone}`);
    }
  };

  const openNavigation = () => {
    if (booking?.address) {
      const { lat, lng } = booking.address;
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    }
  };

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter' }}>Loading job...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = booking.status;
  const isGrooming = booking.type === 'grooming';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>{isGrooming ? 'Grooming Job' : 'Walk Job'}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pet summary */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🐾 Pet Details</Text>
          <InfoRow label="Pet" value={`${booking.petName} — ${booking.petBreed}`} />
          <InfoRow label="Size" value={booking.petSize} />
          {booking.pet?.weightKg && <InfoRow label="Weight" value={`${booking.pet.weightKg} kg`} />}
          {booking.pet?.coatType && <InfoRow label="Coat" value={booking.pet.coatType} />}
          {booking.pet?.isNeutered !== undefined && <InfoRow label="Neutered" value={booking.pet.isNeutered ? 'Yes' : 'No'} />}

          {/* Care notes — prominently shown */}
          {booking.petCareNotes && (
            <View style={styles.careNote}>
              <Text style={styles.careNoteTitle}>📝 Care Notes (read carefully)</Text>
              <Text style={styles.careNoteText}>{booking.petCareNotes}</Text>
            </View>
          )}
          {booking.pet?.allergies && (
            <View style={[styles.careNote, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.careNoteTitle, { color: colors.error }]}>⚠️ Allergies</Text>
              <Text style={[styles.careNoteText, { color: colors.error }]}>{booking.pet.allergies}</Text>
            </View>
          )}
        </Card>

        {/* Customer */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Customer</Text>
          <View style={styles.customerRow}>
            <Text style={styles.customerName}>
              {booking.customer?.profile?.firstName} {booking.customer?.profile?.lastName}
            </Text>
            <View style={styles.customerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={callCustomer} accessibilityLabel="Call customer">
                <Text style={{ fontSize: 20 }}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push({ pathname: '/messaging/[bookingId]', params: { bookingId: id! } } as any)} accessibilityLabel="Message customer">
                <Text style={{ fontSize: 20 }}>💬</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={openNavigation} accessibilityLabel="Navigate to customer">
                <Text style={{ fontSize: 20 }}>🗺️</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.addressText}>📍 {booking.addressLine}</Text>
        </Card>

        {/* Package / service */}
        {isGrooming && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>✂️ Package</Text>
            <Text style={styles.packageName}>{booking.packageName}</Text>
            {booking.addOns?.length > 0 && (
              <Text style={styles.addonsText}>
                + {booking.addOns.map((a: any) => a.name).join(', ')}
              </Text>
            )}
          </Card>
        )}

        {/* Checklist — only show when in_progress */}
        {status === 'in_progress' && checklist.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>☑️ Checklist ({[...checked].length}/{checklist.length})</Text>
            {checklist.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.checkItem}
                onPress={() => toggleCheck(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: checked.has(item) }}
              >
                <View style={[styles.checkbox, checked.has(item) && styles.checkboxDone]}>
                  {checked.has(item) && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                </View>
                <Text style={[styles.checkLabel, checked.has(item) && styles.checkLabelDone]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Photos */}
        {status === 'in_progress' && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📸 Photos</Text>

            <Text style={styles.photoSubtitle}>Before photos {beforePhotos.length > 0 ? `(${beforePhotos.length})` : ''}</Text>
            <View style={styles.photoRow}>
              {beforePhotos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photoThumb} />
              ))}
              <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickPhoto('before')} accessibilityLabel="Add before photo">
                <Text style={{ fontSize: 24, color: colors.textMuted }}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.photoSubtitle, { marginTop: spacing[3] }]}>
              After photos {afterPhotos.length > 0 ? `(${afterPhotos.length})` : ''} *
            </Text>
            <View style={styles.photoRow}>
              {afterPhotos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photoThumb} />
              ))}
              <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickPhoto('after')} accessibilityLabel="Add after photo">
                <Text style={{ fontSize: 24, color: colors.textMuted }}>+</Text>
              </TouchableOpacity>
            </View>
            {afterPhotos.length === 0 && (
              <Text style={styles.requiredNote}>* At least 1 after photo required to complete</Text>
            )}
          </Card>
        )}

        {/* Payout */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Your Payout</Text>
          <View style={styles.payoutRow}>
            <Text style={styles.payoutLabel}>Booking total</Text>
            <Text style={styles.payoutValue}>₹{booking.total}</Text>
          </View>
          <View style={styles.payoutRow}>
            <Text style={styles.payoutLabel}>Platform fee (20%)</Text>
            <Text style={[styles.payoutValue, { color: colors.error }]}>
              -₹{Math.round(Number(booking.total) * 0.20)}
            </Text>
          </View>
          <View style={[styles.payoutRow, styles.payoutTotal]}>
            <Text style={styles.payoutTotalLabel}>Your earnings</Text>
            <Text style={styles.payoutTotalValue}>
              ₹{Math.round(Number(booking.total) * 0.80)}
            </Text>
          </View>
        </Card>

        {/* Action buttons */}
        <View style={styles.actions}>
          {status === 'assigned' && (
            <Button onPress={handleStart} fullWidth>
              Start Job
            </Button>
          )}

          {status === 'in_progress' && (
            <>
              {canComplete ? (
                <SlideToComplete onComplete={handleComplete} label="Slide to complete job" />
              ) : (
                <View style={styles.cannotComplete}>
                  <Text style={styles.cannotCompleteText}>
                    {checklist.length > 0 && [...checked].length < checklist.length
                      ? '⚠️ Complete all checklist items first'
                      : '⚠️ Add at least one after photo'}
                  </Text>
                </View>
              )}
            </>
          )}

          {status === 'completed' && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedText}>✅ Job completed</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  pageTitle: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingBottom: spacing[16] },
  section: { marginHorizontal: spacing[4], marginBottom: spacing[3] },
  sectionTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[3] },
  careNote: { backgroundColor: colors.warningLight, borderRadius: radii.md, padding: spacing[3], marginTop: spacing[3] },
  careNoteTitle: { fontFamily: 'Inter', fontSize: 12, fontWeight: '800', color: colors.warning, marginBottom: 4 },
  careNoteText: { fontFamily: 'Inter', fontSize: 13, color: colors.warning, lineHeight: 19 },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  customerName: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  customerActions: { flexDirection: 'row', gap: spacing[2] },
  iconBtn: { width: 40, height: 40, borderRadius: radii.lg, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  addressText: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted },
  packageName: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  addonsText: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 4 },
  checkItem: { flexDirection: 'row', gap: spacing[3], alignItems: 'center', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderMedium, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkLabel: { fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary, flex: 1 },
  checkLabelDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  photoSubtitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing[2] },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  photoThumb: { width: 76, height: 76, borderRadius: radii.md },
  addPhotoBtn: { width: 76, height: 76, borderRadius: radii.md, borderWidth: 2, borderColor: colors.borderLight, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  requiredNote: { fontFamily: 'Inter', fontSize: 11, color: colors.error, marginTop: spacing[2] },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  payoutLabel: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted },
  payoutValue: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  payoutTotal: { borderBottomWidth: 0, marginTop: spacing[1] },
  payoutTotalLabel: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  payoutTotalValue: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.success },
  actions: { paddingHorizontal: spacing[5], marginTop: spacing[4] },
  cannotComplete: { backgroundColor: colors.warningLight, borderRadius: radii.xl, padding: spacing[4], alignItems: 'center' },
  cannotCompleteText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.warning },
  completedBanner: { backgroundColor: colors.successLight, borderRadius: radii.xl, padding: spacing[4], alignItems: 'center' },
  completedText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.success },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted },
  infoValue: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textPrimary, maxWidth: '60%', textAlign: 'right' },
});
