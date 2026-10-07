import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { MEDICAL_RECORD_LABEL, MEDICAL_RECORD_TYPES, MAX_FOLLOW_UP_YEARS, type MedicalRecordType, type PetMedicalRecord } from '@wag/shared-types';
import { BottomSheet, Button, DateField, Icon, Input } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

const fmt = (d: string | null | undefined) => (d ? format(new Date(d), 'd MMM yyyy') : '—');
const today = () => format(new Date(), 'yyyy-MM-dd');
const ymd = (d: string) => d.slice(0, 10);

/** A pet's medical history (check-ups, illnesses, surgeries, medication, allergies). Follow-up dates drive check-up reminders. */
export default function MedicalHistoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [records, setRecords] = useState<PetMedicalRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PetMedicalRecord | null>(null);
  const [type, setType] = useState<MedicalRecordType>('checkup');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [vet, setVet] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try { setRecords(await wagApi.pets.listMedicalRecords(id)); setError(false); } catch { setError(true); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openForm = (r: PetMedicalRecord | null) => {
    setEditing(r);
    setType(r?.type ?? 'checkup');
    setTitle(r?.title ?? '');
    setDate(r ? ymd(r.recordDate) : '');
    setFollowUp(r?.followUpDate ? ymd(r.followUpDate) : '');
    setVet(r?.vetName ?? '');
    setNotes(r?.notes ?? '');
    setFormError('');
    setOpen(true);
  };

  const valid = title.trim().length >= 2 && !!date && (!followUp || followUp >= date);

  const save = async () => {
    if (!id || !valid || saving) return;
    if (date > today()) { setFormError('The date cannot be in the future.'); return; }
    setSaving(true);
    setFormError('');
    const body = { type, title: title.trim(), recordDate: date, followUpDate: followUp || null, vetName: vet.trim() || null, notes: notes.trim() || null };
    try {
      if (editing) await wagApi.pets.updateMedicalRecord(id, editing.id, body);
      else await wagApi.pets.addMedicalRecord(id, body);
      setOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not save this record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (r: PetMedicalRecord) => {
    Alert.alert('Delete this record?', r.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await wagApi.pets.deleteMedicalRecord(id!, r.id); setOpen(false); await load(); }
          catch (err: any) { Alert.alert('Could not delete', err?.message ?? 'Please try again.'); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack()} accessibilityLabel="Go back"><Icon name="back" size={18} color={colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Medical history</Text>
          {!!name && <Text style={styles.sub}>{name}</Text>}
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => openForm(null)} accessibilityLabel="Add a record" disabled={!records}><Icon name="plus" size={18} color={colors.textPrimary} /></TouchableOpacity>
      </View>

      {!records ? (
        error ? <TouchableOpacity onPress={load}><Text style={styles.error}>Could not load. Tap to try again.</Text></TouchableOpacity>
              : <ActivityIndicator style={{ marginTop: spacing[10] }} color={colors.brandBrown} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.marigold} />} showsVerticalScrollIndicator={false}>
          <View style={styles.note}>
            <Icon name="bell" size={16} color={colors.marigoldDark} />
            <Text style={styles.noteText}>Add a follow-up date to a record and we'll remind you before the next check-up.</Text>
          </View>
          {records.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No medical history yet</Text>
              <Text style={styles.emptyBody}>Add check-ups, illnesses, surgeries, medication and allergies to keep everything in one place.</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => openForm(null)}><Text style={styles.addBtnText}>Add a record</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rows}>
              {records.map((r, i) => (
                <TouchableOpacity key={r.id} style={[styles.row, i < records.length - 1 && styles.rowBorder]} onPress={() => openForm(r)} accessibilityRole="button" accessibilityLabel={`${MEDICAL_RECORD_LABEL[r.type]}: ${r.title}. Edit`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowType}>{MEDICAL_RECORD_LABEL[r.type]} · {fmt(r.recordDate)}</Text>
                    <Text style={styles.rowTitle}>{r.title}</Text>
                    {!!r.vetName && <Text style={styles.rowSub}>{r.vetName}</Text>}
                    {!!r.notes && <Text style={styles.rowSub} numberOfLines={2}>{r.notes}</Text>}
                    {!!r.followUpDate && <Text style={styles.rowFollow}>Follow-up {fmt(r.followUpDate)}</Text>}
                  </View>
                  <Icon name="chev" size={16} color={colors.textDisabled} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <BottomSheet visible={open} onDismiss={() => setOpen(false)} snapPoints="90%">
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetTitle}>{editing ? 'Edit record' : 'Add a record'}</Text>

          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {MEDICAL_RECORD_TYPES.map((t) => (
              <TouchableOpacity key={t} style={[styles.pick, type === t && styles.pickOn]} onPress={() => setType(t)} accessibilityRole="radio" accessibilityState={{ selected: type === t }}>
                <Text style={[styles.pickText, type === t && styles.pickTextOn]}>{MEDICAL_RECORD_LABEL[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: spacing[4] }}>
            <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Annual check-up, Skin allergy" maxLength={120} />
          </View>

          <Text style={[styles.label, { marginTop: spacing[4] }]}>Date</Text>
          <DateField value={date} onChange={(v) => { setDate(v); setFormError(''); }} maxDate={today()} minYear={new Date().getFullYear() - 25} placeholder="Select the date" />

          <Text style={[styles.label, { marginTop: spacing[4] }]}>Follow-up / next check-up (optional)</Text>
          <DateField value={followUp} onChange={setFollowUp} maxDate={format(new Date(Date.now() + MAX_FOLLOW_UP_YEARS * 365 * 86400000), 'yyyy-MM-dd')} minYear={new Date().getFullYear()} placeholder="Select the date" error={followUp && date && followUp < date ? 'Cannot be before the record date' : undefined} />

          <View style={{ marginTop: spacing[4] }}>
            <Input label="Vet (optional)" value={vet} onChangeText={setVet} placeholder="Doctor or clinic" maxLength={100} />
          </View>
          <View style={{ marginTop: spacing[4] }}>
            <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Diagnosis, medicines, instructions" maxLength={1000} multiline />
          </View>

          {!!formError && <Text style={styles.formError}>{formError}</Text>}
          <Button onPress={save} loading={saving} disabled={!valid} fullWidth style={{ marginTop: spacing[5] }}>{editing ? 'Save changes' : 'Save record'}</Button>
          {!!editing && (
            <TouchableOpacity onPress={() => remove(editing)} style={styles.delete} accessibilityRole="button"><Text style={styles.deleteText}>Delete record</Text></TouchableOpacity>
          )}
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
  note: { flexDirection: 'row', gap: spacing[3], alignItems: 'center', backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4] },
  noteText: { flex: 1, fontFamily: 'Inter', fontSize: 13, color: colors.marigoldDark },
  empty: { alignItems: 'center', gap: spacing[2], marginTop: spacing[6], paddingHorizontal: spacing[4] },
  emptyTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptyBody: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  addBtn: { marginTop: spacing[3], backgroundColor: colors.brandBrown, borderRadius: radii.lg, height: 44, paddingHorizontal: spacing[6], alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.white },
  rows: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowType: { fontFamily: 'Inter', fontSize: 11.5, fontWeight: '700', color: colors.textMuted },
  rowTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  rowSub: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  rowFollow: { fontFamily: 'Inter', fontSize: 12.5, fontWeight: '700', color: colors.marigoldDark, marginTop: 4 },
  sheet: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  sheetTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[4] },
  label: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pick: { borderRadius: 999, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  pickOn: { borderColor: colors.brandBrown, backgroundColor: colors.brandBrown },
  pickText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pickTextOn: { color: colors.white },
  formError: { fontFamily: 'Inter', fontSize: 13, color: colors.error, marginTop: spacing[3] },
  delete: { alignItems: 'center', paddingVertical: spacing[4] },
  deleteText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.error },
});
