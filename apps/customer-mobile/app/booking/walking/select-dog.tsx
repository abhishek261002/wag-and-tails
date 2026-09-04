import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../../src/lib/api';
import { useBookingStore } from '../../../src/store/booking.store';
import type { Pet } from '@wag/shared-types';

export default function WalkSelectDogScreen() {
  const [pets, setPets] = useState<Pet[]>([]);
  const { updateWalkDraft } = useBookingStore();

  useEffect(() => {
    wagApi.pets.list().then(setPets).catch(() => {});
  }, []);

  const select = (pet: Pet) => {
    updateWalkDraft({ petId: pet.id, pet });
    router.push('/booking/walking/select-duration');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Who's going for a walk?</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={pets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: pet }) => (
          <TouchableOpacity
            style={styles.petRow}
            onPress={() => select(pet)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Select ${pet.name} for walk`}
          >
            <PetAvatar name={pet.name} imageUrl={pet.avatarUrl} size={56} ringState="idle" />
            <View style={styles.petInfo}>
              <Text style={styles.petName}>{pet.name}</Text>
              <Text style={styles.petBreed}>{pet.breed} · {pet.size}</Text>
              {pet.temperament && (
                <Text style={styles.temperament} numberOfLines={1}>{pet.temperament}</Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🐕</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  list: { padding: spacing[5], gap: spacing[3] },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight },
  petInfo: { flex: 1 },
  petName: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  petBreed: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  temperament: { fontFamily: 'Inter', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: 15, color: colors.textMuted, marginTop: spacing[3] },
  addPet: { fontFamily: 'Inter', fontSize: 15, color: colors.marigoldDark, fontWeight: '700', marginTop: spacing[2] },
});
