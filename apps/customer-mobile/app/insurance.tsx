import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon, Input, PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import {
  INSURANCE_CALL_TIMES, INSURANCE_CALL_TIME_LABEL, INSURANCE_COVER_AMOUNTS, INSURANCE_COVER_LABEL, INSURANCE_PLAN_LABEL,
  INSURANCE_PLAN_TYPES, INSURANCE_STATUS_LABEL,
  type InsuranceCallTime, type InsuranceCoverAmount, type InsurancePlanType, type Pet,
} from '@wag/shared-types';
import type { MyInsuranceRequest } from '@wag/api-client';
import { wagApi, resolveMediaUrl } from '../src/lib/api';
import { cleanPhone } from '../src/lib/phone';
import { goBack } from '../src/lib/nav';

type Errors = Partial<Record<'pet' | 'ownerName' | 'phone' | 'email' | 'city' | 'preExistingDetails' | 'consent', string>>;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'\-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pet insurance quote request. Our team calls the customer back; staff and admin see it in the panels. */
export default function InsuranceScreen() {
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [mine, setMine] = useState<MyInsuranceRequest[]>([]);
  const [petId, setPetId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [planType, setPlanType] = useState<InsurancePlanType>('comprehensive');
  const [coverAmount, setCoverAmount] = useState<InsuranceCoverAmount>('50000');
  const [preExisting, setPreExisting] = useState<boolean | null>(null);
  const [preExistingDetails, setPreExistingDetails] = useState('');
  const [callTime, setCallTime] = useState<InsuranceCallTime>('any');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    Promise.all([
      wagApi.pets.list(),
      wagApi.client.get<any>('/users/me').catch(() => null),
      wagApi.insurance.mine().catch(() => [] as MyInsuranceRequest[]),
    ]).then(([p, me, m]) => {
      setPets(p);
      setMine(m);
      const open = new Set(m.filter((r) => r.status !== 'closed').map((r) => r.petId));
      setPetId(p.find((x) => !open.has(x.id))?.id ?? null);
      const prof = me?.profile;
      setOwnerName([prof?.firstName, prof?.lastName].filter(Boolean).join(' '));
      setPhone(me?.phone ? String(me.phone).replace(/^\+91/, '') : '');
      setEmail(me?.email ?? '');
      setCity(me?.customerProfile?.city ?? me?.addresses?.[0]?.city ?? '');
    }).catch(() => setPets([]));
  }, []);

  const openFor = (id: string) => mine.find((r) => r.petId === id && r.status !== 'closed');
  const clear = (k: keyof Errors) => setErrors((e) => ({ ...e, [k]: undefined }));

  const submit = async () => {
    if (submitting.current) return;
    const e: Errors = {};
    if (!petId) e.pet = 'Choose a pet';
    const n = ownerName.trim().replace(/\s+/g, ' ');
    if (n.length < 2 || !NAME_RE.test(n)) e.ownerName = 'Please enter your name';
    const ph = cleanPhone(phone);
    if (!ph.ok) e.phone = ph.message;
    if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = 'Please enter a valid email';
    const c = city.trim().replace(/\s+/g, ' ');
    if (c.length < 2 || !NAME_RE.test(c)) e.city = 'Please enter your city';
    if (preExisting === null) e.preExistingDetails = 'Please answer this question';
    else if (preExisting && preExistingDetails.trim().length < 3) e.preExistingDetails = 'Tell us briefly about the condition';
    if (!consent) e.consent = 'Please agree so our team can call you';
    setErrors(e);
    if (Object.keys(e).length) return;

    submitting.current = true;
    setSaving(true);
    try {
      await wagApi.insurance.request({
        petId: petId!,
        ownerName: n,
        phone: ph.ok ? ph.e164 : phone,
        email: email.trim() || null,
        city: c,
        planType,
        coverAmount,
        preExisting: !!preExisting,
        preExistingDetails: preExisting ? preExistingDetails.trim() : null,
        preferredCallTime: callTime,
        notes: notes.trim() || null,
        consent: true,
      });
      setDone(pets?.find((p) => p.id === petId)?.name ?? 'your pet');
    } catch (err: any) {
      Alert.alert('Could not send your request', err?.message ?? 'Please try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}><Icon name="check" size={34} color={colors.white} /></View>
          <Text style={styles.doneTitle}>Request received</Text>
          <Text style={styles.doneBody}>Our insurance team will call you about cover for {done}, usually within one working day.</Text>
          <Button onPress={() => router.replace('/(tabs)/home')} fullWidth style={{ marginTop: spacing[6] }}>Back to home</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack()} accessibilityLabel="Go back"><Icon name="back" size={18} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Pet insurance</Text>
        <View style={{ width: 40 }} />
      </View>

      {pets === null ? (
        <ActivityIndicator style={{ marginTop: spacing[10] }} color={colors.brandBrown} />
      ) : pets.length === 0 ? (
        <View style={styles.doneWrap}>
          <Text style={styles.doneTitle}>Add a pet first</Text>
          <Text style={styles.doneBody}>Insurance is for a specific pet. Add your pet, then come back for a quote.</Text>
          <Button onPress={() => router.push('/pet/add')} fullWidth style={{ marginTop: spacing[6] }}>Add a pet</Button>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <Icon name="shield" size={22} color={colors.success} />
              <Text style={styles.heroText}>Cover vet bills for accidents and illness. Fill this in and our team will call you with a free quote. No payment now.</Text>
            </View>

            <Text style={styles.section}>Which pet?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[3] }}>
              {pets.map((p) => {
                const open = openFor(p.id);
                const on = petId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.pet, on && styles.petOn, !!open && styles.petLocked]}
                    onPress={() => { if (open) { Alert.alert('Already requested', `We already have your request for ${p.name} (${INSURANCE_STATUS_LABEL[open.status].toLowerCase()}). Our team will call you.`); return; } setPetId(p.id); clear('pet'); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, disabled: !!open }}
                    accessibilityLabel={`${p.name}${open ? ', already requested' : ''}`}
                  >
                    <PetAvatar name={p.name} imageUrl={resolveMediaUrl(p.avatarUrl)} size={44} />
                    <Text style={[styles.petName, on && styles.petNameOn]} numberOfLines={1}>{p.name}</Text>
                    {!!open && <Text style={styles.petTag}>Requested</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {!!errors.pet && <Text style={styles.error}>{errors.pet}</Text>}

            <Text style={styles.section}>Your details</Text>
            <View style={styles.card}>
              <Input label="Name *" value={ownerName} onChangeText={(v) => { setOwnerName(v); clear('ownerName'); }} autoCapitalize="words" maxLength={120} error={errors.ownerName} />
              <View style={{ height: spacing[3] }} />
              <Input label="Mobile number *" value={phone} onChangeText={(v) => { setPhone(v); clear('phone'); }} keyboardType="phone-pad" maxLength={14} error={errors.phone} />
              <View style={{ height: spacing[3] }} />
              <Input label="Email (optional)" value={email} onChangeText={(v) => { setEmail(v); clear('email'); }} keyboardType="email-address" autoCapitalize="none" maxLength={160} error={errors.email} />
              <View style={{ height: spacing[3] }} />
              <Input label="City *" value={city} onChangeText={(v) => { setCity(v); clear('city'); }} autoCapitalize="words" maxLength={60} error={errors.city} />
            </View>

            <Text style={styles.section}>Cover you're looking for</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Plan</Text>
              <View style={styles.chips}>
                {INSURANCE_PLAN_TYPES.map((t) => (
                  <Chip key={t} on={planType === t} label={INSURANCE_PLAN_LABEL[t]} onPress={() => setPlanType(t)} />
                ))}
              </View>
              <Text style={styles.label}>Cover amount</Text>
              <View style={styles.chips}>
                {INSURANCE_COVER_AMOUNTS.map((a) => (
                  <Chip key={a} on={coverAmount === a} label={INSURANCE_COVER_LABEL[a]} onPress={() => setCoverAmount(a)} />
                ))}
              </View>
              <Text style={styles.label}>Any existing illness, injury or surgery? *</Text>
              <View style={styles.chips}>
                <Chip on={preExisting === false} label="No" onPress={() => { setPreExisting(false); clear('preExistingDetails'); }} />
                <Chip on={preExisting === true} label="Yes" onPress={() => { setPreExisting(true); clear('preExistingDetails'); }} />
              </View>
              {preExisting && (
                <View style={{ marginTop: spacing[3] }}>
                  <Input value={preExistingDetails} onChangeText={(v) => { setPreExistingDetails(v); clear('preExistingDetails'); }} placeholder="e.g. skin allergy since 2024, hip surgery" maxLength={1000} multiline />
                </View>
              )}
              {!!errors.preExistingDetails && <Text style={styles.error}>{errors.preExistingDetails}</Text>}
            </View>

            <Text style={styles.section}>When should we call?</Text>
            <View style={styles.card}>
              <View style={styles.chips}>
                {INSURANCE_CALL_TIMES.map((t) => (
                  <Chip key={t} on={callTime === t} label={INSURANCE_CALL_TIME_LABEL[t]} onPress={() => setCallTime(t)} />
                ))}
              </View>
              <View style={{ marginTop: spacing[4] }}>
                <Input label="Anything else? (optional)" value={notes} onChangeText={setNotes} placeholder="Questions for our team" maxLength={1000} multiline />
              </View>
            </View>

            <TouchableOpacity style={styles.consent} onPress={() => { setConsent(!consent); clear('consent'); }} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
              <View style={[styles.box, consent && styles.boxOn]}>{consent && <Icon name="check" size={14} color={colors.white} />}</View>
              <Text style={styles.consentText}>I agree to be contacted by Wag & Tails and its insurance partner about pet insurance.</Text>
            </TouchableOpacity>
            {!!errors.consent && <Text style={styles.error}>{errors.consent}</Text>}

            <Button onPress={submit} loading={saving} fullWidth style={{ marginTop: spacing[5] }}>Request a call back</Button>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3] },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
  hero: { flexDirection: 'row', gap: spacing[3], alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radii.xl, padding: spacing[4] },
  heroText: { flex: 1, fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  section: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: spacing[5], marginBottom: spacing[3] },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing[4] },
  label: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: spacing[3], marginBottom: spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { borderRadius: 999, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.white, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  chipOn: { borderColor: colors.brandBrown, backgroundColor: colors.brandBrown },
  chipText: { fontFamily: 'Inter', fontSize: 12.5, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.white },
  pet: { width: 86, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.lg, paddingVertical: spacing[3], paddingHorizontal: spacing[2] },
  petOn: { borderColor: colors.marigold, backgroundColor: colors.marigoldBg },
  petLocked: { opacity: 0.55 },
  petName: { fontFamily: 'Inter', fontSize: 12.5, fontWeight: '700', color: colors.textSecondary, marginTop: spacing[2] },
  petNameOn: { color: colors.textPrimary },
  petTag: { fontFamily: 'Inter', fontSize: 10, fontWeight: '800', color: colors.success, marginTop: 2 },
  error: { fontFamily: 'Inter', fontSize: 12, color: colors.error, marginTop: 6 },
  consent: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start', marginTop: spacing[5] },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderMedium, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  consentText: { flex: 1, fontFamily: 'Inter', fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  doneTitle: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  doneBody: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2], lineHeight: 20 },
});
