import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { errorMessage } from '../../src/lib/website';
import { goBack } from '../../src/lib/nav';

const WORDS = ['', 'Poor', 'Could be better', 'Good', 'Very good', 'Excellent'];

// The customer rates the partner after a completed booking. Reached from "Rate & Review" on the booking page.
export default function RateBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [partnerName, setPartnerName] = useState('your partner');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [existing, setExisting] = useState<{ rating: number; comment: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      wagApi.bookings.get(id).catch(() => null),
      wagApi.bookings.getReview(id).catch(() => null),
    ]).then(([b, r]) => {
      const prof: any = (b as any)?.partner?.user?.profile;
      const name = [prof?.firstName, prof?.lastName].filter(Boolean).join(' ');
      if (name) setPartnerName(name);
      if (r) setExisting(r);
    }).finally(() => setLoading(false));
  }, [id]);

  const submit = async () => {
    if (!id || rating < 1) { Alert.alert('Pick a rating', 'Tap the stars to rate your experience.'); return; }
    setSaving(true);
    try {
      const r = await wagApi.bookings.addReview(id, { rating, comment: comment.trim() || undefined });
      setExisting(r);
      Alert.alert('Thank you!', 'Your review has been sent to your partner.', [{ text: 'OK', onPress: () => goBack() }]);
    } catch (err: any) {
      Alert.alert('Could not send your review', errorMessage(err, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const shown = existing ? existing.rating : rating;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Rate your visit</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {loading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : (
            <>
              <Text style={styles.lead}>{existing ? 'Thanks for rating' : 'How was your visit with'}</Text>
              <Text style={styles.name}>{partnerName}</Text>

              <View style={styles.stars} accessibilityRole="radiogroup">
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    disabled={!!existing}
                    onPress={() => setRating(n)}
                    accessibilityRole="radio"
                    accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
                    accessibilityState={{ selected: shown === n }}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Icon name="star" size={44} color={n <= shown ? colors.marigold : colors.borderLight} variant={n <= shown ? 'fill' : undefined} />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.word}>{WORDS[shown] ?? ''}</Text>

              {existing ? (
                existing.comment ? <Text style={styles.comment}>“{existing.comment}”</Text> : null
              ) : (
                <>
                  <Text style={styles.label}>Anything to add? (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={comment}
                    onChangeText={setComment}
                    placeholder="What went well, or what could be better?"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={500}
                    accessibilityLabel="Review comment"
                  />
                  <Text style={styles.count}>{comment.length}/500</Text>
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {!loading && !existing && (
        <View style={styles.footer}>
          <Button onPress={submit} fullWidth loading={saving} disabled={rating < 1}>Submit review</Button>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[6], alignItems: 'center' },
  muted: { fontFamily: 'Inter', color: colors.textMuted, marginTop: spacing[10] },
  lead: { fontFamily: 'Inter', fontSize: 15, color: colors.textMuted, marginTop: spacing[8] },
  name: { fontFamily: 'Inter', fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: spacing[1], textAlign: 'center' },
  stars: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[6] },
  word: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.marigoldDark, marginTop: spacing[3], minHeight: 22 },
  label: { alignSelf: 'flex-start', fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing[8], marginBottom: spacing[2] },
  input: { alignSelf: 'stretch', minHeight: 110, textAlignVertical: 'top', backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.xl, padding: spacing[4], fontFamily: 'Inter', fontSize: 15, color: colors.textPrimary },
  count: { alignSelf: 'flex-end', fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: spacing[1] },
  comment: { fontFamily: 'Inter', fontSize: 15, color: colors.textSecondary, marginTop: spacing[5], textAlign: 'center', fontStyle: 'italic' },
  footer: { padding: spacing[5], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.canvas },
});
