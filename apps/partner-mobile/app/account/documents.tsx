import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import * as ImagePicker from 'expo-image-picker';

const DOC_TYPES = [
  { type: 'aadhaar', label: 'Aadhaar Card', required: true },
  { type: 'pan', label: 'PAN Card', required: false },
  { type: 'police_verification', label: 'Police Verification Certificate', required: true },
  { type: 'photo', label: 'Profile Photo', required: true },
];

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    wagApi.client.get<any[]>('/partners/me/documents').then(setDocuments).catch(() => {});
  }, []);

  const uploadDoc = async (docType: string) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;

    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append('file', { uri: res.assets[0].uri, type: 'image/jpeg', name: `${docType}.jpg' } as any);
      formData.append('docType', docType);
      await wagApi.client.post('/partners/me/documents', formData);
      Alert.alert('Uploaded!', 'Document submitted for verification.');
      wagApi.client.get<any[]>('/partners/me/documents').then(setDocuments).catch(() => {});
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Please try again');
    } finally { setUploading(null); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Documents & Verification</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>📋 Verification typically takes 24–48 hours after document submission.</Text>
        </View>
        {DOC_TYPES.map((dt) => {
          const uploaded = documents.find((d) => d.docType === dt.type);
          return (
            <View key={dt.type} style={styles.docCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>{dt.label}{dt.required && ' *'}</Text>
                {uploaded ? (
                  <Text style={[styles.docStatus, uploaded.verifiedAt ? styles.statusVerified : styles.statusPending]}>
                    {uploaded.verifiedAt ? '✅ Verified' : '⏳ Under Review'}
                  </Text>
                ) : (
                  <Text style={styles.docStatus}>Not submitted</Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.uploadBtn, uploading === dt.type && styles.uploadBtnDisabled]}
                onPress={() => uploadDoc(dt.type)}
                disabled={uploading === dt.type}
                accessibilityLabel={`Upload ${dt.label}`}
              >
                <Text style={styles.uploadBtnText}>{uploading === dt.type ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
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
  infoBanner: { backgroundColor: colors.marigoldBg, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[5] },
  infoText: { fontFamily: 'Inter', fontSize: 14, color: colors.marigoldDark },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[3] },
  docLabel: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  docStatus: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 4 },
  statusVerified: { color: colors.success },
  statusPending: { color: colors.warning },
  uploadBtn: { backgroundColor: colors.brandBrown, borderRadius: radii.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.white },
});
