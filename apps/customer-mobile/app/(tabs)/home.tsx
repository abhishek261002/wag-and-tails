import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PetAvatar, Card, Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../../src/lib/api';
import type { Pet, GroomingBooking, WalkingBooking } from '@wag/shared-types';
import { format } from 'date-fns';
import { HomeNotifications } from '../../src/components/HomeNotifications';
import { ProductCarousel } from '../../src/components/ProductCarousel';
import { VaccinationPopup } from '../../src/components/VaccinationPopup';
import { MOCK_VETS } from '../../src/data/vets';
import { useActiveServices } from '../../src/hooks/useActiveServices';
import { ActiveServicesBanner } from '../../src/components/ActiveServicesBanner';
import { useBookingStore } from '../../src/store/booking.store';

type AnyBooking = GroomingBooking | WalkingBooking;

export default function HomeScreen() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const active = useActiveServices();
  const { updateGroomingDraft, updateWalkDraft } = useBookingStore();
  const [pastBookings, setPastBookings] = useState<AnyBooking[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const load = useCallback(async () => {
    try {
      const [petsData, me] = await Promise.all([
        wagApi.pets.list(),
        wagApi.client.get('/users/me').catch(() => null),
      ]);
      setPets(petsData);
      setProfile(me);
      if (!selectedPetId && petsData.length > 0) setSelectedPetId(petsData[0]!.id);
      active.refresh();
    } catch {
      // silent: offline state shown by empty data
    }
  }, [selectedPetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Past services for whichever pet is selected ("Book again").
  useEffect(() => {
    if (!selectedPetId) { setPastBookings([]); return; }
    let cancelled = false;
    wagApi.bookings.list({ page: 1, pageSize: 6, status: 'completed', petId: selectedPetId })
      .then((r) => { if (!cancelled) setPastBookings(r.data ?? []); })
      .catch(() => { if (!cancelled) setPastBookings([]); });
    return () => { cancelled = true; };
  }, [selectedPetId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pet = pets.find((p) => p.id === selectedPetId) ?? pets[0] ?? null;
  const firstName = profile?.profile?.firstName ?? 'there';
  const defaultAddress = profile?.addresses?.[0] ?? null;
  const startGroom = () => router.push(pets.length === 0 ? '/pet/add' : '/booking/grooming/select-pet');
  const startWalk = () => router.push(pets.length === 0 ? '/pet/add' : '/booking/walking/select-dog');

  // Start a new booking from a past one: same pet, same package (or walk length), then pick a time.
  const rebook = async (b: any) => {
    const p = pets.find((x) => x.id === b.petId);
    if (!p) return;
    try {
      if (b.type === 'grooming') {
        const pkgs = await wagApi.bookings.getPackages();
        const pkg = pkgs.find((x) => x.id === b.packageId);
        if (!pkg) { Alert.alert('Package unavailable', 'That package is not offered any more. Please choose another.'); router.push('/booking/grooming/select-package'); return; }
        updateGroomingDraft({ petId: p.id, pet: p, packageId: pkg.id, package: pkg, addOnIds: [], addOns: [], scheduledAt: null, discount: 0, couponCode: null, assignmentMode: 'any', requestedPartnerId: null, requestedPartnerName: null, requestedPartnerDiscountPct: null });
        router.push('/booking/grooming/select-date-time');
      } else {
        updateWalkDraft({ petId: p.id, pet: p, durationMinutes: ((b.durationMinutes as 30 | 45 | 60) ?? 30), scheduledAt: null, scheduleNow: true, assignmentMode: 'any', requestedPartnerId: null, requestedPartnerName: null, requestedPartnerDiscountPct: null });
        router.push('/booking/walking/schedule');
      }
    } catch {
      Alert.alert('Could not start the booking', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, active.services.length > 0 && { paddingBottom: 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.marigold} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand-brown hero, matching the prototype's .homehero */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroGreet}>{greeting}</Text>
              <Text style={styles.heroName} numberOfLines={1}>{firstName}</Text>
              {defaultAddress && (
                <TouchableOpacity
                  style={styles.heroLoc}
                  onPress={() => router.push('/account/addresses' as any)}
                  accessibilityLabel="Change address"
                >
                  <Icon name="pin" size={13} color="rgba(255,255,255,0.72)" />
                  <Text style={styles.heroLocText} numberOfLines={1}>
                    {defaultAddress.label} · {defaultAddress.line1}
                  </Text>
                  <Icon name="chevD" size={13} color="rgba(255,255,255,0.72)" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {pets.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petSwitch} contentContainerStyle={{ gap: spacing[4] }}>
              {pets.map((p) => {
                const liveForPet = active.services.find((b) => b.petId === p.id && LIVE_STATUSES.includes(b.status));
                const ringState = liveForPet ? (liveForPet.type === 'walking' ? 'walking' : 'active') : 'idle';
                return (
                  <TouchableOpacity key={p.id} style={styles.petItem} onPress={() => setSelectedPetId(p.id)}>
                    <PetAvatar name={p.name} imageUrl={resolveMediaUrl(p.avatarUrl)} size={62} ringState={ringState as any} />
                    <Text style={[styles.petLabel, p.id === selectedPetId && styles.petLabelActive]} numberOfLines={1}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.petItem} onPress={() => router.push('/pet/add')}>
                <View style={styles.addRing}><Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }}>+</Text></View>
                <Text style={styles.petLabelAdd}>Add pet</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        <View style={styles.body}>
          {/* Pending and ongoing services live in the banner docked at the bottom, not as cards here. */}
          {pets.length === 0 && (
            <Card style={styles.emptyPets} onPress={() => router.push('/pet/add')}>
              <Icon name="paw" size={36} color={colors.brandBrown} />
              <Text style={styles.emptyTitle}>Add your first pet</Text>
              <Text style={styles.emptyBody}>Get grooming, walks and more for your furry friend.</Text>
            </Card>
          )}

          <View style={pets.length === 0 ? { marginTop: spacing[4] } : undefined}>
            <HomeNotifications />
          </View>

          {/* Book a service */}
          <SectionHead title="Book a service" sub="At your home, 7 days a week" />
          <View style={styles.svcRow}>
            <TouchableOpacity style={[styles.svcCard, styles.svcGroom]} onPress={startGroom} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Book grooming, from ₹999">
              <View style={styles.svcTop}>
                <Icon name="scissors" size={20} color={colors.white} />
                <Text style={styles.svcTitle}>Grooming</Text>
              </View>
              <View style={styles.svcCtaRow}>
                <Text style={styles.svcCta}>From ₹999</Text>
                <Icon name="chev" size={12} color={colors.white} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.svcCard, styles.svcWalk]} onPress={startWalk} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Book dog walking, from ₹249">
              <View style={styles.svcTop}>
                <Icon name="paw" size={20} color={colors.brandBrown} />
                <Text style={[styles.svcTitle, styles.svcTitleDark]}>Dog walking</Text>
              </View>
              <View style={styles.svcCtaRow}>
                <Text style={[styles.svcCta, styles.svcCtaDark]}>From ₹249</Text>
                <Icon name="chev" size={12} color={colors.brandBrown} />
              </View>
            </TouchableOpacity>
          </View>

          <ProductCarousel />

          {/* Promo banner */}
          <TouchableOpacity style={styles.promo} onPress={() => router.push('/account/offers')} activeOpacity={0.9}>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>20% off your first groom</Text>
              <Text style={styles.promoSub}>Valid until the end of the month</Text>
            </View>
            <View style={styles.promoCode}><Text style={styles.promoCodeText}>FIRST20</Text></View>
          </TouchableOpacity>

          {/* Ask Dr. Woof: knows all of the customer's pets */}
          <TouchableOpacity
            style={styles.askCard}
            onPress={() => router.push('/dr-woof' as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Ask Dr. Woof, the pet care assistant"
          >
            <View style={styles.askIcon}><Icon name="spark" size={19} color={colors.marigoldDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.askTitle}>Ask Dr. Woof</Text>
              <Text style={styles.askSub}>{pets.length > 1 ? 'Questions about your pets, health and care' : pet ? `Questions about ${pet.name}, health and care` : 'Pet health, food and behaviour questions'}</Text>
            </View>
            <Icon name="chev" size={17} color={colors.textDisabled} />
          </TouchableOpacity>

          {/* Pet insurance enquiry */}
          <TouchableOpacity
            style={styles.askCard}
            onPress={() => router.push('/insurance' as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Pet insurance. Get a quote"
          >
            <View style={[styles.askIcon, { backgroundColor: colors.successLight }]}><Icon name="shield" size={19} color={colors.success} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.askTitle}>Pet insurance</Text>
              <Text style={styles.askSub}>Cover vet bills. Get a free quote in 2 minutes</Text>
            </View>
            <Icon name="chev" size={17} color={colors.textDisabled} />
          </TouchableOpacity>

          {/* Book again: this pet's past services */}
          {pet && pastBookings.length > 0 && (
            <>
              <View style={styles.sectionHeadRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Book again</Text>
                  <Text style={styles.sectionSub}>Past services for {pet.name}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/bookings' as any)} accessibilityLabel="See all bookings">
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[3] }}>
                {pastBookings.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.rebookCard}
                    onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.rebookTop}>
                      <PetAvatar name={b.petName} imageUrl={resolveMediaUrl(pet.avatarUrl)} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rebookTitle} numberOfLines={1}>{b.type === 'grooming' ? (b as any).packageName ?? 'Grooming' : `${(b as any).durationMinutes ?? 30} min walk`}</Text>
                        <Text style={styles.rebookSub} numberOfLines={1}>{b.petName} · {format(new Date((b as any).scheduledAt ?? (b as any).createdAt), 'dd MMM')}</Text>
                      </View>
                    </View>
                    <View style={styles.rebookBottom}>
                      <Text style={styles.rebookPrice}>₹{Number((b as any).total ?? 0)}</Text>
                      <TouchableOpacity style={styles.rebookBadge} onPress={() => rebook(b)} accessibilityLabel="Rebook">
                        <Text style={styles.rebookBadgeText}>Rebook</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Trust card */}
          <Card style={styles.trustCard}>
            <View style={styles.trustRow}>
              <View style={styles.trustIcon}><Icon name="shield" size={19} color={colors.success} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>Every partner is verified</Text>
                <Text style={styles.trustSub}>ID checked, police verified and trained on handling anxious dogs.</Text>
              </View>
            </View>
            <View style={styles.metrics}>
              <Metric v="4.9" k="Avg rating" />
              <Metric v="12k+" k="Grooms done" />
              <Metric v="98%" k="On time" />
              <Metric v={String(MOCK_VETS.length)} k="Vets" onPress={() => router.push('/vets' as any)} />
            </View>
          </Card>

          <TouchableOpacity style={styles.helpRow} onPress={() => router.push('/support')}>
            <View style={styles.helpIconBox}><Icon name="help" size={19} color={colors.brandBrown} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.helpTitle}>Help & support</Text>
              <Text style={styles.helpSub}>FAQs, booking issues, contact us</Text>
            </View>
            <Icon name="chev" size={17} color={colors.textDisabled} />
          </TouchableOpacity>

          {/* Coming soon */}
          <View style={styles.soon} accessibilityLabel="Blood tests at home, coming soon">
            <Icon name="syringe" size={16} color={colors.brandBrown} />
            <Text style={styles.soonText}><Text style={styles.soonStrong}>Blood tests at home</Text> · coming soon</Text>
            <View style={styles.soonPill}><Text style={styles.soonPillText}>Soon</Text></View>
          </View>
        </View>
      </ScrollView>

      <VaccinationPopup pets={pets} />

      {/* Every pending and ongoing service, docked just above the tab bar */}
      {active.services.length > 0 && (
        <View style={styles.bannerDock} pointerEvents="box-none">
          <ActiveServicesBanner services={active.services} petPhotos={Object.fromEntries(pets.map((p) => [p.id, p.avatarUrl]))} />
        </View>
      )}
    </SafeAreaView>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{sub}</Text>
    </View>
  );
}

function Metric({ v, k, onPress }: { v: string; k: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.metric} onPress={onPress} disabled={!onPress} activeOpacity={0.8} accessibilityRole={onPress ? 'button' : undefined}>
      <Text style={styles.metricV}>{v}</Text>
      <Text style={styles.metricK}>{k}</Text>
    </TouchableOpacity>
  );
}

const LIVE_STATUSES = ['partner_on_the_way', 'arrived', 'in_progress'];

const styles = StyleSheet.create({
  bannerDock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingBottom: spacing[10] },

  hero: { backgroundColor: colors.brandBrown, paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[6] },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroGreet: { fontFamily: 'Inter', fontSize: 12.5, color: 'rgba(255,255,255,0.62)' },
  heroName: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 23, fontWeight: '800', color: colors.white, marginTop: 2, letterSpacing: -0.4 },
  heroLoc: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing[2], alignSelf: 'flex-start' },
  heroLocText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.72)', maxWidth: 200 },
  petSwitch: { marginTop: spacing[4] },
  petItem: { alignItems: 'center', width: 66 },
  petLabel: { fontFamily: 'Inter', fontSize: 11.5, fontWeight: '600', marginTop: spacing[2], color: 'rgba(255,255,255,0.62)' },
  petLabelActive: { color: colors.white },
  petLabelAdd: { fontFamily: 'Inter', fontSize: 11.5, fontWeight: '600', marginTop: spacing[2], color: 'rgba(255,255,255,0.55)' },
  addRing: { width: 62, height: 62, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: spacing[5], marginTop: -16 },
  emptyPets: { alignItems: 'center', paddingVertical: spacing[7] },
  emptyTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: spacing[3] },
  emptyBody: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing[1] },

  liveCard: { padding: spacing[4] },
  liveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  eyebrow: { fontFamily: 'Inter', fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.marigoldMid, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.white },
  livePillText: { color: colors.white, fontSize: 10.5, fontWeight: '700' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  liveTitle: { fontFamily: 'Inter', fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  liveSub: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  miniBtn: { backgroundColor: colors.brandBrown, borderRadius: radii.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  miniBtnText: { color: colors.white, fontFamily: 'Inter', fontSize: 12.5, fontWeight: '700' },

  sectionHead: { marginTop: spacing[6], marginBottom: spacing[3] },
  sectionTitle: { fontFamily: 'Inter', fontSize: 17, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.25 },
  sectionSub: { fontFamily: 'Inter', fontSize: 12.5, color: colors.textMuted, marginTop: 2 },

  svcRow: { flexDirection: 'row', gap: spacing[3] },
  svcCard: { flex: 1, borderRadius: radii.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], minHeight: 78, justifyContent: 'space-between', gap: spacing[2] },
  svcTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  svcGroom: { backgroundColor: colors.brandBrownSecondary },
  svcWalk: { backgroundColor: colors.biscuitLight },
  svcTitle: { fontFamily: 'Inter', fontSize: 15.5, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
  svcTitleDark: { color: colors.brand800 ?? colors.textPrimary },
  svcCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  svcCta: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', color: colors.white },
  svcCtaDark: { color: colors.brandBrown },

  promo: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.marigoldMid, borderRadius: radii.lg, padding: spacing[4], marginTop: spacing[4] },
  promoTitle: { fontFamily: 'Inter', fontSize: 14.5, fontWeight: '700', color: colors.white },
  promoSub: { fontFamily: 'Inter', fontSize: 11.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  promoCode: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radii.xs, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderStyle: 'dashed', paddingHorizontal: 10, paddingVertical: 5 },
  promoCodeText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },

  askCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.lg, padding: spacing[4], marginTop: spacing[4] },
  askIcon: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  askTitle: { fontFamily: 'Inter', fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  askSub: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  chev: { fontSize: 20, color: colors.textDisabled },

  sectionHeadRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing[5], marginBottom: spacing[3] },
  seeAll: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.marigoldDark },
  rebookCard: { width: 236, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.xl, padding: spacing[4], gap: spacing[3] },
  rebookTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rebookSub: { fontFamily: 'Inter', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rebookBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rebookPrice: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  rebookTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  rebookBadge: { backgroundColor: colors.biscuitLight, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  rebookBadgeText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '800', color: colors.brandBrown },

  trustCard: { backgroundColor: colors.surfaceAlt, borderColor: 'transparent', marginTop: spacing[6], padding: spacing[4] },
  trustRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  trustIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' },
  trustTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  trustSub: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  metrics: { flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radii.md, overflow: 'hidden' },
  metric: { flex: 1, backgroundColor: colors.white, paddingVertical: spacing[3], alignItems: 'center', gap: 2 },
  metricV: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  metricK: { fontFamily: 'Inter', fontSize: 9.5, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted },

  helpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[5] },
  helpIconBox: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: colors.biscuitLighter, alignItems: 'center', justifyContent: 'center' },
  helpTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  soon: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: colors.biscuitLighter, borderRadius: radii.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginTop: spacing[5] },
  soonText: { flex: 1, fontFamily: 'Inter', fontSize: 12.5, color: colors.textSecondary },
  soonStrong: { fontWeight: '800', color: colors.textPrimary },
  soonPill: { backgroundColor: colors.brandBrown, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  soonPillText: { fontFamily: 'Inter', fontSize: 10, fontWeight: '800', color: colors.white, letterSpacing: 0.4 },
  helpSub: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
});
