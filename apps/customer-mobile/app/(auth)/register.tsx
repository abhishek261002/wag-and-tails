import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, TextInput,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon, Input, OptionPicker } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import {
  BREEDS_BY_SPECIES, MAX_PET_AGE_YEARS, MAX_SIGNUP_PETS, OPERATING_CITIES, SPECIES_LABEL,
  type PetSpecies, type SignupPetInput,
} from '@wag/shared-types';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';
import { goBack } from '../../src/lib/nav';

type PetDraft = {
  key: string;
  name: string;
  species: PetSpecies | null;
  breed: string;
  ageYears: string;
  ageMonths: string;
  sex: 'male' | 'female' | null;
};
type PetErrors = Partial<Record<'name' | 'species' | 'breed' | 'age' | 'sex', string>>;

const NAME_RE = /^[\p{L}][\p{L}\p{M} .'\-]*$/u;
const OTHER_CITY = 'Other city';
let keyCounter = 0;
const newPet = (): PetDraft => ({ key: `p${++keyCounter}`, name: '', species: null, breed: '', ageYears: '', ageMonths: '', sex: null });
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 2);

function petErrors(p: PetDraft): PetErrors {
  const e: PetErrors = {};
  if (!p.name.trim()) e.name = "Enter your pet's name";
  if (!p.species) e.species = 'Choose dog or cat';
  if (p.species && !p.breed) e.breed = 'Choose a breed';
  if (!p.ageYears && !p.ageMonths) e.age = "Enter your pet's age";
  else {
    const y = p.ageYears ? parseInt(p.ageYears, 10) : 0;
    const m = p.ageMonths ? parseInt(p.ageMonths, 10) : 0;
    if (y > MAX_PET_AGE_YEARS) e.age = `Age can be at most ${MAX_PET_AGE_YEARS} years`;
    else if (m > 11) e.age = 'Months must be 0 to 11';
  }
  if (!p.sex) e.sex = 'Choose male or female';
  return e;
}

/**
 * Account creation after the phone OTP, in two steps: who you are (name and city, both required) and your pets
 * (at least one is required; more are optional). The server creates the account, profile and pets together.
 */
export default function RegisterScreen() {
  const { phone, otp, fromLogin } = useLocalSearchParams<{ phone: string; otp: string; fromLogin?: string }>();
  const { setTokens } = useAuthStore();

  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState('');
  const [cityChoice, setCityChoice] = useState<string>('');
  const [otherCity, setOtherCity] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; city?: string }>({});

  const [pets, setPets] = useState<PetDraft[]>([newPet()]);
  const [petErrs, setPetErrs] = useState<Record<string, PetErrors>>({});
  const [breedFor, setBreedFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const scroller = useRef<ScrollView>(null);

  // Opened without the verified phone and code (reload or stale link): start again from the login screen.
  if (!phone || !otp) return <Redirect href="/(auth)/login" />;

  const city = (cityChoice === OTHER_CITY ? otherCity : cityChoice).trim().replace(/\s+/g, ' ');

  const validateStep0 = () => {
    const e: { name?: string; city?: string } = {};
    const n = name.trim().replace(/\s+/g, ' ');
    if (n.length < 2) e.name = 'Please enter your name';
    else if (!NAME_RE.test(n)) e.name = "Names can only contain letters, spaces and . ' -";
    if (!cityChoice) e.city = 'Please choose your city';
    else if (cityChoice === OTHER_CITY && !(city.length >= 2 && NAME_RE.test(city))) e.city = 'Please enter your city';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updatePet = (key: string, patch: Partial<PetDraft>) => {
    setPets((cur) => cur.map((p) => {
      if (p.key !== key) return p;
      const next = { ...p, ...patch };
      // Breeds differ per species: a breed picked for the other one is cleared.
      if (patch.species && patch.species !== p.species) next.breed = '';
      return next;
    }));
    setPetErrs((cur) => ({ ...cur, [key]: {} }));
  };

  const addPet = () => {
    if (pets.length >= MAX_SIGNUP_PETS) return;
    setPets((cur) => [...cur, newPet()]);
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
  };
  const removePet = (key: string) => setPets((cur) => (cur.length > 1 ? cur.filter((p) => p.key !== key) : cur));

  const errMsg = (err: any): string => {
    const raw: string = err?.message ?? '';
    // "pets.1.breed: ..." -> "Pet 2: breed: ..."
    return raw.replace(/pets\.(\d+)\.?/g, (_m: string, i: string) => `Pet ${Number(i) + 1}: `) || 'Please check your details and try again.';
  };

  const submit = async () => {
    if (submitting.current) return;
    // Validate every pet at once, so all problems show together.
    const all: Record<string, PetErrors> = {};
    let firstBad = -1;
    pets.forEach((p, i) => { const e = petErrors(p); if (Object.keys(e).length) { all[p.key] = e; if (firstBad < 0) firstBad = i; } });
    setPetErrs(all);
    if (firstBad >= 0) { Alert.alert('Almost there', pets.length > 1 ? `Please complete the details for pet ${firstBad + 1}.` : "Please complete your pet's details."); return; }

    submitting.current = true;
    setLoading(true);
    try {
      const body = {
        phone: phone!,
        otp: otp!,
        name: name.trim().replace(/\s+/g, ' '),
        city,
        pets: pets.map((p): SignupPetInput => ({
          name: p.name.trim().replace(/\s+/g, ' '),
          species: p.species!,
          breed: p.breed,
          sex: p.sex!,
          ageYears: p.ageYears ? parseInt(p.ageYears, 10) : 0,
          ageMonths: p.ageMonths ? parseInt(p.ageMonths, 10) : 0,
        })),
      };
      const res = await wagApi.auth.register(body);
      await setTokens(res.tokens.accessToken, res.tokens.refreshToken, res.user.id, res.user.role);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 409) {
        Alert.alert('Account exists', errMsg(err), [{ text: 'Go to login', onPress: () => router.replace('/(auth)/login') }]);
      } else if (status === 401) {
        Alert.alert('Code expired', 'Your verification code has expired. Please verify your number again.', [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]);
      } else {
        Alert.alert('Could not create your account', errMsg(err));
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const picking = pets.find((p) => p.key === breedFor);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => (step === 1 ? setStep(0) : goBack('/(auth)/login'))} accessibilityLabel="Go back" style={styles.backBtn}>
            <Icon name="back" size={20} color={colors.brandBrown} />
          </TouchableOpacity>
          <View style={styles.steps}>
            {[0, 1].map((i) => <View key={i} style={[styles.stepBar, i <= step && styles.stepBarOn]} />)}
          </View>
          <Text style={styles.stepLabel}>Step {step + 1} of 2</Text>
        </View>

        <ScrollView ref={scroller} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                {fromLogin ? "We couldn't find an account for this number, so let's create one. " : ''}Tell us a bit about yourself.
              </Text>

              <View style={styles.card}>
                <Input label="Your name *" value={name} onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: undefined })); }} placeholder="e.g. Aarav Mehta" autoCapitalize="words" maxLength={120} error={errors.name} accessibilityLabel="Your name" />

                <Text style={styles.label}>City *</Text>
                <TouchableOpacity style={[styles.select, !!errors.city && styles.selectError]} onPress={() => setCityOpen(true)} accessibilityRole="button" accessibilityLabel="Choose your city">
                  <Text style={cityChoice ? styles.selectValue : styles.selectPlaceholder}>{cityChoice ? (cityChoice === OTHER_CITY ? 'Other city' : cityChoice) : 'Choose your city'}</Text>
                  <Icon name="chev" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                {cityChoice === OTHER_CITY && (
                  <View style={{ marginTop: spacing[3] }}>
                    <Input value={otherCity} onChangeText={(v) => { setOtherCity(v); setErrors((e) => ({ ...e, city: undefined })); }} placeholder="Type your city" autoCapitalize="words" maxLength={60} accessibilityLabel="Your city" />
                  </View>
                )}
                {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
                <Text style={styles.hint}>Your address isn't needed now. You'll add it when you book.</Text>
              </View>

              <Button onPress={() => { if (validateStep0()) setStep(1); }} fullWidth style={{ marginTop: spacing[5] }}>Continue</Button>
            </>
          ) : (
            <>
              <Text style={styles.title}>Add your pet</Text>
              <Text style={styles.subtitle}>Add at least one pet to finish. You can add more now or later from the Pets tab.</Text>

              {pets.map((p, i) => {
                const e = petErrs[p.key] ?? {};
                const noun = p.species ? p.species === 'dog' ? 'dog' : 'cat' : 'pet';
                return (
                  <View key={p.key} style={styles.card}>
                    <View style={styles.petHead}>
                      <Text style={styles.petTitle}>Pet {i + 1}{i === 0 ? ' (required)' : ' (optional)'}</Text>
                      {pets.length > 1 && (
                        <TouchableOpacity onPress={() => removePet(p.key)} accessibilityLabel={`Remove pet ${i + 1}`}><Text style={styles.remove}>Remove</Text></TouchableOpacity>
                      )}
                    </View>

                    <Input label="Pet's name *" value={p.name} onChangeText={(v) => updatePet(p.key, { name: v })} placeholder="e.g. Simba" autoCapitalize="words" maxLength={60} error={e.name} accessibilityLabel={`Pet ${i + 1} name`} />

                    <Text style={styles.label}>Pet type *</Text>
                    <View style={styles.seg}>
                      {(['dog', 'cat'] as PetSpecies[]).map((s) => (
                        <TouchableOpacity key={s} style={[styles.segBtn, p.species === s && styles.segBtnOn]} onPress={() => updatePet(p.key, { species: s })} accessibilityRole="radio" accessibilityState={{ selected: p.species === s }}>
                          <Text style={[styles.segText, p.species === s && styles.segTextOn]}>{SPECIES_LABEL[s]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {!!e.species && <Text style={styles.errorText}>{e.species}</Text>}

                    <Text style={styles.label}>Pet breed *</Text>
                    <TouchableOpacity
                      style={[styles.select, !!e.breed && styles.selectError, !p.species && styles.selectDisabled]}
                      onPress={() => p.species && setBreedFor(p.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Pet ${i + 1} breed`}
                    >
                      <Text style={p.breed ? styles.selectValue : styles.selectPlaceholder}>{p.breed || (p.species ? `Choose a ${noun} breed` : 'Choose dog or cat first')}</Text>
                      <Icon name="chev" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    {!!e.breed && <Text style={styles.errorText}>{e.breed}</Text>}

                    <Text style={styles.label}>Pet age *</Text>
                    <View style={styles.ageRow}>
                      <View style={styles.ageBox}>
                        <TextInput style={styles.ageInput} value={p.ageYears} onChangeText={(v) => updatePet(p.key, { ageYears: digits(v) })} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={2} accessibilityLabel={`Pet ${i + 1} age in years`} />
                        <Text style={styles.ageUnit}>years</Text>
                      </View>
                      <View style={styles.ageBox}>
                        <TextInput style={styles.ageInput} value={p.ageMonths} onChangeText={(v) => updatePet(p.key, { ageMonths: digits(v) })} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={2} accessibilityLabel={`Pet ${i + 1} age in months`} />
                        <Text style={styles.ageUnit}>months</Text>
                      </View>
                    </View>
                    {!!e.age && <Text style={styles.errorText}>{e.age}</Text>}

                    <Text style={styles.label}>Pet gender *</Text>
                    <View style={styles.seg}>
                      {([['male', 'Male'], ['female', 'Female']] as const).map(([v, label]) => (
                        <TouchableOpacity key={v} style={[styles.segBtn, p.sex === v && styles.segBtnOn]} onPress={() => updatePet(p.key, { sex: v })} accessibilityRole="radio" accessibilityState={{ selected: p.sex === v }}>
                          <Text style={[styles.segText, p.sex === v && styles.segTextOn]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {!!e.sex && <Text style={styles.errorText}>{e.sex}</Text>}
                  </View>
                );
              })}

              {pets.length < MAX_SIGNUP_PETS && (
                <TouchableOpacity style={styles.addPet} onPress={addPet} accessibilityRole="button" accessibilityLabel="Add another pet">
                  <Icon name="plus" size={18} color={colors.brandBrown} />
                  <Text style={styles.addPetText}>Add another pet</Text>
                </TouchableOpacity>
              )}

              <Button onPress={submit} loading={loading} fullWidth style={{ marginTop: spacing[5] }}>Create account</Button>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionPicker
        visible={cityOpen}
        title="Choose your city"
        options={[...OPERATING_CITIES, OTHER_CITY]}
        value={cityChoice}
        onSelect={(c) => { setCityChoice(c); setErrors((e) => ({ ...e, city: undefined })); }}
        onDismiss={() => setCityOpen(false)}
        searchPlaceholder="Search cities"
      />
      <OptionPicker
        visible={!!picking}
        title={`Choose a ${picking?.species ?? 'pet'} breed`}
        options={picking?.species ? BREEDS_BY_SPECIES[picking.species] : []}
        pinned={['Mixed', 'Other']}
        value={picking?.breed}
        onSelect={(b) => picking && updatePet(picking.key, { breed: b })}
        onDismiss={() => setBreedFor(null)}
        searchPlaceholder="Search breeds"
        emptyHint="If your pet's breed isn't listed, choose Mixed or Other below."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[2] },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.biscuitLight, alignItems: 'center', justifyContent: 'center' },
  steps: { flex: 1, flexDirection: 'row', gap: 6 },
  stepBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.borderLight },
  stepBarOn: { backgroundColor: colors.marigold },
  stepLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.textMuted },
  container: { padding: spacing[5], paddingBottom: spacing[12] },
  title: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textMuted, marginTop: spacing[1], marginBottom: spacing[5], lineHeight: 22 },
  card: { backgroundColor: colors.white, borderRadius: radii['2xl'], padding: spacing[5], borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing[4] },
  label: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: spacing[4], marginBottom: spacing[2] },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.md, backgroundColor: colors.white, paddingHorizontal: spacing[4] },
  selectError: { borderColor: colors.error },
  selectDisabled: { opacity: 0.55 },
  selectValue: { fontFamily: 'Inter', fontSize: 15, color: colors.textPrimary },
  selectPlaceholder: { fontFamily: 'Inter', fontSize: 15, color: colors.textMuted },
  errorText: { fontFamily: 'Inter', fontSize: 12, color: colors.error, marginTop: 4 },
  hint: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: spacing[3] },
  petHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  petTitle: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  remove: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.error },
  seg: { flexDirection: 'row', backgroundColor: colors.biscuitLight, borderRadius: radii.lg, padding: 4 },
  segBtn: { flex: 1, height: 42, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: colors.brandBrown },
  segText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  segTextOn: { color: colors.white },
  ageRow: { flexDirection: 'row', gap: spacing[3] },
  ageBox: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.md, backgroundColor: colors.white, paddingHorizontal: spacing[4] },
  ageInput: { flex: 1, fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary, padding: 0 },
  ageUnit: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted },
  addPet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], height: 52, borderRadius: radii.xl, borderWidth: 2, borderColor: colors.borderMedium, borderStyle: 'dashed' },
  addPetText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.brandBrown },
});
