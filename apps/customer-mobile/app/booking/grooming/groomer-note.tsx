import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { useBookingStore } from '../../../src/store/booking.store';

export default function GroomerNoteScreen() {
  const { groomingDraft, updateGroomingDraft } = useBookingStore();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Note for Groomer</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>
            Anything the groomer should know? (optional)
          </Text>
          <Text style={styles.hint}>
            Pet care notes from {groomingDraft.pet?.name ?? 'your pet'}'s profile will be shared automatically.
          </Text>

          {groomingDraft.pet && (groomingDraft.pet as any).careNotes?.length > 0 && (
            <View style={styles.autoNoteBox}>
              <Text style={styles.autoNoteTitle}>📝 Auto-attached care notes</Text>
              <Text style={styles.autoNoteText}>{(groomingDraft.pet as any).careNotes[0]?.note}</Text>
            </View>
          )}

          <TextInput
            style={styles.textArea}
            value={groomingDraft.notes}
            onChangeText={(t) => updateGroomingDraft({ notes: t })}
            placeholder="e.g. Please be gentle around her right ear, she's sensitive there"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            maxLength={500}
            textAlignVertical="top"
            accessibilityLabel="Note for groomer"
          />
          <Text style={styles.charCount}>{groomingDraft.notes.length}/500</Text>
        </View>

        <View style={styles.footer}>
          <Button onPress={() => router.push('/booking/grooming/review')} fullWidth>
            Review Booking →
          </Button>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  content: { flex: 1, paddingHorizontal: spacing[5] },
  label: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[2] },
  hint: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginBottom: spacing[4] },
  autoNoteBox: { backgroundColor: colors.warningLight, borderRadius: radii.lg, padding: spacing[3], marginBottom: spacing[4] },
  autoNoteTitle: { fontFamily: 'Inter', fontSize: 12, fontWeight: '800', color: colors.warning, marginBottom: 4 },
  autoNoteText: { fontFamily: 'Inter', fontSize: 13, color: colors.warning, lineHeight: 19 },
  textArea: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.borderLight, padding: spacing[4], fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary, minHeight: 120 },
  charCount: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: spacing[1] },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
