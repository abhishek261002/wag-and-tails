import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';

const RADIUS_OPTIONS = [1, 2, 3, 5, 8, 10, 12, 15];

export default function ServiceRadiusScreen() {
  const [current, setCurrent] = useState(5);
  const [selected, setSelected] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    wagApi.partner.getProfile().then((p: any) => {
      const r = p?.serviceRadiusKm ?? 5;
      setCurrent(r); setSelected(r);
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await wagApi.partner.updateProfile({ serviceRadiusKm: selected });
      setCurrent(selected);
      Alert.alert('Saved!', `Service radius updated to ${selected} km`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Service Radius</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.desc}>Jobs within this distance from your current location will appear in your open jobs list.</Text>
        <View style={styles.optionsGrid}>
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.option, selected === r && styles.optionActive]}
              onPress={() => setSelected(r)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selected === r }}
            >
              <Text style={[styles.optionValue, selected === r && styles.optionValueActive]}>{r}</Text>
              <Text style={[styles.optionLabel, selected === r && styles.optionLabelActive]}>km</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Current: {current} km · New: {selected} km</Text>
        </View>
        <Button onPress={save} loading={saving} fullWidth disabled={selected === current}>Save Radius</Button>
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
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginBottom: spacing[5] },
  option: { width: 72, height: 72, borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  optionActive: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  optionValue: { fontFamily: 'Inter', fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  optionValueActive: { color: colors.marigoldDark },
  optionLabel: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted },
  optionLabelActive: { color: colors.marigoldDark },
  infoBox: { backgroundColor: colors.biscuitLight, borderRadius: radii.lg, padding: spacing[4], marginBottom: spacing[4] },
  infoText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.brandBrown, textAlign: 'center' },
});
