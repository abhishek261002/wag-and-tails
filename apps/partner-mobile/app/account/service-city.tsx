import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { goBack } from '../../src/lib/nav';

// Operations run in exactly these three cities — jobs are dispatched to
// every online, mode-matched partner in the customer's city, not by
// distance, so a partner just needs to pick which one they work in.
const CITY_OPTIONS = ['Kanpur', 'Lucknow', 'Delhi'];

export default function ServiceCityScreen() {
  const [current, setCurrent] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    wagApi.partner.getProfile().then((p: any) => {
      const c = p?.city ?? null;
      setCurrent(c); setSelected(c);
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await wagApi.partner.updateProfile({ city: selected });
      setCurrent(selected);
      Alert.alert('Saved!', `Service city updated to ${selected}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Service City</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.desc}>You'll only see and receive jobs booked in this city. We currently operate in Kanpur, Lucknow, and Delhi.</Text>
        <View style={styles.optionsList}>
          {CITY_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.option, selected === c && styles.optionActive]}
              onPress={() => setSelected(c)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selected === c }}
            >
              <Text style={[styles.optionLabel, selected === c && styles.optionLabelActive]}>{c}</Text>
              {selected === c && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Current: {current ?? 'Not set'}</Text>
        </View>
        <Button onPress={save} loading={saving} fullWidth disabled={!selected || selected === current}>Save City</Button>
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
  desc: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginBottom: spacing[5] },
  optionsList: { gap: spacing[3], marginBottom: spacing[5] },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingVertical: spacing[4], borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white },
  optionActive: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  optionLabel: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  optionLabelActive: { color: colors.marigoldDark },
  checkmark: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.marigoldDark },
  infoBox: { backgroundColor: colors.biscuitLight, borderRadius: radii.lg, padding: spacing[4], marginBottom: spacing[4] },
  infoText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.brandBrown, textAlign: 'center' },
});
