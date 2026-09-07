import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, BottomSheet } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

type PetSex = 'male' | 'female';
type CoatType = 'short' | 'medium' | 'long' | 'curly' | 'double' | 'other';
type PetSize = 'small' | 'medium' | 'large' | 'extra_large';

const TOTAL_STEPS = 3;
const STEP_LABELS = ['Basics', 'Details', 'Care'];

const BREEDS = [
  'Beagle', 'Shih Tzu', 'Indie', 'Labrador', 'Golden Retriever', 'Pug',
  'German Shepherd', 'Cocker Spaniel', 'Dachshund', 'Rottweiler',
  'Pomeranian', 'Husky', 'Mixed',
];

const COAT_OPTIONS: { label: string; value: CoatType }[] = [
  { label: 'Short', value: 'short' },
  { label: 'Medium', value: 'medium' },
  { label: 'Long', value: 'long' },
  { label: 'Curly', value: 'curly' },
  { label: 'Double', value: 'double' },
];

// The prototype prices grooming off a small/medium/large band rather than
// asking the owner to pick one directly — derive it from weight instead.
function sizeFromWeight(weightKg: number): PetSize {
  if (weightKg <= 8) return 'small';
  if (weightKg <= 20) return 'medium';
  if (weightKg <= 35) return 'large';
  return 'extra_large';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDob(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === match[2].toLowerCase());
  const year = parseInt(match[3], 10);
  if (monthIndex === -1 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return iso;
}

export default function AddPetScreen() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [breedPickerOpen, setBreedPickerOpen] = useState(false);
  const [breedSearch, setBreedSearch] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [form, setForm] = useState({
    name: '', breed: '', sex: 'male' as PetSex,
    dateOfBirth: '', weightKg: '',
    coatType: 'short' as CoatType, isNeutered: true,
    allergies: '', careNote: '', vetInfo: '',
  });

  const update = (field: keyof typeof form, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
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
      if (!form.name.trim()) errs['name'] = 'Pet name is required';
      if (!form.breed.trim()) errs['breed'] = 'Breed is required';
    }
    if (index === 1) {
      if (form.dateOfBirth && !parseDob(form.dateOfBirth)) {
        errs['dateOfBirth'] = 'Format: DD MMM YYYY';
      }
      if (form.weightKg && Number.isNaN(parseFloat(form.weightKg))) {
        errs['weightKg'] = 'Enter a number';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isStepValid = () => {
    if (step === 0) return form.name.trim().length > 0 && form.breed.trim().length > 0;
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
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(1)) return;
    setLoading(true);
    try {
      const weightKg = form.weightKg ? parseFloat(form.weightKg) : undefined;
      const dobIso = form.dateOfBirth ? parseDob(form.dateOfBirth) ?? undefined : undefined;
      const [vetDoctorName, vetClinic] = form.vetInfo.includes('·')
        ? form.vetInfo.split('·').map((s) => s.trim())
        : [form.vetInfo.trim() || undefined, undefined];

      const pet = await wagApi.pets.create({
        name: form.name.trim(),
        breed: form.breed.trim(),
        sex: form.sex,
        dateOfBirth: dobIso,
        weightKg,
        size: weightKg ? sizeFromWeight(weightKg) : 'medium',
        coatType: form.coatType,
        isNeutered: form.isNeutered,
        allergies: form.allergies.trim() || undefined,
        careNote: form.careNote.trim() || undefined,
        vetDoctorName,
        vetClinic,
      });

      if (photo) {
        try {
          await wagApi.pets.uploadAvatar(pet.id, {
            uri: photo.uri,
            name: photo.fileName ?? 'pet-photo.jpg',
            type: photo.mimeType ?? 'image/jpeg',
          });
        } catch {
          // Photo upload failing shouldn't block pet creation succeeding.
        }
      }

      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Failed', err?.message ?? 'Could not add pet');
    } finally {
      setLoading(false);
    }
  };

  const filteredBreeds = BREEDS.filter((b) =>
    b.toLowerCase().includes(breedSearch.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
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
              <View style={styles.photoWrap}>
                <TouchableOpacity onPress={pickPhoto} style={styles.photoCircle} accessibilityLabel="Add a pet photo">
                  {photo ? (
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  ) : (
                    <Text style={styles.photoPlus}>+</Text>
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
                placeholder="e.g. Simba"
              />

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Breed</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setBreedPickerOpen(true)}
                accessibilityRole="button"
              >
                <Text style={form.breed ? styles.selectValue : styles.selectPlaceholder}>
                  {form.breed || 'Choose a breed'}
                </Text>
                <Text style={styles.selectChevron}>⌄</Text>
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
              <Input
                value={form.dateOfBirth}
                onChangeText={(v) => update('dateOfBirth', v)}
                error={errors['dateOfBirth']}
                placeholder="DD MMM YYYY"
                autoCapitalize="none"
              />

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Weight</Text>
              <View style={styles.weightRow}>
                <Input
                  containerStyle={{ flex: 1 }}
                  value={form.weightKg}
                  onChangeText={(v) => update('weightKg', v)}
                  error={errors['weightKg']}
                  placeholder="12"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.weightUnit}>kg</Text>
              </View>
              <Text style={styles.hintText}>Used to price the groom — small, medium or large.</Text>

              <View style={styles.gap} />
              <Text style={styles.fieldLabel}>Coat type</Text>
              <View style={styles.chipRow}>
                {COAT_OPTIONS.map((opt) => (
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
              <Text style={styles.fieldLabel}>Neutered</Text>
              <SegmentedControl
                options={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]}
                value={form.isNeutered ? 'yes' : 'no'}
                onChange={(v) => update('isNeutered', v === 'yes')}
              />
            </>
          )}

          {step === 2 && (
            <>
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
          <Text style={styles.sheetTitle}>Choose a breed</Text>
        </View>
        <View style={styles.sheetSearchWrap}>
          <Input
            value={breedSearch}
            onChangeText={setBreedSearch}
            placeholder="Search breeds"
            leftIcon={<Text style={{ color: colors.textMuted }}>⌕</Text>}
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
  backIcon: { fontSize: 22, color: colors.textPrimary, fontWeight: '600' },
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
  photoPlus: { fontSize: 36, color: colors.marigold, fontWeight: '300' },
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
  selectChevron: { fontSize: 16, color: colors.textMuted },
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
  footer: { marginTop: spacing[8] },
  sheetHeader: { paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  sheetTitle: { fontFamily: 'PlusJakartaSans', fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.textPrimary },
  sheetSearchWrap: { paddingHorizontal: spacing[5], marginBottom: spacing[3] },
  breedRow: { paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  breedRowText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary },
});
