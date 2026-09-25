import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, BottomSheet, DateField, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { BREEDS_BY_SPECIES, CORE_VACCINES_BY_SPECIES, DEFAULT_VACCINE_BY_SPECIES, SPECIES_LABEL } from '@wag/shared-types';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function EditPetScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const [pet, setPet] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [breedOpen, setBreedOpen] = useState(false);
  const [breedSearch, setBreedSearch] = useState('');
  const [vaccDate, setVaccDate] = useState('');
  const [vaccName, setVaccName] = useState('');
  const [notVaccinated, setNotVaccinated] = useState(false);
  const [vaccError, setVaccError] = useState('');

  useEffect(() => {
    if (petId) wagApi.pets.get(petId).then(setPet).catch(() => {});
  }, [petId]);

  // Pets added before the vaccination question became mandatory must answer it the next time they're edited.
  const needsVaccination = pet?.vaccinationStatus === 'unknown';

  const save = async () => {
    if (!pet || !petId) return;
    if (needsVaccination && !vaccDate && !notVaccinated) {
      setVaccError('Tell us when the last vaccination was');
      return;
    }
    setSaving(true);
    try {
      await wagApi.pets.update(petId, {
        name: pet.name,
        breed: pet.breed,
        weightKg: pet.weightKg ? Number(pet.weightKg) : undefined,
        temperament: pet.temperament,
        allergies: pet.allergies,
        vetDoctorName: pet.vetDoctorName,
        vetClinic: pet.vetClinic,
        vetPhone: pet.vetPhone,
        ...(needsVaccination
          ? notVaccinated
            ? { notVaccinatedYet: true }
            : { lastVaccinationDate: vaccDate, lastVaccineName: vaccName || DEFAULT_VACCINE_BY_SPECIES[pet.species as 'dog' | 'cat'] }
          : {}),
      });
      Alert.alert('Saved!', 'Pet profile updated.', [
        { text: 'OK', onPress: () => goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!pet) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter' }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit {pet.name}</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Field label="Name" value={pet.name} onChange={(v) => setPet({ ...pet, name: v })} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{SPECIES_LABEL[pet.species as 'dog' | 'cat'] ?? 'Pet'} breed</Text>
            <TouchableOpacity style={[styles.fieldInput, styles.selectRow]} onPress={() => setBreedOpen(true)} accessibilityRole="button">
              <Text style={{ fontFamily: 'Inter', fontSize: 15, color: colors.textPrimary }}>{pet.breed}</Text>
              <Icon name="chevD" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Field label="Weight (kg)" value={String(pet.weightKg ?? '')} onChange={(v) => setPet({ ...pet, weightKg: v })} keyboardType="decimal-pad" />
          <Field label="Temperament" value={pet.temperament ?? ''} onChange={(v) => setPet({ ...pet, temperament: v })} multiline />
          <Field label="Allergies" value={pet.allergies ?? ''} onChange={(v) => setPet({ ...pet, allergies: v })} multiline />

          {needsVaccination && (
            <>
              <Text style={styles.sectionHeader}>Last vaccination *</Text>
              <DateField
                value={vaccDate}
                onChange={(v) => { setVaccDate(v); setNotVaccinated(false); setVaccError(''); }}
                placeholder="When was it done?"
                maxDate={todayIso()}
                minYear={new Date().getFullYear() - 15}
                disabled={notVaccinated}
                error={vaccError}
              />
              {!notVaccinated && (
                <View style={styles.chipRow}>
                  {CORE_VACCINES_BY_SPECIES[(pet.species as 'dog' | 'cat') ?? 'dog'].map((v) => (
                    <TouchableOpacity key={v} style={[styles.chip, vaccName === v && styles.chipActive]} onPress={() => setVaccName(vaccName === v ? '' : v)}>
                      <Text style={[styles.chipText, vaccName === v && styles.chipTextActive]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => { setNotVaccinated(!notVaccinated); setVaccDate(''); setVaccName(''); setVaccError(''); }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: notVaccinated }}
              >
                <View style={[styles.checkBox, notVaccinated && styles.checkBoxActive]}>
                  {notVaccinated && <Icon name="check" size={14} color={colors.white} />}
                </View>
                <Text style={styles.checkLabel}>Not vaccinated yet</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.sectionHeader}>Vet Information</Text>
          <Field label="Vet Doctor Name" value={pet.vetDoctorName ?? ''} onChange={(v) => setPet({ ...pet, vetDoctorName: v })} />
          <Field label="Clinic" value={pet.vetClinic ?? ''} onChange={(v) => setPet({ ...pet, vetClinic: v })} />
          <Field label="Vet Phone" value={pet.vetPhone ?? ''} onChange={(v) => setPet({ ...pet, vetPhone: v })} keyboardType="phone-pad" />

          <Button onPress={save} fullWidth loading={saving} style={{ marginTop: spacing[6] }}>
            Save Changes
          </Button>
        </ScrollView>

        <BottomSheet visible={breedOpen} onDismiss={() => setBreedOpen(false)} snapPoints="70%">
          <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[3] }}>
            <Input value={breedSearch} onChangeText={setBreedSearch} placeholder="Search breeds" leftIcon={<Icon name="search" size={16} color={colors.textMuted} />} />
          </View>
          <ScrollView style={{ paddingHorizontal: spacing[5] }} keyboardShouldPersistTaps="handled">
            {(BREEDS_BY_SPECIES[(pet.species as 'dog' | 'cat') ?? 'dog']).filter((b) => b.toLowerCase().includes(breedSearch.toLowerCase())).map((b) => (
              <TouchableOpacity key={b} style={styles.breedRow} onPress={() => { setPet({ ...pet, breed: b }); setBreedOpen(false); setBreedSearch(''); }}>
                <Text style={styles.breedRowText}>{b}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </BottomSheet>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, multiline, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; keyboardType?: any;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
  sectionHeader: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing[5], marginBottom: spacing[3] },
  field: { marginBottom: spacing[4] },
  fieldLabel: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing[1] },
  fieldInput: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontFamily: 'Inter', fontSize: 15, color: colors.textPrimary, minHeight: 50 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  chip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2] + 2, borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  chipActive: { borderColor: colors.brandBrown, backgroundColor: colors.brandBrown },
  chipText: { fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[4] },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderLight, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  checkLabel: { fontFamily: 'Inter', fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  breedRow: { paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  breedRowText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },
});
