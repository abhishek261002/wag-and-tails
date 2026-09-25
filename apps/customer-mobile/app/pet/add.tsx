import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, BottomSheet, DateField, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import {
  BREEDS_BY_SPECIES,
  COAT_OPTIONS_BY_SPECIES,
  CORE_VACCINES_BY_SPECIES,
  DEFAULT_VACCINE_BY_SPECIES,
  SERVICES_BY_SPECIES,
  SPECIES_LABEL,
  sizeFromWeight,
  type PetSpecies,
  type CoatType,
} from '@wag/shared-types';
import { wagApi } from '../../src/lib/api';
import { goBack as safeBack } from '../../src/lib/nav';

type PetSex = 'male' | 'female';

const TOTAL_STEPS = 3;
const STEP_LABELS = ['Basics', 'Details', 'Health & care'];
const MAX_WEIGHT: Record<PetSpecies, number> = { dog: 150, cat: 15 };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function AddPetScreen() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [breedPickerOpen, setBreedPickerOpen] = useState(false);
  const [breedSearch, setBreedSearch] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [form, setForm] = useState({
    species: '' as PetSpecies | '',
    name: '', breed: '', sex: 'male' as PetSex,
    dateOfBirth: '', weightKg: '',
    coatType: 'short' as CoatType, isNeutered: true,
    lastVaccinationDate: '', lastVaccineName: '', notVaccinatedYet: false,
    allergies: '', careNote: '', vetInfo: '',
  });

  const species = form.species || null;

  const update = (field: keyof typeof form, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const chooseSpecies = (s: PetSpecies) => {
    if (form.species === s) return;
    // Breed and coat options differ per species, so anything picked for the other one is cleared.
    setForm((f) => ({ ...f, species: s, breed: '', coatType: 'short', lastVaccineName: '' }));
    setErrors({});
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a pet picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const validateStep = (index: number): boolean => {
    const errs: Record<string, string> = {};
    if (index === 0) {
      if (!form.species) errs['species'] = 'Choose a cat or a dog';
      if (!form.name.trim()) errs['name'] = 'Pet name is required';
      if (!form.breed.trim()) errs['breed'] = 'Breed is required';
    }
    if (index === 1 && form.weightKg) {
      const w = parseFloat(form.weightKg);
      if (Number.isNaN(w) || w <= 0) errs['weightKg'] = 'Enter a valid weight';
      else if (species && w > MAX_WEIGHT[species]) errs['weightKg'] = `Weight can't be more than ${MAX_WEIGHT[species]} kg`;
    }
    if (index === 2) {
      if (!form.notVaccinatedYet && !form.lastVaccinationDate) {
        errs['lastVaccinationDate'] = 'Tell us when the last vaccination was';
      }
      if (form.lastVaccinationDate && form.dateOfBirth && form.lastVaccinationDate < form.dateOfBirth) {
        errs['lastVaccinationDate'] = 'This is before your pet was born';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isStepValid = () => {
    if (step === 0) return !!form.species && form.name.trim().length > 0 && form.breed.trim().length > 0;
    if (step === 2) return form.notVaccinatedYet || !!form.lastVaccinationDate;
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const goBack = () => {
    if (step === 0) {
      safeBack();
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    if (!species) return;
    if (!validateStep(1) || !validateStep(2)) return;
    setLoading(true);
    try {
      const weightKg = form.weightKg ? parseFloat(form.weightKg) : undefined;
      const [vetDoctorName, vetClinic] = form.vetInfo.includes('·')
        ? form.vetInfo.split('·').map((s) => s.trim())
        : [form.vetInfo.trim() || undefined, undefined];

      const pet = await wagApi.pets.create({
        species,
        name: form.name.trim(),
        breed: form.breed.trim(),
        sex: form.sex,
        dateOfBirth: form.dateOfBirth || undefined,
        weightKg,
        size: weightKg ? sizeFromWeight(species, weightKg) : 'medium',
        coatType: form.coatType,
        isNeutered: form.isNeutered,
        allergies: form.allergies.trim() || undefined,
        careNote: form.careNote.trim() || undefined,
        vetDoctorName,
        vetClinic,
        ...(form.notVaccinatedYet
          ? { notVaccinatedYet: true }
          : {
              lastVaccinationDate: form.lastVaccinationDate,
              lastVaccineName: form.lastVaccineName || DEFAULT_VACCINE_BY_SPECIES[species],
            }),
      });

      if (photo) {
        try {
          await wagApi.pets.uploadAvatar(pet.id, {
            uri: photo.uri,
            name: photo.fileName ?? 'pet-photo.jpg',
            type: photo.mimeType ?? 'image/jpeg',
          });
        } catch (err: any) {
          // The pet itself is saved, so this isn't fatal — but it must be
          // said out loud. Swallowing it silently is why every pet ended up
          // with no avatar and nobody noticed.
          Alert.alert(
            'Photo not saved',
            `${form.name} was added, but the photo could not be uploaded: ${err?.message ?? 'unknown error'}`
          );
        }
      }

      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.message ?? err?.message ?? 'Could not add pet');
    } finally {
      setLoading(false);
    }
  };

  const filteredBreeds = (species ? BREEDS_BY_SPECIES[species] : []).filter((b) =>
    b.toLowerCase().includes(breedSearch.toLowerCase())
  );
  const coatOptions = species ? COAT_OPTIONS_BY_SPECIES[species] : COAT_OPTIONS_BY_SPECIES.dog;
  const speciesNoun = species ? SPECIES_LABEL[species].toLowerCase() : 'pet';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityLabel="Go back">
            <Icon name="back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Add a pet</Text>
            <Text style={styles.subtitle}>Step {step + 1} of {TOTAL_STEPS} · {STEP_LABELS[step]}</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.progressSeg, i <= step && styles.progressSegActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <Text style={styles.fieldLabel}>Select animal</Text>
              <View style={styles.speciesRow}>
                {(['dog', 'cat'] as PetSpecies[]).map((s) => {
                  const active = form.species === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.speciesTile, active && styles.speciesTileActive]}
                      onPress={() => chooseSpecies(s)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={SPECIES_LABEL[s]}
                    >
                      <View style={[styles.speciesIcon, active && styles.speciesIconActive]}>
                        <Icon name="paw" size={26} color={active ? colors.white : colors.brandBrown} />
                      </View>
                      <Text style={[styles.speciesName, active && styles.speciesNameActive]}>{SPECIES_LABEL[s]}</Text>
                      <Text style={[styles.speciesHint, active && styles.speciesHintActive]}>
                        {SERVICES_BY_SPECIES[s].includes('walking') ? 'Grooming & walks' : 'Grooming only'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors['species'] ? <Text style={styles.errorText}>{errors['species']}</Text> : null}

              <View style={styles.gap} />
              <View style={styles.photoWrap}>
                <TouchableOpacity onPress={pickPhoto} style={styles.photoCircle} accessibilityLabel="Add a pet photo">
                  {photo ? (
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  ) : (
                    <Icon name="cam" size={30} color={colors.marigold} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={pickPhoto} style={styles.photoPill}>
                  <Text style={styles.photoPillText}>Add a photo</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Name</Text>
              <Input
                value={form.name}
                onChangeText={(v) => update('name', v)}
                error={errors['name']}
                placeholder={species === 'cat' ? 'e.g. Luna' : 'e.g. Simba'}
              />

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Breed</Text>
              <TouchableOpacity
                style={[styles.selectField, !species && { opacity: 0.5 }]}
                onPress={() => species && setBreedPickerOpen(true)}
                disabled={!species}
                accessibilityRole="button"
              >
                <Text style={form.breed ? styles.selectValue : styles.selectPlaceholder}>
                  {form.breed || (species ? `Choose a ${speciesNoun} breed` : 'Select an animal first')}
                </Text>
                <Icon name="chevD" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              {errors['breed'] ? <Text style={styles.errorText}>{errors['breed']}</Text> : null}

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Sex</Text>
              <SegmentedControl
                options={[{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }]}
                value={form.sex}
                onChange={(v) => update('sex', v as PetSex)}
              />
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.fieldLabel}>Date of birth</Text>
              <DateField
                value={form.dateOfBirth}
                onChange={(v) => update('dateOfBirth', v)}
                placeholder="Select date of birth"
                minYear={new Date().getFullYear() - (species === 'cat' ? 25 : 20)}
                error={errors['dateOfBirth']}
              />
              <Text style={styles.hintText}>An estimate is fine if you're not sure.</Text>

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Weight</Text>
              <View style={styles.weightRow}>
                <Input
                  containerStyle={{ flex: 1 }}
                  value={form.weightKg}
                  onChangeText={(v) => update('weightKg', v)}
                  error={errors['weightKg']}
                  placeholder={species === 'cat' ? '4' : '12'}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.weightUnit}>kg</Text>
              </View>
              <Text style={styles.hintText}>Used to price the groom — small, medium or large.</Text>

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Coat type</Text>
              <View style={styles.chipRow}>
                {coatOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, form.coatType === opt.value && styles.chipActive]}
                    onPress={() => update('coatType', opt.value)}
                  >
                    <Text style={[styles.chipText, form.coatType === opt.value && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>{form.sex === 'female' ? 'Spayed' : 'Neutered'}</Text>
              <SegmentedControl
                options={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]}
                value={form.isNeutered ? 'yes' : 'no'}
                onChange={(v) => update('isNeutered', v === 'yes')}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.fieldLabel}>Last vaccination *</Text>
              <DateField
                value={form.lastVaccinationDate}
                onChange={(v) => setForm((f) => ({ ...f, lastVaccinationDate: v, notVaccinatedYet: false }))}
                placeholder="When was it done?"
                maxDate={todayIso()}
                minYear={new Date().getFullYear() - 15}
                disabled={form.notVaccinatedYet}
                error={errors['lastVaccinationDate']}
              />
              <Text style={styles.hintText}>
                We use this to remind you before the next booster is due. Check your vaccination card if you're unsure.
              </Text>

              {species && !form.notVaccinatedYet && (
                <>
                  <View style={styles.gap} />
                  <Text style={styles.fieldLabel}>Which vaccine? (optional)</Text>
                  <View style={styles.chipRow}>
                    {CORE_VACCINES_BY_SPECIES[species].map((v) => {
                      const active = form.lastVaccineName === v;
                      return (
                        <TouchableOpacity key={v} style={[styles.chip, active && styles.chipActive]} onPress={() => update('lastVaccineName', active ? '' : v)}>
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{v}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setForm((f) => ({ ...f, notVaccinatedYet: !f.notVaccinatedYet, lastVaccinationDate: '', lastVaccineName: '' }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.notVaccinatedYet }}
              >
                <View style={[styles.checkBox, form.notVaccinatedYet && styles.checkBoxActive]}>
                  {form.notVaccinatedYet && <Icon name="check" size={14} color={colors.white} />}
                </View>
                <Text style={styles.checkLabel}>Not vaccinated yet</Text>
              </TouchableOpacity>

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Care notes</Text>
              <Input
                value={form.careNote}
                onChangeText={(v) => update('careNote', v)}
                placeholder="e.g. Hates having his ears touched, go slow."
                multiline
                numberOfLines={3}
                style={{ minHeight: 84, textAlignVertical: 'top' }}
              />
              <Text style={styles.hintText}>
                Every groomer and walker sees this before they start. This is the single most useful thing you can fill in.
              </Text>

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Allergies</Text>
              <Input
                value={form.allergies}
                onChangeText={(v) => update('allergies', v)}
                placeholder="None recorded"
              />

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Vet</Text>
              <Input
                value={form.vetInfo}
                onChangeText={(v) => update('vetInfo', v)}
                placeholder="Dr. name · clinic"
              />
            </>
          )}

          <View style={styles.footer}>
            <Button
              onPress={goNext}
              fullWidth
              loading={loading}
              disabled={!isStepValid()}
            >
              {step === TOTAL_STEPS - 1 ? 'Save pet' : 'Continue'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={breedPickerOpen} onDismiss={() => setBreedPickerOpen(false)} snapPoints="70%">
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Choose a {speciesNoun} breed</Text>
        </View>
        <View style={styles.sheetSearchWrap}>
          <Input
            value={breedSearch}
            onChangeText={setBreedSearch}
            placeholder="Search breeds"
            leftIcon={<Icon name="search" size={16} color={colors.textMuted} />}
          />
        </View>
        <ScrollView style={{ paddingHorizontal: spacing[5] }} keyboardShouldPersistTaps="handled">
          {filteredBreeds.map((breed) => (
            <TouchableOpacity
              key={breed}
              style={styles.breedRow}
              onPress={() => {
                update('breed', breed);
                setBreedPickerOpen(false);
                setBreedSearch('');
              }}
            >
              <Text style={styles.breedRowText}>{breed}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

function SegmentedControl<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.segment, value === opt.value && styles.segmentActive]}
          onPress={() => onChange(opt.value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === opt.value }}
        >
          <Text style={[styles.segmentText, value === opt.value && styles.segmentTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  backBtn: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.biscuitLighter, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'PlusJakartaSans', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  progressRow: { flexDirection: 'row', gap: spacing[1], paddingHorizontal: spacing[5], marginBottom: spacing[5] },
  progressSeg: { flex: 1, height: 4, borderRadius: radii.full, backgroundColor: colors.borderLight },
  progressSegActive: { backgroundColor: colors.brandBrown },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  photoWrap: { alignItems: 'center', marginBottom: spacing[6] },
  photoCircle: {
    width: 96, height: 96, borderRadius: radii.full, borderWidth: 2, borderStyle: 'dashed',
    borderColor: colors.biscuit, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.biscuitLighter, overflow: 'hidden', marginBottom: spacing[3],
  },
  photoImage: { width: '100%', height: '100%' },
  photoPill: { borderWidth: 1.5, borderColor: colors.marigold, borderRadius: radii.full, paddingHorizontal: spacing[5], paddingVertical: spacing[2] },
  photoPillText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.marigoldDark },
  fieldLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[2] },
  gap: { height: spacing[5] },
  selectField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.md,
    backgroundColor: colors.white, paddingHorizontal: spacing[4], paddingVertical: spacing[3] + 2,
  },
  selectValue: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: '600' },
  selectPlaceholder: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted },
  errorText: { fontFamily: 'Inter', fontSize: 12, color: colors.error, marginTop: 4 },
  hintText: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: spacing[2], lineHeight: 17 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  weightUnit: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2] + 2, borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  chipActive: { borderColor: colors.brandBrown, backgroundColor: colors.brandBrown },
  chipText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: spacing[3], borderRadius: radii.sm },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: colors.textPrimary },
  speciesRow: { flexDirection: 'row', gap: spacing[3] },
  speciesTile: { flex: 1, alignItems: 'center', paddingVertical: spacing[5], paddingHorizontal: spacing[3], borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  speciesTileActive: { borderColor: colors.brandBrown, backgroundColor: colors.biscuitLighter },
  speciesIcon: { width: 52, height: 52, borderRadius: radii.full, backgroundColor: colors.biscuitLighter, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] },
  speciesIconActive: { backgroundColor: colors.brandBrown },
  speciesName: { fontFamily: 'PlusJakartaSans', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  speciesNameActive: { color: colors.brandBrown },
  speciesHint: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  speciesHintActive: { color: colors.textSecondary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[5] },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderLight, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  checkLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '600', color: colors.textPrimary },
  footer: { marginTop: spacing[8] },
  sheetHeader: { paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  sheetTitle: { fontFamily: 'PlusJakartaSans', fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.textPrimary },
  sheetSearchWrap: { paddingHorizontal: spacing[5], marginBottom: spacing[3] },
  breedRow: { paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  breedRowText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary },
});
