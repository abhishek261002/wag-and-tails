import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Badge } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { format } from 'date-fns';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_payment: 'Pending Payment',
  confirmed: 'Confirmed',
  needs_partner: 'Finding Partner',
  assigned: 'Partner Assigned',
  partner_on_the_way: 'Partner On The Way',
  arrived: 'Partner Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  searching_partner: 'Searching Partner',
  accepted: 'Partner Accepted',
  expired: 'Expired',
};

const CANCELLABLE = ['confirmed', 'needs_partner', 'assigned'];
const RESCHEDULABLE = ['confirmed', 'needs_partner', 'assigned'];

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const b = await wagApi.bookings.get(id);
      setBooking(b);
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await wagApi.bookings.cancel(id!);
            load();
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Could not cancel booking');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleMessage = () => {
    router.push({ pathname: '/messaging/[bookingId]', params: { bookingId: id! } } as any);
  };

  const handleReschedule = () => {
    router.push({ pathname: '/booking/reschedule', params: { id: id! } } as any);
  };

  const handleRate = () => {
    if (booking?.partner) {
      router.push({ pathname: '/booking/rate', params: { id: id! } } as any);
    }
  };

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter' }}>Loading booking…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isGrooming = booking.type === 'grooming';
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';
  const partnerName = booking.partner?.user?.profile
    ? `${booking.partner.user.profile.firstName} ${booking.partner.user.profile.lastName}`
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>{isGrooming ? 'Grooming Booking' : 'Dog Walk'}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusEmoji}>{isGrooming ? '✂️' : '🐾'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{STATUS_LABELS[booking.status] ?? booking.status}</Text>
              <Text style={styles.bookingId}>Booking #{booking.id.slice(-8).toUpperCase()}</Text>
            </View>
            <Badge
              variant={isCompleted ? 'success' : isCancelled ? 'error' : 'warning'}
              label={STATUS_LABELS[booking.status] ?? booking.status}
            />
          </View>
        </Card>

        {/* Pet & Service */}
        <Section title="Pet & Service">
          <Row label="Pet" value={`${booking.petName} · ${booking.petBreed}`} />
          <Row label="Size" value={booking.petSize} />
          {isGrooming && <Row label="Package" value={booking.packageName ?? '—'} />}
          {!isGrooming && <Row label="Duration" value={`${booking.durationMinutes} min walk`} />}
          {booking.addOns?.length > 0 && (
            <Row label="Add-ons" value={booking.addOns.map((a: any) => a.name).join(', ')} />
          )}
          {booking.scheduledAt && (
            <Row label="Date & Time" value={format(new Date(booking.scheduledAt), 'EEE, d MMM yyyy · h:mm a')} />
          )}
          <Row label="Address" value={booking.addressLine} />
          {booking.notes && <Row label="Note" value={booking.notes} />}
        </Section>

        {/* Pet Care Notes — always visible */}
        {booking.petCareNotes && (
          <View style={styles.careNoteBlock}>
            <Text style={styles.careNoteTitle}>📝 Pet Care Notes</Text>
            <Text style={styles.careNoteBody}>{booking.petCareNotes}</Text>
          </View>
        )}

        {/* Partner info */}
        {partnerName && (
          <Section title="Your Partner">
            <Row label="Name" value={partnerName} />
            {booking.partner?.rating && <Row label="Rating" value={`⭐ ${booking.partner.rating}`} />}
            <Row label="Jobs done" value={`${booking.partner.completedJobs ?? 0} jobs`} />
          </Section>
        )}

        {/* Payment receipt */}
        <Section title="Receipt">
          <Row label="Subtotal" value={`₹${booking.subtotal}`} />
          {Number(booking.discount) > 0 && (
            <Row label="Discount" value={`-₹${booking.discount}`} valueColor={colors.success} />
          )}
          <Row label="Total" value={`₹${booking.total}`} bold />
          <Row label="Payment" value={booking.paymentMethod?.replace(/_/g, ' ') ?? '—'} />
          <Row label="Status" value={booking.paymentStatus ?? '—'} />
        </Section>

        {/* Status timeline */}
        {booking.statusHistory?.length > 0 && (
          <Section title="Status Timeline">
            {[...booking.statusHistory].reverse().map((h: any, i: number) => (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineStatus}>
                    {STATUS_LABELS[h.status] ?? h.status}
                  </Text>
                  <Text style={styles.timelineDate}>
                    {format(new Date(h.changedAt), 'd MMM, h:mm a')}
                  </Text>
                  {h.note && <Text style={styles.timelineNote}>{h.note}</Text>}
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {partnerName && !isCompleted && !isCancelled && (
            <Button onPress={handleMessage} variant="outline" fullWidth style={styles.actionBtn}>
              💬 Message Partner
            </Button>
          )}
          {RESCHEDULABLE.includes(booking.status) && (
            <Button onPress={handleReschedule} variant="outline" fullWidth style={styles.actionBtn}>
              🗓 Reschedule
            </Button>
          )}
          {isCompleted && !booking.review && (
            <Button onPress={handleRate} fullWidth style={styles.actionBtn}>
              ⭐ Rate & Review
            </Button>
          )}
          {CANCELLABLE.includes(booking.status) && (
            <Button
              onPress={handleCancel}
              variant="destructive"
              fullWidth
              loading={cancelling}
              style={styles.actionBtn}
            >
              Cancel Booking
            </Button>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  pageTitle: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[16] },
  statusCard: { marginBottom: spacing[4], padding: spacing[4] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  statusEmoji: { fontSize: 32 },
  statusTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  bookingId: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  section: { marginBottom: spacing[4] },
  sectionLabel: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[2] },
  sectionCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, flex: 1 },
  rowValue: { fontFamily: 'Inter', fontSize: 13, color: colors.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  rowBold: { fontWeight: '800', fontSize: 15, color: colors.brandBrown },
  careNoteBlock: { backgroundColor: colors.warningLight, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[4] },
  careNoteTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.warning, marginBottom: spacing[2] },
  careNoteBody: { fontFamily: 'Inter', fontSize: 14, color: colors.warning, lineHeight: 21 },
  timelineRow: { flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.marigold, marginTop: 4 },
  timelineStatus: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  timelineDate: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted },
  timelineNote: { fontFamily: 'Inter', fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  actions: { gap: spacing[3], marginTop: spacing[2] },
  actionBtn: {},
});
