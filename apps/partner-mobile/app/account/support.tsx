import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

export default function PartnerSupportScreen() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing fields', 'Please fill in subject and description');
      return;
    }
    setSubmitting(true);
    try {
      await wagApi.client.post('/support/tickets', { subject: subject.trim(), description: description.trim() });
      Alert.alert('Submitted!', 'Our partner team will respond within 4 hours.', [
        { text: 'OK', onPress: () => { setSubject(''); setDescription(''); router.back(); } },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not submit');
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Partner Support</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('tel:+918066778899')} accessibilityLabel="Call support">
            <Text style={{ fontSize: 24 }}>📞</Text>
            <Text style={styles.contactLabel}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('https://wa.me/918066778899')} accessibilityLabel="WhatsApp support">
            <Text style={{ fontSize: 24 }}>💬</Text>
            <Text style={styles.contactLabel}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('mailto:partners@wagandtails.in')} accessibilityLabel="Email support">
            <Text style={{ fontSize: 24 }}>📧</Text>
            <Text style={styles.contactLabel}>Email</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionTitle}>Submit a Ticket</Text>
        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="e.g. Payment issue" placeholderTextColor={colors.textMuted} accessibilityLabel="Subject" />
          <Text style={[styles.fieldLabel, { marginTop: spacing[3] }]}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Describe your issue…" placeholderTextColor={colors.textMuted} multiline numberOfLines={4} textAlignVertical="top" accessibilityLabel="Description" />
          <Button onPress={submit} loading={submitting} fullWidth style={{ marginTop: spacing[4] }}>Submit</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { padding: spacing[5] },
  contactRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[6] },
  contactBtn: { flex: 1, backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], alignItems: 'center', gap: spacing[2], borderWidth: 1, borderColor: colors.borderLight },
  contactLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  sectionTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[3] },
  form: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.borderLight },
  fieldLabel: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing[1] },
  input: { backgroundColor: colors.canvas, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
});
