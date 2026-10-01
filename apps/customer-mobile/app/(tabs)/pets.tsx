import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatPetAge, type Pet } from '@wag/shared-types';
import { Icon, PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../../src/lib/api';

type ChipTone = 'good' | 'warn' | 'neutral';

const TONE_BY_STATE: Record<string, ChipTone> = {
  up_to_date: 'good',
  due_soon: 'warn',
  overdue: 'warn',
  not_vaccinated_yet: 'neutral',
  no_records: 'neutral',
};

/** The family list, per the prototype: each pet with its vaccination state and number of visits. */
export default function PetsScreen() {
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setPets(await wagApi.pets.list());
      setFailed(false);
    } catch {
      setFailed(true);
      setPets((cur) => cur ?? []);
    }
  }, []);

  // Reload whenever the tab comes into view (a pet may have been added, edited or removed elsewhere).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const count = pets?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.marigold} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Pets</Text>
            <Text style={styles.sub}>{pets === null ? ' ' : count === 0 ? 'No pets yet' : `${count} in your family`}</Text>
          </View>
          <TouchableOpacity style={styles.plus} onPress={() => router.push('/pet/add')} accessibilityLabel="Add a pet">
            <Icon name="plus" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {pets === null && <ActivityIndicator style={{ marginTop: spacing[8] }} color={colors.brandBrown} />}
        {failed && pets !== null && pets.length === 0 && (
          <TouchableOpacity onPress={load}><Text style={styles.error}>Could not load your pets. Tap to try again.</Text></TouchableOpacity>
        )}

        {(pets ?? []).map((p) => {
          const age = formatPetAge(p.dateOfBirth);
          const meta = [p.breed, age, p.weightKg ? `${p.weightKg} kg` : null].filter(Boolean).join(' · ');
          const vac = p.vaccination;
          const tone: ChipTone = vac ? TONE_BY_STATE[vac.state] ?? 'neutral' : 'neutral';
          const visits = p.visitCount ?? 0;
          return (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/pet/[id]', params: { id: p.id } })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${meta}`}
            >
              <PetAvatar name={p.name} imageUrl={resolveMediaUrl(p.avatarUrl)} size={58} ringState="idle" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
                <View style={styles.chips}>
                  {vac && (
                    <View style={[styles.chip, tone === 'good' && styles.chipGood, tone === 'warn' && styles.chipWarn, tone === 'neutral' && styles.chipNeutral]}>
                      <Text style={[styles.chipText, tone === 'good' && styles.chipTextGood, tone === 'warn' && styles.chipTextWarn, tone === 'neutral' && styles.chipTextNeutral]}>{vac.label}</Text>
                    </View>
                  )}
                  <View style={[styles.chip, styles.chipOutline]}>
                    <Text style={[styles.chipText, styles.chipTextNeutral]}>{visits} visit{visits === 1 ? '' : 's'}</Text>
                  </View>
                </View>
              </View>
              <Icon name="chev" size={17} color={colors.textDisabled} />
            </TouchableOpacity>
          );
        })}

        {pets !== null && (
          <TouchableOpacity style={styles.addCard} onPress={() => router.push('/pet/add')} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Add a pet">
            <View style={styles.addRing}><Icon name="plus" size={22} color={colors.brandBrown} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Add a pet</Text>
              <Text style={styles.meta}>Breed, weight, vaccinations and care notes</Text>
            </View>
            <Icon name="chev" size={17} color={colors.textDisabled} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[10], gap: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[2] },
  title: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 30, color: colors.textPrimary },
  sub: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginTop: 2 },
  plus: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: 'Inter', fontSize: 14, color: colors.error, textAlign: 'center', marginTop: spacing[6] },

  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing[4] },
  name: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  meta: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipGood: { backgroundColor: colors.successLight },
  chipWarn: { backgroundColor: colors.marigoldBg },
  chipNeutral: { backgroundColor: colors.biscuitLight },
  chipOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderMedium },
  chipText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700' },
  chipTextGood: { color: colors.success },
  chipTextWarn: { color: colors.marigoldDark },
  chipTextNeutral: { color: colors.textSecondary },

  addCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], borderRadius: radii.xl, borderWidth: 2, borderColor: colors.borderMedium, borderStyle: 'dashed', padding: spacing[4] },
  addRing: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: colors.borderMedium, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
