import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { CORE_VACCINES_BY_SPECIES, summarizeVaccinations, type PetDetail } from '@wag/shared-types';
import { BottomSheet, Button, DateField, Icon, Input } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

const fmt = (d: string | null | undefined) => (d ? format(new Date(d), 'd MMM yyyy') : '—');
const today = () => format(new Date(), 'yyyy-MM-dd');

/** A pet's vaccination records (from the prototype's Vaccinations screen), with a sheet to add a new one. */
export default function VaccinesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pet, setPet] = useState<PetDetail | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [custom, setCustom] = useState('');
  const [given, setGiven] = useState('');
  const [expiry, setExpiry] = useState('');
  const [vet, setVet] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try { setPet(await wagApi.pets.get(id)); setError(false); } catch { setError(true); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const reset = () => { setName(''); setCustom(''); setGiven(''); setExpiry(''); setVet(''); setFormError(''); };

  const finalName = name === 'Other' ? custom.trim() : name;
  const valid = finalName.length >= 2 && !!given && (!expiry || expiry >= given);

  const save = async () => {
    if (!pet || !valid || saving) return;
    if (given > today()) { setFormError('The vaccination date cannot be in the future.'); return; }
    setSaving(true);
    setFormError('');
    try {
      await wagApi.pets.addVaccination(pet.id, {
        vaccineName: finalName, administeredDate: given, expiryDate: expiry || null, vetName: vet.trim() || null, certificateUrl: null,
      });
      setOpen(false);
      reset();
      await load();
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not save this record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeVaccine = (v: { id: string; vaccineName: string }) => {
    Alert.alert('Delete this vaccination record?', v.vaccineName, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await wagApi.pets.deleteVaccination(pet!.id, v.id); await load(); }
          catch (err: any) { Alert.alert('Could not delete', err?.message ?? 'Please try again.'); }
        },
      },
    ]);
  };

  const records = pet?.vaccinations ?? [];
  const summary = pet ? summarizeVaccinations(records, pet.vaccinationStatus) : null;
  const options = pet ? [...(CORE_VACCINES_BY_SPECIES[pet.species] ?? []), 'Other'] : [];
  const now = Date.now();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack()} accessibilityLabel="Go back"><Icon name="back" size={18} color={colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Vaccinations</Text>
          {!!pet && <Text style={styles.sub}>{pet.name}</Text>}
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => { reset(); setOpen(true); }} accessibilityLabel="Add a record" disabled={!pet}><Icon name="plus" size={18} color={colors.textPrimary} /></TouchableOpacity>
      </View>

      {!pet ? (
        error ? <TouchableOpacity onPress={load}><Text style={styles.error}>Could not load. Tap to try again.</Text></TouchableOpacity>
              : <ActivityIndicator style={{ marginTop: spacing[10] }} color={colors.brandBrown} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.marigold} />} showsVerticalScrollIndicator={false}>
          {summary && (summary.state === 'overdue' || summary.state === 'due_soon') && (
            <View style={styles.banner}>
              <Icon name="alert" size={18} color={colors.marigoldDark} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>{summary.state === 'overdue' ? 'Some boosters are overdue' : 'A booster is due soon'}</Text>
                <Text style={styles.bannerBody}>Book a vet visit, then add the new record here.</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.medLink} onPress={() => router.push({ pathname: '/pet/medical', params: { id: pet.id, name: pet.name } })} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.medLinkTitle}>Medical history</Text>
              <Text style={styles.medLinkSub}>Check-ups, illnesses, surgeries, medication and allergies{pet.medicalRecords?.length ? ` · ${pet.medicalRecords.length} saved` : ''}</Text>
            </View>
            <Icon name="chev" size={16} color={colors.textDisabled} />
          </TouchableOpacity>

          {records.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No vaccination records yet</Text>
              <Text style={styles.emptyBody}>Add {pet.name}'s vaccinations so groomers and walkers know they are protected.</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => { reset(); setOpen(true); }}><Text style={styles.addBtnText}>Add a record</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rows}>
              {records.map((v, i) => {
                const due = v.expiryDate ? new Date(v.expiryDate).getTime() : null;
                const expired = due !== null && due < now;
                return (
                  <TouchableOpacity key={v.id} activeOpacity={0.8} onLongPress={() => removeVaccine(v)} style={[styles.row, i < records.length - 1 && styles.rowBorder]} accessibilityHint="Long press to delete">
                    <View style={[styles.rowIcon, expired ? styles.rowWarn : styles.rowOk]}><Icon name="syringe" size={17} color={expired ? colors.marigoldDark : colors.success} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{v.vaccineName}</Text>
                      <Text style={styles.rowSub}>Given {fmt(v.administeredDate)}{v.expiryDate ? ` · ${expired ? 'Expired' : 'Next due'} ${fmt(v.expiryDate)}` : ''}</Text>
                      {!!v.vetName && <Text style={styles.rowSub}>{v.vetName}</Text>}
                    </View>
                    <View style={[styles.chip, expired ? styles.chipWarn : styles.chipOk]}><Text style={[styles.chipText, expired ? styles.chipTextWarn : styles.chipTextOk]}>{expired ? 'Expired' : 'Valid'}</Text></View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <BottomSheet visible={open} onDismiss={() => setOpen(false)} snapPoints="90%">
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetTitle}>Add a vaccination</Text>

          <Text style={styles.label}>Vaccine</Text>
          <View style={styles.chips}>
            {options.map((o) => (
              <TouchableOpacity key={o} style={[styles.pick, name === o && styles.pickOn]} onPress={() => setName(o)} accessibilityRole="radio" accessibilityState={{ selected: name === o }}>
                <Text style={[styles.pickText, name === o && styles.pickTextOn]}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {name === 'Other' && (
            <View style={{ marginTop: spacing[3] }}>
              <Input value={custom} onChangeText={setCustom} placeholder="Vaccine name" maxLength={100} />
            </View>
          )}

          <Text style={[styles.label, { marginTop: spacing[4] }]}>Date given</Text>
          <DateField value={given} onChange={(v) => { setGiven(v); setFormError(''); }} maxDate={today()} minYear={new Date().getFullYear() - 25} placeholder="Select the date" />

          <Text style={[styles.label, { marginTop: spacing[4] }]}>Next due (optional)</Text>
          <DateField value={expiry} onChange={setExpiry} maxDate={format(new Date(Date.now() + 6 * 365 * 86400000), 'yyyy-MM-dd')} minYear={new Date().getFullYear() - 1} placeholder="Defaults to one year later" error={expiry && given && expiry < given ? 'Cannot be before the date given' : undefined} />

          <View style={{ marginTop: spacing[4] }}>
            <Input label="Vet (optional)" value={vet} onChangeText={setVet} placeholder="Doctor or clinic" maxLength={100} />
          </View>

          {!!formError && <Text style={styles.formError}>{formError}</Text>}
          <Button onPress={save} loading={saving} disabled={!valid} fullWidth style={{ marginTop: spacing[5] }}>Save record</Button>
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  appbar: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3] },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  sub: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted },
  error: { fontFamily: 'Inter', fontSize: 14, color: colors.error, textAlign: 'center', marginTop: spacing[8] },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[10], gap: spacing[4] },

  banner: { flexDirection: 'row', gap: spacing[3], backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4] },
  bannerTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.marigoldDark },
  bannerBody: { fontFamily: 'Inter', fontSize: 13, color: colors.marigoldDark, marginTop: 2 },

  medLink: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing[4] },
  medLinkTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  medLinkSub: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', gap: spacing[2], marginTop: spacing[8], paddingHorizontal: spacing[4] },
  emptyTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptyBody: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  addBtn: { marginTop: spacing[3], backgroundColor: colors.brandBrown, borderRadius: radii.lg, height: 44, paddingHorizontal: spacing[6], alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.white },

  rows: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowOk: { backgroundColor: colors.successLight },
  rowWarn: { backgroundColor: colors.marigoldBg },
  rowTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  rowSub: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipOk: { backgroundColor: colors.successLight },
  chipWarn: { backgroundColor: colors.marigoldBg },
  chipText: { fontFamily: 'Inter', fontSize: 11.5, fontWeight: '800' },
  chipTextOk: { color: colors.success },
  chipTextWarn: { color: colors.marigoldDark },

  sheet: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  sheetTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[4] },
  label: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pick: { borderRadius: 999, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  pickOn: { borderColor: colors.brandBrown, backgroundColor: colors.brandBrown },
  pickText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pickTextOn: { color: colors.white },
  formError: { fontFamily: 'Inter', fontSize: 13, color: colors.error, marginTop: spacing[3] },
});
