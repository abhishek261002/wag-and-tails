import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { MOCK_VETS } from '../src/data/vets';
import { goBack } from '../src/lib/nav';

const initials = (name: string) => name.replace(/^Dr\.\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('');

/** "Our vets": the doctors on the panel. Sample profiles for now; booking a consultation comes later. */
export default function VetsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack()} accessibilityLabel="Go back"><Icon name="back" size={18} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Our vets</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.note}>
          <Icon name="info" size={16} color={colors.marigoldDark} />
          <Text style={styles.noteText}>Vet consultations are coming soon. Meet the doctors joining Wag & Tails.</Text>
        </View>
        {MOCK_VETS.map((v) => (
          <View key={v.id} style={styles.card} accessibilityLabel={`${v.name}, ${v.speciality}, ${v.experienceYears} years experience, ${v.city}`}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(v.name)}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name}>{v.name}</Text>
              <Text style={styles.qual}>{v.qualification}</Text>
              <Text style={styles.spec}>{v.speciality}</Text>
              <View style={styles.metaRow}>
                <View style={styles.chip}><Icon name="star" size={11} color={colors.marigoldDark} /><Text style={styles.chipText}>{v.rating.toFixed(1)}</Text></View>
                <View style={styles.chip}><Text style={styles.chipText}>{v.experienceYears} yrs</Text></View>
                <View style={styles.chip}><Icon name="pin" size={11} color={colors.textMuted} /><Text style={styles.chipText}>{v.city}</Text></View>
              </View>
              <Text style={styles.lang}>Speaks {v.languages.join(', ')}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3] },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[10], gap: spacing[3] },
  note: { flexDirection: 'row', gap: spacing[3], alignItems: 'center', backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4] },
  noteText: { flex: 1, fontFamily: 'Inter', fontSize: 13, color: colors.marigoldDark },
  card: { flexDirection: 'row', gap: spacing[3], backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.xl, padding: spacing[4] },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.brandBrown },
  name: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  qual: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 1 },
  spec: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing[2] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.canvas, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: 'Inter', fontSize: 11.5, fontWeight: '700', color: colors.textSecondary },
  lang: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: spacing[2] },
});
