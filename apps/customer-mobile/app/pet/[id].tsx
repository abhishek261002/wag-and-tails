import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PetAvatar, Card, Badge } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import type { PetDetail } from '@wag/shared-types';
import { format } from 'date-fns';

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pet, setPet] = useState<PetDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await wagApi.pets.get(id);
      setPet(data);
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!pet) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const age = pet.dateOfBirth
    ? Math.floor((Date.now() - new Date(pet.dateOfBirth).getTime()) / 31536000000)
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBrown} />}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/pet/edit', params: { id: pet.id } })}
            accessibilityLabel="Edit pet"
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Pet hero */}
        <View style={styles.hero}>
          <PetAvatar name={pet.name} imageUrl={pet.avatarUrl} size={96} ringState="idle" />
          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petBreed}>{pet.breed}</Text>
          <View style={styles.tagsRow}>
            <InfoTag label={pet.sex === 'male' ? '♂ Male' : '♀ Female'} />
            {age !== null && <InfoTag label={`${age} yrs`} />}
            {pet.weightKg && <InfoTag label={`${pet.weightKg} kg`} />}
            <InfoTag label={pet.size.replace('_', ' ')} />
            {pet.isNeutered && <InfoTag label="Neutered" />}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.marigold }]}
            onPress={() => router.push({ pathname: '/booking/grooming/select-pet', params: { petId: pet.id } })}
            accessibilityLabel="Book grooming"
          >
            <Text style={styles.actionIcon}>✂️</Text>
            <Text style={styles.actionText}>Book Grooming</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.brandBrown }]}
            onPress={() => router.push({ pathname: '/booking/walking/select-dog', params: { petId: pet.id } })}
            accessibilityLabel="Book walk"
          >
            <Text style={styles.actionIcon}>🐾</Text>
            <Text style={styles.actionText}>Book Walk</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#7B1FA2' }]}
            onPress={() => router.push({ pathname: '/chat/[petId]', params: { petId: pet.id } })}
            accessibilityLabel="AI chat"
          >
            <Text style={styles.actionIcon}>🤖</Text>
            <Text style={styles.actionText}>AI Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Care Notes */}
        {pet.careNotes.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Care Notes</Text>
            {pet.careNotes.map((note) => (
              <View key={note.id} style={styles.careNote}>
                <View style={styles.careNoteDot} />
                <Text style={styles.careNoteText}>{note.note}</Text>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/pet/add-note', params: { petId: pet.id } })}
              style={styles.addNoteBtn}
            >
              <Text style={styles.addNoteBtnText}>+ Add Care Note</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Health info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🏥 Health & Vet</Text>
          <InfoRow label="Allergies" value={pet.allergies || 'None known'} />
          <InfoRow label="Coat" value={pet.coatType} />
          <InfoRow label="Temperament" value={pet.temperament || 'Not specified'} />
          {pet.vetDoctorName && <InfoRow label="Vet" value={pet.vetDoctorName} />}
          {pet.vetClinic && <InfoRow label="Clinic" value={pet.vetClinic} />}
          {pet.vetPhone && <InfoRow label="Vet Phone" value={pet.vetPhone} />}
        </Card>

        {/* Vaccinations */}
        {pet.vaccinations.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>💉 Vaccinations</Text>
            {pet.vaccinations.map((vax) => (
              <View key={vax.id} style={styles.vacRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vacName}>{vax.vaccineName}</Text>
                  <Text style={styles.vacDate}>
                    Given: {format(new Date(vax.administeredDate), 'd MMM yyyy')}
                    {vax.expiryDate ? ` · Expires: ${format(new Date(vax.expiryDate), 'd MMM yyyy')}` : ''}
                  </Text>
                </View>
                <Badge
                  variant={vax.expiryDate && new Date(vax.expiryDate) > new Date() ? 'success' : 'warning'}
                  label={vax.expiryDate && new Date(vax.expiryDate) > new Date() ? 'Valid' : 'Expired'}
                />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoTag({ label }: { label: string }) {
  return (
    <View style={styles.infoTag}>
      <Text style={styles.infoTagText}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'Inter', color: colors.textMuted },
  content: { paddingBottom: spacing[12] },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  backText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.brandBrown, fontWeight: '600' },
  editText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.marigoldDark, fontWeight: '700' },
  hero: { alignItems: 'center', paddingVertical: spacing[6] },
  petName: { fontFamily: 'Inter', fontSize: typography.fontSize['3xl'], fontWeight: '800', color: colors.textPrimary, marginTop: spacing[3] },
  petBreed: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center', marginTop: spacing[3] },
  infoTag: { backgroundColor: colors.biscuitLight, borderRadius: radii.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
  infoTagText: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, fontWeight: '600', color: colors.brandBrown },
  actionRow: { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing[5], marginBottom: spacing[5] },
  actionBtn: { flex: 1, borderRadius: radii.lg, paddingVertical: spacing[4], alignItems: 'center' },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionText: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, fontWeight: '700', color: colors.white },
  section: { marginHorizontal: spacing[5], marginBottom: spacing[4] },
  sectionTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[3] },
  careNote: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2], alignItems: 'flex-start' },
  careNoteDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.marigold, marginTop: 7 },
  careNoteText: { flex: 1, fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  addNoteBtn: { marginTop: spacing[2] },
  addNoteBtnText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.marigoldDark, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted },
  infoValue: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.textPrimary, maxWidth: '60%', textAlign: 'right' },
  vacRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  vacName: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  vacDate: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
