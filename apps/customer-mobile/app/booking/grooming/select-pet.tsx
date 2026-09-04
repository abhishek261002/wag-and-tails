import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PetAvatar, Card } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { useBookingStore } from '../../../src/store/booking.store';
import type { Pet } from '@wag/shared-types';

export default function SelectPetScreen() {
  const { petId: preselected } = useLocalSearchParams<{ petId?: string }>();
  const [pets, setPets] = useState<Pet[]>([]);
  const { updateGroomingDraft } = useBookingStore();

  useEffect(() => {
    wagApi.pets.list().then(setPets).catch(() => {});
  }, []);

  // Auto-advance if petId pre-selected
  useEffect(() => {
    if (preselected && pets.length > 0) {
      const pet = pets.find((p) => p.id === preselected);
      if (pet) selectPet(pet);
    }
  }, [preselected, pets]);

  const selectPet = (pet: Pet) => {
    updateGroomingDraft({ petId: pet.id, pet });
    router.push('/booking/grooming/select-package');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Select a pet</Text>
        <View style={{ width: 50 }} />
      </View>

      <StepIndicator step={1} total={9} />

      <FlatList
        data={pets}
        contentContainerStyle={styles.list}
        keyExtractor={(p) => p.id}
        renderItem={({ item: pet }) => (
          <TouchableOpacity
            style={styles.petRow}
            onPress={() => selectPet(pet)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Select ${pet.name}`}
          >
            <PetAvatar name={pet.name} imageUrl={pet.avatarUrl} size={56} ringState="idle" />
            <View style={styles.petInfo}>
              <Text style={styles.petName}>{pet.name}</Text>
              <Text style={styles.petBreed}>{pet.breed} · {pet.size}</Text>
              {pet.allergies && (
                <Text style={styles.petAllergy} numberOfLines={1}>⚠️ {pet.allergies}</Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🐶</Text>
            <Text style={styles.emptyText}>No pets added yet</Text>
            <TouchableOpacity onPress={() => router.push('/pet/add')}>
              <Text style={styles.addPet}>+ Add a pet first</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <View style={indStyles.container}>
      {Array(total).fill(null).map((_, i) => (
        <View key={i} style={[indStyles.dot, i < step ? indStyles.active : i === step - 1 ? indStyles.current : null]} />
      ))}
    </View>
  );
}

const indStyles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing[5], marginBottom: spacing[4] },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.borderLight },
  active: { backgroundColor: colors.brandBrown },
  current: { backgroundColor: colors.marigold },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  backText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  list: { paddingHorizontal: spacing[5] },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[3], borderWidth: 1, borderColor: colors.borderLight },
  petInfo: { flex: 1 },
  petName: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary },
  petBreed: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  petAllergy: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, color: colors.warning, marginTop: 2 },
  chevron: { fontFamily: 'Inter', fontSize: 22, color: colors.textMuted },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, marginTop: spacing[3] },
  addPet: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.marigoldDark, fontWeight: '700', marginTop: spacing[2] },
});
