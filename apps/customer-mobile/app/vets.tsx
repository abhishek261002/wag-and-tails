import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { goBack } from '../src/lib/nav';

/** "Our vets": placeholder until real doctors are on the panel (no invented profiles are shown). */
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
          <Text style={styles.noteText}>Vet consultations are coming soon. We will introduce our doctors here once they join Wag & Tails.</Text>
        </View>
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
