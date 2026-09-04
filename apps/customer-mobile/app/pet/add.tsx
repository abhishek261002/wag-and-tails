import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

type PetSex = 'male' | 'female';
type CoatType = 'short' | 'medium' | 'long' | 'curly' | 'double' | 'other';
type PetSize = 'small' | 'medium' | 'large' | 'extra_large';

const SEX_OPTIONS: { label: string; value: PetSex }[] = [
  { label: '♂ Male', value: 'male' },
  { label: '♀ Female', value: 'female' },
];
const SIZE_OPTIONS: { label: string; value: PetSize }[] = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
  { label: 'XL', value: 'extra_large' },
];
const COAT_OPTIONS: { label: string; value: CoatType }[] = [
  { label: 'Short', value: 'short' },
  { label: 'Medium', value: 'medium' },
  { label: 'Long', value: 'long' },
  { label: 'Curly', value: 'curly' },
  { label: 'Double', value: 'double' },
  { label: 'Other', value: 'other' },
];

export default function AddPetScreen() {
  const [form, setForm] = useState({
    name: '', breed: '', sex: 'male' as PetSex,
    dateOfBirth: '', weightKg: '', size: 'medium' as PetSize,
    coatType: 'short' as CoatType, isNeutered: false,
    temperament: '', allergies: '', careNote: '',
    vetDoctorName: '', vetClinic: '', vetPhone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs['name'] = 'Pet name is required';
    if (!form.breed.trim()) errs['breed'] = 'Breed is required';
    if (form.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
      errs['dateOfBirth'] = 'Format: YYYY-MM-DD';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const weightKg = form.weightKg ? parseFloat(form.weightKg) : undefined;
      await wagApi.pets.create({
        name: form.name,
        breed: form.breed,
        sex: form.sex,
        dateOfBirth: form.dateOfBirth || undefined,
        weightKg,
        size: form.size,
        coatType: form.coatType,
        isNeutered: form.isNeutered,
        temperament: form.temperament || undefined,
        allergies: form.allergies || undefined,
        careNote: form.careNote || undefined,
        vetDoctorName: form.vetDoctorName || undefined,
        vetClinic: form.vetClinic || undefined,
        vetPhone: form.vetPhone || undefined,
      });
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Failed', err?.message ?? 'Could not add pet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.pageTitle}>Add a Pet</Text>
            <View style={{ width: 50 }} />
          </View>

          <Section title="Basic Info">
            <Input label="Pet name *" value={form.name} onChangeText={(v) => update('name', v)} error={errors['name']} placeholder="Simba" />
            <Gap />
            <Input label="Breed *" value={form.breed} onChangeText={(v) => update('breed', v)} error={errors['breed']} placeholder="Golden Retriever" />
            <Gap />
            <Input label="Date of birth" value={form.dateOfBirth} onChangeText={(v) => update('dateOfBirth', v)} error={errors['dateOfBirth']} placeholder="YYYY-MM-DD" keyboardType="numeric" hint="Optional" />
            <Gap />
            <Input label="Weight (kg)" value={form.weightKg} onChangeText={(v) => update('weightKg', v)} placeholder="e.g. 12.5" keyboardType="decimal-pad" />

            <Text style={styles.optionLabel}>Sex</Text>
            <OptionGroup options={SEX_OPTIONS} value={form.sex} onChange={(v) => update('sex', v)} />

            <Text style={styles.optionLabel}>Size</Text>
            <OptionGroup options={SIZE_OPTIONS} value={form.size} onChange={(v) => update('size', v)} />

            <Text style={styles.optionLabel}>Coat type</Text>
            <OptionGroup options={COAT_OPTIONS} value={form.coatType} onChange={(v) => update('coatType', v)} />

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => update('isNeutered', !form.isNeutered)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: form.isNeutered }}
            >
              <View style={[styles.checkbox, form.isNeutered && styles.checkboxChecked]}>
                {form.isNeutered && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>Neutered / Spayed</Text>
            </TouchableOpacity>
          </Section>

          <Section title="Care & Health">
            <Input label="Temperament" value={form.temperament} onChangeText={(v) => update('temperament', v)} placeholder="e.g. Gentle, playful, anxious with strangers" multiline numberOfLines={2} />
            <Gap />
            <Input label="Allergies" value={form.allergies} onChangeText={(v) => update('allergies', v)} placeholder="e.g. Sensitive to chicken, lavender shampoo" multiline numberOfLines={2} />
            <Gap />
            <Input label="Care note" value={form.careNote} onChangeText={(v) => update('careNote', v)} placeholder="Important handling notes for groomer/walker" multiline numberOfLines={3} hint="This note will appear on every booking so partners are informed." />
          </Section>

          <Section title="Vet Information">
            <Input label="Vet doctor name" value={form.vetDoctorName} onChangeText={(v) => update('vetDoctorName', v)} placeholder="Dr. Pradeep Nair" />
            <Gap />
            <Input label="Vet clinic" value={form.vetClinic} onChangeText={(v) => update('vetClinic', v)} placeholder="PetCare Clinic, Koramangala" />
            <Gap />
            <Input label="Vet phone" value={form.vetPhone} onChangeText={(v) => update('vetPhone', v)} placeholder="+91 80 2233 4455" keyboardType="phone-pad" />
          </Section>

          <View style={styles.footer}>
            <Button onPress={handleSubmit} fullWidth loading={loading}>
              Add {form.name || 'Pet'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function OptionGroup<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.optionRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.optionChip, value === opt.value && styles.optionChipActive]}
          onPress={() => onChange(opt.value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === opt.value }}
        >
          <Text style={[styles.optionChipText, value === opt.value && styles.optionChipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Gap() { return <View style={{ height: spacing[4] }} />; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: spacing[12] },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  backText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.brandBrown, fontWeight: '600' },
  pageTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  section: { marginBottom: spacing[2] },
  sectionTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  sectionCard: { backgroundColor: colors.white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing[5], paddingVertical: spacing[4] },
  optionLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '500', color: colors.textSecondary, marginTop: spacing[4], marginBottom: spacing[2] },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  optionChip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  optionChipActive: { borderColor: colors.brandBrown, backgroundColor: colors.brandBrown },
  optionChipText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  optionChipTextActive: { color: colors.white },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[5] },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderMedium, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  checkLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
});
