import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../src/lib/api';

const FAQS = [
  { q: 'How do I cancel a booking?', a: 'Open the booking from My Bookings and tap Cancel. Free cancellation is available up to 4 hours before the appointment.' },
  { q: 'How do I track my dog\'s walk?', a: 'Once a walker accepts your request, tap the booking to see the live map.' },
  { q: 'What if my partner doesn\'t show up?', a: 'Contact support immediately — we\'ll reassign or fully refund your booking.' },
  { q: 'How do I change my delivery address?', a: 'Go to Account → Saved Addresses to add or manage your addresses.' },
  { q: 'When will I receive my store order?', a: 'Orders are typically delivered in 2–4 business days within Bengaluru.' },
];

export default function SupportScreen() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const submitTicket = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing fields', 'Please fill in the subject and description');
      return;
    }
    setSubmitting(true);
    try {
      await wagApi.client.post('/support/tickets', { subject: subject.trim(), description: description.trim() });
      Alert.alert('Ticket submitted! 🎉', 'Our team will get back to you within 24 hours.', [
        { text: 'OK', onPress: () => { setSubject(''); setDescription(''); router.back(); } },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Quick contact */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('tel:+918066778899')} accessibilityLabel="Call support">
            <Text style={{ fontSize: 24 }}>📞</Text>
            <Text style={styles.contactLabel}>Call Us</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('mailto:support@wagandtails.in')} accessibilityLabel="Email support">
            <Text style={{ fontSize: 24 }}>📧</Text>
            <Text style={styles.contactLabel}>Email Us</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('https://wa.me/918066778899')} accessibilityLabel="WhatsApp support">
            <Text style={{ fontSize: 24 }}>💬</Text>
            <Text style={styles.contactLabel}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* FAQs */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {FAQS.map((faq, i) => (
          <TouchableOpacity key={i} style={styles.faqCard} onPress={() => setExpanded(expanded === i ? null : i)} accessibilityRole="button">
            <View style={styles.faqHeader}>
              <Text style={styles.faqQ} numberOfLines={expanded === i ? undefined : 1}>{faq.q}</Text>
              <Text style={{ fontSize: 18, color: colors.textMuted }}>{expanded === i ? '−' : '+'}</Text>
            </View>
            {expanded === i && <Text style={styles.faqA}>{faq.a}</Text>}
          </TouchableOpacity>
        ))}

        {/* Submit ticket */}
        <Text style={styles.sectionTitle}>Submit a Support Ticket</Text>
        <View style={styles.ticketForm}>
          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput
            style={styles.fieldInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. Issue with my booking"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Support ticket subject"
          />
          <Text style={[styles.fieldLabel, { marginTop: spacing[3] }]}>Description</Text>
          <TextInput
            style={[styles.fieldInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your issue in detail…"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            accessibilityLabel="Support ticket description"
          />
          <Button onPress={submitTicket} loading={submitting} fullWidth style={{ marginTop: spacing[4] }}>
            Submit Ticket
          </Button>
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
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
  contactRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[6] },
  contactBtn: { flex: 1, backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], alignItems: 'center', gap: spacing[2], borderWidth: 1, borderColor: colors.borderLight },
  contactLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  sectionTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing[3] },
  faqCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[2] },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3] },
  faqQ: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  faqA: { fontFamily: 'Inter', fontSize: 14, color: colors.textSecondary, marginTop: spacing[2], lineHeight: 21 },
  ticketForm: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[4] },
  fieldLabel: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing[1] },
  fieldInput: { backgroundColor: colors.canvas, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderLight, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontFamily: 'Inter', fontSize: 14, color: colors.textPrimary },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
});
