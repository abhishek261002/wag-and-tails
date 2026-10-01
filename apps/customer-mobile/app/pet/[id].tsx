import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Linking, Image, Modal, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { formatPetAge, speciesSupportsService, type PetDetail } from '@wag/shared-types';
import type { GroomingHistoryEntry } from '@wag/api-client';
import { Icon, PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';
import { goBack } from '../../src/lib/nav';

const cap = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—');
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'd MMM yyyy') : '—');

/**
 * A pet's page, per the prototype: who they are, quick actions (groom, walk, ask), care notes, health, about,
 * vet, and the grooming history with the before and after photos the partner took at each visit.
 */
export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.userId);
  const [pet, setPet] = useState<PetDetail | null>(null);
  const [history, setHistory] = useState<GroomingHistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewer, setViewer] = useState<{ uri: string; label: string } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, h] = await Promise.all([wagApi.pets.get(id), wagApi.pets.groomingHistory(id).catch(() => [])]);
      setPet(p);
      setHistory(h);
      setError(false);
    } catch {
      setError(true);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!pet) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.appbar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/(tabs)/pets')} accessibilityLabel="Go back"><Icon name="back" size={18} color={colors.textPrimary} /></TouchableOpacity>
        </View>
        {error
          ? <TouchableOpacity onPress={load}><Text style={styles.error}>Could not load this pet. Tap to try again.</Text></TouchableOpacity>
          : <ActivityIndicator style={{ marginTop: spacing[10] }} color={colors.brandBrown} />}
      </SafeAreaView>
    );
  }

  const age = formatPetAge(pet.dateOfBirth);
  const canWalk = speciesSupportsService(pet.species, 'walking');
  const vac = pet.vaccination;
  const vacOk = vac?.state === 'up_to_date';
  const hasVet = !!(pet.vetDoctorName || pet.vetClinic);

  const startGroom = () => router.push({ pathname: '/booking/grooming/select-pet', params: { petId: pet.id } });
  const startWalk = () => router.push({ pathname: '/booking/walking/select-dog', params: { petId: pet.id } });

  const confirmRemove = () => {
    Alert.alert(`Remove ${pet.name}?`, 'This removes the pet from your family. Past bookings stay in your history.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try { await wagApi.pets.delete(pet.id); router.replace('/(tabs)/pets' as any); }
          catch (err: any) { Alert.alert('Could not remove', err?.message ?? 'Please try again.'); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/(tabs)/pets')} accessibilityLabel="Go back"><Icon name="back" size={18} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.appbarTitle} numberOfLines={1}>{pet.name}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push({ pathname: '/pet/edit', params: { id: pet.id } })} accessibilityLabel="Edit pet"><Icon name="edit" size={18} color={colors.textPrimary} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.marigold} />}>
        {/* Hero */}
        <View style={styles.hero}>
          <PetAvatar name={pet.name} imageUrl={resolveMediaUrl(pet.avatarUrl)} size={112} ringState="idle" />
          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petMeta}>{[pet.breed, age, cap(pet.sex), pet.weightKg ? `${pet.weightKg} kg` : null].filter(Boolean).join(' · ')}</Text>
        </View>

        {/* What do you want to do */}
        <View style={styles.actions}>
          <ActionBtn icon="scissors" label="Groom" onPress={startGroom} />
          {canWalk && <ActionBtn icon="route" label="Walk" onPress={startWalk} />}
          <ActionBtn icon="spark" label="Ask" onPress={() => router.push({ pathname: '/chat/[petId]', params: { petId: pet.id } })} />
        </View>

        {/* Care notes */}
        <SectionHead title="Care notes" sub="Shown to every groomer and walker" action="Add" onAction={() => router.push({ pathname: '/pet/add-note', params: { id: pet.id } })} />
        {pet.careNotes.length === 0 ? (
          <View style={styles.card}><Text style={styles.muted}>No notes yet. Add anything a groomer or walker should know.</Text></View>
        ) : (
          <View style={styles.card}>
            {pet.careNotes.map((n, i) => {
              const mine = n.addedBy === userId;
              return (
                <View key={n.id} style={[styles.noteRow, i > 0 && styles.noteRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noteText}>{n.note}</Text>
                    <Text style={styles.noteBy}>{mine ? 'You' : n.addedByRole === 'partner' ? 'Your groomer / walker' : 'Wag & Tails'} · {fmtDate(n.createdAt)}</Text>
                  </View>
                  {mine && (
                    <TouchableOpacity onPress={() => router.push({ pathname: '/pet/add-note', params: { id: pet.id, noteId: n.id } })} style={styles.smallIcon} accessibilityLabel="Edit note">
                      <Icon name="edit" size={15} color={colors.textPrimary} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Health */}
        <SectionHead title="Health" action="Records" onAction={() => router.push({ pathname: '/pet/vaccines', params: { id: pet.id } })} />
        <TouchableOpacity style={styles.healthCard} onPress={() => router.push({ pathname: '/pet/vaccines', params: { id: pet.id } })} activeOpacity={0.85} accessibilityRole="button">
          <View style={[styles.healthIcon, vacOk ? styles.healthOk : styles.healthWarn]}><Icon name="syringe" size={19} color={vacOk ? colors.success : colors.marigoldDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.healthTitle}>{vacOk ? 'Vaccinations up to date' : vac?.state === 'due_soon' ? 'Booster due soon' : vac?.state === 'overdue' ? 'Vaccination overdue' : vac?.state === 'not_vaccinated_yet' ? 'Not vaccinated yet' : 'No vaccine records yet'}</Text>
            <Text style={styles.muted}>{vac?.nextDueDate ? `Next due ${fmtDate(vac.nextDueDate)}${vac.nextDueVaccine ? ` · ${vac.nextDueVaccine}` : ''}` : 'Tap to add a record'}</Text>
          </View>
          <Icon name="chev" size={17} color={colors.textDisabled} />
        </TouchableOpacity>

        {/* About */}
        <SectionHead title={`About ${pet.name}`} />
        <View style={styles.rows}>
          <Row label="Coat" value={cap(pet.coatType)} />
          <Row label="Size" value={`${cap(pet.size)}${pet.weightKg ? ` · ${pet.weightKg} kg` : ''}`} />
          <Row label="Date of birth" value={fmtDate(pet.dateOfBirth)} />
          <Row label="Neutered" value={pet.isNeutered ? 'Yes' : 'No'} />
          <Row label="Allergies" value={pet.allergies || 'None known'} />
          <Row label="Microchip" value={(pet as any).microchip || '—'} last />
        </View>
        <View style={[styles.card, { marginTop: spacing[3] }]}>
          <Text style={styles.eyebrow}>Temperament</Text>
          <Text style={styles.body}>{pet.temperament || 'Not specified yet. You can add this by editing the pet.'}</Text>
        </View>
        <View style={[styles.vetCard, { marginTop: spacing[3] }]}>
          <View style={styles.vetIcon}><Icon name="heart" size={17} color={colors.error} /></View>
          <View style={{ flex: 1 }}>
            {hasVet ? (
              <>
                <Text style={styles.vetName}>{pet.vetDoctorName || 'Your vet'}</Text>
                {!!pet.vetClinic && <Text style={styles.vetClinic}>{pet.vetClinic}</Text>}
              </>
            ) : (
              <TouchableOpacity onPress={() => router.push({ pathname: '/pet/edit', params: { id: pet.id } })}>
                <Text style={styles.vetName}>Add your vet's details</Text>
                <Text style={styles.vetClinic}>Useful in an emergency</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!pet.vetPhone && (
            <TouchableOpacity style={styles.smallIcon} onPress={() => Linking.openURL(`tel:${pet.vetPhone}`).catch(() => Alert.alert('Could not open the dialer', pet.vetPhone ?? ''))} accessibilityLabel="Call the vet">
              <Icon name="phone" size={15} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Grooming history */}
        <SectionHead title="Grooming history" sub={history === null ? '' : `${history.length} visit${history.length === 1 ? '' : 's'}`} />
        {history === null ? (
          <ActivityIndicator color={colors.brandBrown} />
        ) : history.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center', gap: spacing[2] }]}>
            <Text style={styles.healthTitle}>No visits yet</Text>
            <Text style={styles.muted}>Book {pet.name}'s first groom.</Text>
            <TouchableOpacity style={styles.bookBtn} onPress={startGroom}><Text style={styles.bookBtnText}>Book grooming</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.timeline}>
            {history.map((h, i) => (
              <View key={h.id} style={styles.tItem}>
                <View style={[styles.tDot, i === 0 && styles.tDotNow]} />
                <TouchableOpacity onPress={() => router.push({ pathname: '/booking/[id]', params: { id: h.id } })} activeOpacity={0.8}>
                  <View style={styles.tHead}>
                    <Text style={styles.tTitle}>{h.packageName}</Text>
                    <Text style={styles.muted}>{fmtDate(h.date)}</Text>
                  </View>
                  <View style={styles.tSub}>
                    <Text style={styles.muted}>{h.partnerName ?? 'Groomer'}</Text>
                    {h.rating != null && <Stars value={h.rating} />}
                  </View>
                </TouchableOpacity>
                <View style={styles.ba}>
                  <PhotoSlot uri={h.beforePhotos[0]} tag="BEFORE" onOpen={setViewer} />
                  <PhotoSlot uri={h.afterPhotos[0]} tag="AFTER" onOpen={setViewer} />
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.removeBtn} onPress={confirmRemove} accessibilityRole="button">
          <Icon name="trash" size={16} color={colors.error} />
          <Text style={styles.removeText}>Remove {pet.name}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Full-size photo */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer.uri }} style={styles.viewerImg} resizeMode="contain" />}
          {viewer && <Text style={styles.viewerLabel}>{viewer.label}</Text>}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function ActionBtn({ icon, label, onPress }: { icon: 'scissors' | 'route' | 'spark'; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} activeOpacity={0.85}>
      <Icon name={icon} size={16} color={colors.brandBrown} />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionHead({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!sub && <Text style={styles.muted}>{sub}</Text>}
      </View>
      {!!action && <TouchableOpacity onPress={onAction} accessibilityRole="button"><Text style={styles.link}>{action}</Text></TouchableOpacity>}
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" size={11} color={n <= value ? colors.marigold : colors.borderMedium} />)}
    </View>
  );
}

function PhotoSlot({ uri, tag, onOpen }: { uri?: string; tag: 'BEFORE' | 'AFTER'; onOpen: (v: { uri: string; label: string }) => void }) {
  const full = uri ? resolveMediaUrl(uri) : undefined;
  return (
    <TouchableOpacity style={styles.slot} disabled={!full} onPress={() => full && onOpen({ uri: full, label: tag })} activeOpacity={0.85} accessibilityLabel={full ? `${tag} photo` : `${tag}: no photo`}>
      {full ? <Image source={{ uri: full }} style={styles.slotImg} resizeMode="cover" /> : <Text style={styles.slotEmpty}>No photo</Text>}
      <View style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  appbar: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[2] },
  appbarTitle: { flex: 1, textAlign: 'center', fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: 'Inter', fontSize: 14, color: colors.error, textAlign: 'center', marginTop: spacing[8] },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },

  hero: { alignItems: 'center', paddingTop: spacing[3], paddingBottom: spacing[5] },
  petName: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 28, color: colors.textPrimary, marginTop: spacing[4] },
  petMeta: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: 'center' },

  actions: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radii.lg, backgroundColor: colors.biscuitLight },
  actionText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.brandBrown },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing[6], marginBottom: spacing[3] },
  sectionTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  link: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.marigoldDark },
  muted: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  body: { fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  eyebrow: { fontFamily: 'Inter', fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted, marginBottom: spacing[2] },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing[4] },

  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingVertical: spacing[2] },
  noteRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  noteText: { fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  noteBy: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
  smallIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },

  healthCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing[4] },
  healthIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  healthOk: { backgroundColor: colors.successLight },
  healthWarn: { backgroundColor: colors.marigoldBg },
  healthTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },

  rows: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing[4] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[3], gap: spacing[4] },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter', fontSize: 14, color: colors.textSecondary },

  vetCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing[3] },
  vetIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' },
  vetName: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  vetClinic: { fontFamily: 'Inter', fontSize: 12.5, color: colors.marigoldDark, marginTop: 2 },

  timeline: { borderLeftWidth: 2, borderLeftColor: colors.borderMedium, marginLeft: 5, paddingLeft: spacing[5], gap: spacing[5] },
  tItem: { position: 'relative' },
  tDot: { position: 'absolute', left: -spacing[5] - 7, top: 5, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.borderMedium },
  tDotNow: { backgroundColor: colors.marigold },
  tHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  tSub: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 2 },
  ba: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  slot: { flex: 1, height: 104, borderRadius: radii.lg, backgroundColor: colors.biscuitLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  slotImg: { width: '100%', height: '100%' },
  slotEmpty: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted },
  tag: { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(30,20,12,0.62)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { fontFamily: 'Inter', fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: colors.white },

  bookBtn: { marginTop: spacing[2], backgroundColor: colors.brandBrown, borderRadius: radii.lg, paddingHorizontal: spacing[5], height: 42, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.white },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], height: 48, borderRadius: radii.lg, backgroundColor: '#FDECEC', marginTop: spacing[8] },
  removeText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.error },

  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '80%' },
  viewerLabel: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.white, marginTop: spacing[3] },
});
