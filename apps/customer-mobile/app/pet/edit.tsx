import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

export default function EditPetScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const [pet, setPet] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (petId) wagApi.pets.get(petId).then(setPet).catch(() => {});
  }, [petId]);

  const save = async () => {
    if (!pet || !petId) return;
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
      });
      Alert.alert('Saved!', 'Pet profile updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save');
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
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit {pet.name}</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Field label="Name" value={pet.name} onChange={(v) => setPet({ ...pet, name: v })} />
          <Field label="Breed" value={pet.breed} onChange={(v) => setPet({ ...pet, breed: v })} />
          <Field label="Weight (kg)" value={String(pet.weightKg ?? '')} onChange={(v) => setPet({ ...pet, weightKg: v })} keyboardType="decimal-pad" />
          <Field label="Temperament" value={pet.temperament ?? ''} onChange={(v) => setPet({ ...pet, temperament: v })} multiline />
          <Field label="Allergies" value={pet.allergies ?? ''} onChange={(v) => setPet({ ...pet, allergies: v })} multiline />

          <Text style={styles.sectionHeader}>Vet Information</Text>
          <Field label="Vet Doctor Name" value={pet.vetDoctorName ?? ''} onChange={(v) => setPet({ ...pet, vetDoctorName: v })} />
          <Field label="Clinic" value={pet.vetClinic ?? ''} onChange={(v) => setPet({ ...pet, vetClinic: v })} />
          <Field label="Vet Phone" value={pet.vetPhone ?? ''} onChange={(v) => setPet({ ...pet, vetPhone: v })} keyboardType="phone-pad" />

          <Button onPress={save} fullWidth loading={saving} style={{ marginTop: spacing[6] }}>
            Save Changes
          </Button>
        </ScrollView>
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
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },
});
