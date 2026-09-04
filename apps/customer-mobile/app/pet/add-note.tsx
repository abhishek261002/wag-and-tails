import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

export default function AddPetNoteScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await wagApi.pets.addCareNote(petId!, note.trim());
      Alert.alert('Note saved!', 'This note will be visible to your groomer and walker.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Care Note</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📝 Care notes travel through the whole Wag & Tails ecosystem. Your groomer, walker, and staff will all see this note before every appointment.
            </Text>
          </View>

          <Text style={styles.label}>Note</Text>
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
          <Button onPress={save} fullWidth loading={saving} disabled={!note.trim()}>
            Save Care Note
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
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { flex: 1, paddingHorizontal: spacing[5] },
  infoBox: { backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[5] },
  infoText: { fontFamily: 'Inter', fontSize: 14, color: colors.marigoldDark, lineHeight: 21 },
  label: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[2] },
  textArea: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.borderLight, padding: spacing[4], fontFamily: 'Inter', fontSize: 15, color: colors.textPrimary, minHeight: 150 },
  charCount: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: spacing[1] },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
