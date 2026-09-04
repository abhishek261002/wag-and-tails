import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Switch, RefreshControl, Alert, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { useModeStore } from '../../src/store/mode.store';

type PartnerJobCard = {
  bookingId: string;
  type: string;
  petName: string;
  petBreed: string;
  petSize: string;
  petWeightKg: number | null;
  petCareNotes: string | null;
  customerName: string;
  customerRating: number;
  addressLine: string;
  distanceKm: number;
  scheduledAt: string | null;
  packageName?: string;
  addOns?: string[];
  durationMinutes?: number;
  partnerPayout: number;
  status: string;
};

export default function JobsScreen() {
  const { mode, isOnline, setMode, setOnline } = useModeStore();
  const [openJobs, setOpenJobs] = useState<PartnerJobCard[]>([]);
  const [myJobs, setMyJobs] = useState<PartnerJobCard[]>([]);
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [refreshing, setRefreshing] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse when online
  useEffect(() => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline, pulseAnim]);

  const load = useCallback(async () => {
    try {
      const [open, mine] = await Promise.all([
        wagApi.partner.getOpenJobs(),
        wagApi.partner.getMyJobs(),
      ]);
      setOpenJobs(open as PartnerJobCard[]);
      setMyJobs(mine as PartnerJobCard[]);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleToggleOnline = async (val: boolean) => {
    setTogglingOnline(true);
    try {
      await wagApi.partner.setOnline(val);
      setOnline(val);
    } catch {
      Alert.alert('Error', 'Could not update status. Check your connection.');
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleClaim = async (bookingId: string) => {
    try {
      await wagApi.partner.claimJob(bookingId);
      load();
      Alert.alert('Job claimed! 🎉', 'Check your schedule tab for details.');
    } catch (err: any) {
      Alert.alert('Could not claim', err?.message ?? 'Job may have been taken.');
    }
  };

  const jobs = tab === 'open' ? openJobs : myJobs;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.onlineRow}>
          <Animated.View style={[styles.onlineDot, { transform: [{ scale: pulseAnim }], backgroundColor: isOnline ? colors.success : colors.gray400 }]} />
          <Text style={styles.onlineLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            disabled={togglingOnline}
            trackColor={{ false: colors.gray300, true: colors.success }}
            thumbColor={colors.white}
            accessibilityLabel="Toggle online status"
          />
        </View>

        {/* Mode switch */}
        <View style={styles.modeSwitch}>
          {(['grooming', 'walking'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => setMode(m)}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === m }}
            >
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                {m === 'grooming' ? '✂️ Grooming' : '🐾 Walking'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'open' && styles.tabActive]} onPress={() => setTab('open')}>
          <Text style={[styles.tabText, tab === 'open' && styles.tabTextActive]}>
            Open Jobs {openJobs.length > 0 ? `(${openJobs.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'mine' && styles.tabActive]} onPress={() => setTab('mine')}>
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
            My Jobs {myJobs.length > 0 ? `(${myJobs.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {!isOnline && tab === 'open' && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>You're offline — go online to see available jobs</Text>
        </View>
      )}

      <FlatList
        data={isOnline || tab === 'mine' ? jobs : []}
        keyExtractor={(j) => j.bookingId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBrown} />}
        renderItem={({ item: job }) => (
          <JobCard job={job} tab={tab} onClaim={handleClaim} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>{tab === 'open' ? '🔍' : '📋'}</Text>
            <Text style={styles.emptyText}>
              {tab === 'open' ? 'No open jobs near you right now' : 'No jobs assigned yet'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function JobCard({
  job, tab, onClaim,
}: { job: PartnerJobCard; tab: string; onClaim: (id: string) => void }) {
  const isGrooming = job.type === 'grooming';

  return (
    <Card style={styles.jobCard} onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.bookingId } })}>
      <View style={styles.jobHeader}>
        <View style={styles.jobTypeIcon}>
          <Text style={{ fontSize: 24 }}>{isGrooming ? '✂️' : '🐾'}</Text>
        </View>
        <View style={styles.jobMeta}>
          <Text style={styles.jobPet}>{job.petName} · {job.petBreed}</Text>
          <Text style={styles.jobCustomer}>{job.customerName} ⭐ {job.customerRating.toFixed(1)}</Text>
        </View>
        <View style={styles.payoutBox}>
          <Text style={styles.payoutAmt}>₹{job.partnerPayout}</Text>
          <Text style={styles.payoutLabel}>payout</Text>
        </View>
      </View>

      {/* Pet info row */}
      <View style={styles.tagsRow}>
        <Tag label={job.petSize} />
        {job.petWeightKg && <Tag label={`${job.petWeightKg}kg`} />}
        {isGrooming && job.packageName && <Tag label={job.packageName} highlight />}
        {!isGrooming && job.durationMinutes && <Tag label={`${job.durationMinutes} min`} highlight />}
      </View>

      {/* Add-ons */}
      {job.addOns && job.addOns.length > 0 && (
        <Text style={styles.addons}>+ {job.addOns.join(', ')}</Text>
      )}

      {/* Care notes — always prominent */}
      {job.petCareNotes && (
        <View style={styles.careNote}>
          <Text style={styles.careNoteIcon}>📝</Text>
          <Text style={styles.careNoteText} numberOfLines={3}>{job.petCareNotes}</Text>
        </View>
      )}

      {/* Location & time */}
      <View style={styles.infoRow}>
        <Text style={styles.infoText}>📍 {job.addressLine}</Text>
        <Text style={styles.distanceText}>{job.distanceKm.toFixed(1)} km away</Text>
      </View>
      {job.scheduledAt && (
        <Text style={styles.scheduledAt}>
          🕐 {new Date(job.scheduledAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}

      {/* Actions */}
      {tab === 'open' && (
        <TouchableOpacity
          style={styles.claimBtn}
          onPress={() => onClaim(job.bookingId)}
          accessibilityRole="button"
          accessibilityLabel={`Claim job for ${job.petName}`}
        >
          <Text style={styles.claimBtnText}>Claim Job</Text>
        </TouchableOpacity>
      )}
      {tab === 'mine' && (
        <View style={styles.statusRow}>
          <Badge variant="success" label={job.status.replace(/_/g, ' ')} />
          <TouchableOpacity onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.bookingId } })}>
            <Text style={styles.viewBtn}>View details →</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

function Tag({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <View style={[styles.tag, highlight && styles.tagHighlight]}>
      <Text style={[styles.tagText, highlight && styles.tagTextHighlight]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  statusBar: { backgroundColor: colors.white, paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  onlineLabel: { flex: 1, fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  modeSwitch: { flexDirection: 'row', gap: spacing[2] },
  modeBtn: { flex: 1, paddingVertical: spacing[2], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, alignItems: 'center' },
  modeBtnActive: { borderColor: colors.brandBrown, backgroundColor: colors.brandBrown },
  modeBtnText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.textMuted },
  modeBtnTextActive: { color: colors.white },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.white },
  tab: { flex: 1, paddingVertical: spacing[3], alignItems: 'center' },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: colors.brandBrown },
  tabText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brandBrown, fontWeight: '800' },
  offlineBanner: { backgroundColor: colors.warningLight, paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  offlineText: { fontFamily: 'Inter', fontSize: 13, color: colors.warning, fontWeight: '600' },
  list: { padding: spacing[4], gap: spacing[3] },
  jobCard: { padding: spacing[4] },
  jobHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], marginBottom: spacing[3] },
  jobTypeIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  jobMeta: { flex: 1 },
  jobPet: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  jobCustomer: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  payoutBox: { alignItems: 'flex-end' },
  payoutAmt: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.brandBrown },
  payoutLabel: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[2] },
  tag: { backgroundColor: colors.biscuitLight, borderRadius: radii.full, paddingHorizontal: spacing[3], paddingVertical: 3 },
  tagHighlight: { backgroundColor: colors.marigoldBg },
  tagText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: colors.brandBrown },
  tagTextHighlight: { color: colors.marigoldDark },
  addons: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginBottom: spacing[2] },
  careNote: { flexDirection: 'row', gap: spacing[2], backgroundColor: colors.warningLight, borderRadius: radii.md, padding: spacing[3], marginBottom: spacing[3] },
  careNoteIcon: { fontSize: 14 },
  careNoteText: { flex: 1, fontFamily: 'Inter', fontSize: 13, color: colors.warning, lineHeight: 19 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoText: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, flex: 1 },
  distanceText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.marigoldDark },
  scheduledAt: { fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, marginTop: spacing[1], marginBottom: spacing[3] },
  claimBtn: { backgroundColor: colors.brandBrown, borderRadius: radii.lg, paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  claimBtnText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.white },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[2] },
  viewBtn: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.marigoldDark },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: 15, color: colors.textMuted, marginTop: spacing[3], textAlign: 'center', paddingHorizontal: spacing[8] },
});
