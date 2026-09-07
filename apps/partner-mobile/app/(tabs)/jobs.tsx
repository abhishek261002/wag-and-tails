import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PetAvatar, Button } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
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
  const [refreshing, setRefreshing] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [open, mine] = await Promise.all([
        wagApi.partner.getOpenJobs(),
        wagApi.partner.getMyJobs(),
      ]);
      setOpenJobs((open as PartnerJobCard[]).filter((j) => j.type === (mode === 'grooming' ? 'grooming' : 'walking')));
      setMyJobs((mine as PartnerJobCard[]).filter((j) => j.type === (mode === 'grooming' ? 'grooming' : 'walking')));
    } catch {}
  }, [mode]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleToggleOnline = async () => {
    setTogglingOnline(true);
    try {
      await wagApi.partner.setOnline(!isOnline);
      setOnline(!isOnline);
    } catch {
      Alert.alert('Error', 'Could not update status. Check your connection.');
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleClaim = async (bookingId: string) => {
    setClaimingId(bookingId);
    try {
      await wagApi.partner.claimJob(bookingId);
      await load();
    } catch (err: any) {
      Alert.alert('Could not claim', err?.message ?? 'Job may have been taken.');
    } finally {
      setClaimingId(null);
    }
  };

  const todayEarnings = myJobs
    .filter((j) => j.status === 'completed')
    .reduce((s, j) => s + j.partnerPayout, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBrown} />}
        contentContainerStyle={styles.scrollContent}
      >
            <View style={styles.pagehead}>
              <View style={styles.headRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Partner</Text>
                  <Text style={styles.title}>{mode === 'grooming' ? 'Jobs' : 'Walks'}</Text>
                </View>
              </View>
            </View>

            {/* role switch — mirrors the prototype's .rolebar */}
            <View style={styles.pad}>
              <View style={styles.rolebar}>
                {(['grooming', 'walking'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.roleBtn, mode === m && styles.roleBtnActive]}
                    onPress={() => setMode(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: mode === m }}
                  >
                    <Text style={[styles.roleBtnText, mode === m && styles.roleBtnTextActive]}>
                      {m === 'grooming' ? '✂️  Grooming' : '🐾  Walking'}
                    </Text>
                    {m === 'grooming' && openJobs.length > 0 && mode === 'grooming' && (
                      <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{openJobs.length}</Text></View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* availability bar */}
              <TouchableOpacity
                style={[styles.availbar, isOnline && styles.availbarOn]}
                onPress={handleToggleOnline}
                disabled={togglingOnline}
                accessibilityRole="switch"
                accessibilityState={{ checked: isOnline }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.availTitle, isOnline && styles.availTitleOn]}>{isOnline ? 'Online' : 'Offline'}</Text>
                  <Text style={[styles.availSub, isOnline && styles.availSubOn]}>
                    {isOnline ? `Taking new jobs · ${mode === 'grooming' ? 'grooming' : 'walking'}` : 'You will not see new jobs'}
                  </Text>
                </View>
                <View style={[styles.switchTrack, isOnline && styles.switchTrackOn]}>
                  <View style={[styles.switchThumb, isOnline && styles.switchThumbOn]} />
                </View>
              </TouchableOpacity>

              {/* metrics row */}
              <View style={styles.metrics}>
                <Metric v={`₹${todayEarnings}`} k="Today" />
                <Metric v={String(myJobs.length)} k="Jobs left" />
                <Metric v="4.8" k="Rating" />
              </View>

              {/* Open jobs */}
              <SectionHead
                title="Open jobs"
                sub={isOnline ? `${openJobs.length} near you right now` : 'Paused while you are offline'}
              />
              {!isOnline ? (
                <Empty icon="💼" title="You are offline" sub="Go online to see jobs near you." />
              ) : openJobs.length === 0 ? (
                <Empty icon="💼" title="No open jobs right now" sub="New jobs appear here the moment a customer books." />
              ) : (
                openJobs.map((job) => (
                  <OpenJobCard
                    key={job.bookingId}
                    job={job}
                    claiming={claimingId === job.bookingId}
                    onClaim={() => handleClaim(job.bookingId)}
                  />
                ))
              )}

              {/* Today's schedule */}
              <SectionHead title="Today's schedule" sub={`${myJobs.length} assigned`} />
              {myJobs.length === 0 ? (
                <Empty icon="📅" title="Nothing scheduled today" sub="Claim an open job to fill your day." />
              ) : (
                myJobs.map((job) => <AssignedJobCard key={job.bookingId} job={job} />)
              )}
            </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ v, k }: { v: string; k: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricV}>{v}</Text>
      <Text style={styles.metricK}>{k}</Text>
    </View>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{sub}</Text>
    </View>
  );
}

function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyArt}><Text style={{ fontSize: 26 }}>{icon}</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

function OpenJobCard({ job, claiming, onClaim }: { job: PartnerJobCard; claiming: boolean; onClaim: () => void }) {
  return (
    <View style={styles.jobcard}>
      <View style={styles.jobcardTop}>
        <PetAvatar name={job.petName} size={50} ringState="idle" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.jobcardTitleRow}>
            <Text style={styles.jobcardName} numberOfLines={1}>{job.packageName ?? job.petBreed}</Text>
            <Text style={styles.jobcardPayout}>₹{job.partnerPayout}</Text>
          </View>
          <Text style={styles.jobcardMeta} numberOfLines={1}>{job.petName} · {job.petBreed} · {job.petSize}{job.petWeightKg ? `, ${job.petWeightKg}kg` : ''}</Text>
          <View style={styles.pillRow}>
            {job.scheduledAt && <Pill label={new Date(job.scheduledAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} />}
            <Pill label={`${job.distanceKm.toFixed(1)} km`} />
            {job.durationMinutes ? <Pill label={`${job.durationMinutes} min`} /> : null}
            {job.addOns && job.addOns.length > 0 && <Pill label={`+${job.addOns.length} add-on`} accent />}
          </View>
        </View>
      </View>
      <View style={styles.jobcardFooter}>
        <Text style={styles.jobcardDim}>{job.addressLine}</Text>
        <View style={styles.jobcardActions}>
          <Button size="xs" variant="outline" onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.bookingId } })}>
            Details
          </Button>
          <Button size="xs" variant="primary" loading={claiming} onPress={onClaim}>
            Claim job
          </Button>
        </View>
      </View>
    </View>
  );
}

function AssignedJobCard({ job }: { job: PartnerJobCard }) {
  return (
    <TouchableOpacity
      style={styles.jobcard}
      onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.bookingId } })}
    >
      <View style={styles.jobcardTop}>
        <PetAvatar name={job.petName} size={48} ringState={job.status === 'in_progress' ? 'active' : 'idle'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.jobcardTitleRow}>
            <Text style={styles.jobcardName} numberOfLines={1}>{job.packageName ?? `${job.durationMinutes ?? ''} min walk`}</Text>
            <Text style={styles.jobcardPayout}>₹{job.partnerPayout}</Text>
          </View>
          <Text style={styles.jobcardMeta} numberOfLines={1}>{job.petName} · {job.petBreed} · {job.customerName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function Pill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View style={[styles.pill, accent && styles.pillAccent]}>
      <Text style={[styles.pillText, accent && styles.pillTextAccent]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingBottom: spacing[10] },
  pad: { paddingHorizontal: spacing[5] },
  pagehead: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[3] },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  eyebrow: { fontFamily: 'Inter', fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted },
  title: { fontFamily: 'Inter', fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginTop: 2, letterSpacing: -0.5 },

  rolebar: { flexDirection: 'row', gap: spacing[2], backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: 5, marginBottom: spacing[4] },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1], paddingVertical: 11, borderRadius: radii.sm },
  roleBtnActive: { backgroundColor: colors.brandBrown },
  roleBtnText: { fontFamily: 'Inter', fontSize: 13.5, fontWeight: '600', color: colors.textMuted },
  roleBtnTextActive: { color: colors.white },
  roleBadge: { backgroundColor: colors.marigoldMid, borderRadius: 999, minWidth: 19, height: 19, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  roleBadgeText: { color: colors.white, fontSize: 10.5, fontWeight: '800' },

  availbar: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderRadius: radii.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[4] },
  availbarOn: { backgroundColor: colors.brandBrown, borderColor: 'transparent' },
  availTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.2 },
  availTitleOn: { color: colors.white },
  availSub: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  availSubOn: { color: 'rgba(255,255,255,0.7)' },
  switchTrack: { width: 46, height: 27, borderRadius: 999, backgroundColor: colors.borderMedium, padding: 3, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: colors.success },
  switchThumb: { width: 21, height: 21, borderRadius: 999, backgroundColor: colors.white },
  switchThumbOn: { transform: [{ translateX: 19 }] },

  metrics: { flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radii.lg, overflow: 'hidden', marginBottom: spacing[5] },
  metric: { flex: 1, backgroundColor: colors.white, paddingVertical: spacing[3], alignItems: 'center', gap: 3 },
  metricV: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  metricK: { fontFamily: 'Inter', fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textMuted },

  sectionHead: { marginBottom: spacing[3], marginTop: spacing[2] },
  sectionTitle: { fontFamily: 'Inter', fontSize: 17, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.25 },
  sectionSub: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: spacing[8] },
  emptyArt: { width: 60, height: 60, borderRadius: 999, backgroundColor: colors.biscuitLighter, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] },
  emptyTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted, marginTop: 4, textAlign: 'center' },

  jobcard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.lg, padding: spacing[4], marginBottom: spacing[3] },
  jobcardTop: { flexDirection: 'row', gap: spacing[3] },
  jobcardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  jobcardName: { flex: 1, fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  jobcardPayout: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.marigoldDark },
  jobcardMeta: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  pill: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillAccent: { backgroundColor: colors.marigoldBg },
  pillText: { fontFamily: 'Inter', fontSize: 11, fontWeight: '600', color: colors.textMuted },
  pillTextAccent: { color: colors.marigoldDark },
  jobcardFooter: { marginTop: spacing[3], gap: spacing[2] },
  jobcardDim: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted },
  jobcardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
});
