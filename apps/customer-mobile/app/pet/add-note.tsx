import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

// Adds a care note, or edits/deletes one of your own when opened with a noteId.
export default function AddPetNoteScreen() {
  const { id: petId, noteId } = useLocalSearchParams<{ id: string; noteId?: string }>();
  const editing = !!noteId;
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  // Editing: start from the note's current text.
  useEffect(() => {
    if (!editing || !petId) return;
    let cancelled = false;
    wagApi.pets.get(petId)
      .then((p) => { if (!cancelled) setNote(p.careNotes.find((n) => n.id === noteId)?.note ?? ''); })
      .catch(() => { if (!cancelled) Alert.alert('Could not load the note', 'Please go back and try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [editing, petId, noteId]);

  const save = async () => {
    if (!note.trim() || !petId) return;
    setSaving(true);
    try {
      if (editing) await wagApi.pets.updateCareNote(petId, noteId!, note.trim());
      else await wagApi.pets.addCareNote(petId, note.trim());
      Alert.alert(editing ? 'Note updated' : 'Note saved!', 'Your groomer and walker will see this before every visit.', [
        { text: 'OK', onPress: () => goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save note');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert('Delete this note?', 'It will no longer be shown to your groomer or walker.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await wagApi.pets.deleteCareNote(petId!, noteId!); goBack(); }
          catch (err: any) { Alert.alert('Could not delete', err?.message ?? 'Please try again.'); }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editing ? 'Edit Care Note' : 'Add Care Note'}</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.content}>
          <View style={[styles.infoBox, { flexDirection: 'row', gap: spacing[2] }]}>
            <Icon name="doc" size={15} color={colors.marigoldDark} />
            <Text style={styles.infoText}>
              Care notes travel through the whole Wag & Tails ecosystem. Your groomer, walker, and staff will all see this note before every appointment.
            </Text>
          </View>

          <Text style={styles.label}>Note</Text>
          {loading && <ActivityIndicator color={colors.brandBrown} style={{ marginBottom: spacing[2] }} />}
          <TextInput
            style={styles.textArea}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Simba is nervous around loud noises. Please use low-noise clippers."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={6}
            maxLength={500}
            textAlignVertical="top"
            autoFocus
            accessibilityLabel="Pet care note"
          />
          <Text style={styles.charCount}>{note.length}/500</Text>
        </View>

        <View style={styles.footer}>
          <Button onPress={save} fullWidth loading={saving} disabled={!note.trim() || loading}>
            {editing ? 'Save changes' : 'Save Care Note'}
          </Button>
          {editing && (
            <TouchableOpacity onPress={remove} style={{ alignItems: 'center', marginTop: spacing[3] }} accessibilityRole="button">
              <Text style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.error }}>Delete note</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { flex: 1, paddingHorizontal: spacing[5] },
  infoBox: { backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[5] },
  infoText: { flex: 1, fontFamily: 'Inter', fontSize: 14, color: colors.marigoldDark, lineHeight: 21 },
  label: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[2] },
  textArea: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.borderLight, padding: spacing[4], fontFamily: 'Inter', fontSize: 15, color: colors.textPrimary, minHeight: 150 },
  charCount: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: spacing[1] },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
