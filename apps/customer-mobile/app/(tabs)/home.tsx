import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PetAvatar, Card, Icon } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi, resolveMediaUrl } from '../../src/lib/api';
import type { Pet, GroomingBooking, WalkingBooking } from '@wag/shared-types';
import { formatRelativeDate } from '../../src/utils/date';

type AnyBooking = GroomingBooking | WalkingBooking;

export default function HomeScreen() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<AnyBooking | null>(null);
  const [pastBookings, setPastBookings] = useState<AnyBooking[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const load = useCallback(async () => {
    try {
      const [petsData, activeData, pastData, me] = await Promise.all([
        wagApi.pets.list(),
        wagApi.bookings.list({ page: 1, pageSize: 1, status: 'confirmed' }),
        wagApi.bookings.list({ page: 1, pageSize: 4, status: 'completed' }),
        wagApi.client.get('/users/me').catch(() => null),
      ]);
      wagApi.client.get<{ count: number }>('/notifications/unread-count').then((r) => setUnreadCount(r.count)).catch(() => {});
      setPets(petsData);
      setProfile(me);
      if (!selectedPetId && petsData.length > 0) setSelectedPetId(petsData[0]!.id);
      setActiveBooking(activeData.data?.[0] ?? null);
      setPastBookings(pastData.data ?? []);
    } catch {
      // silent — offline state shown by empty data
    }
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => router.push('/account/notifications')}
              accessibilityLabel="Notifications"
            >
              <Icon name="bell" size={19} color={colors.white} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
              )}
            </TouchableOpacity>
          </View>

          {pets.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petSwitch} contentContainerStyle={{ gap: spacing[4] }}>
              {pets.map((p) => {
                const isActive = activeBooking?.petId === p.id;
                const ringState = isActive
                  ? (activeBooking!.type === 'walking' ? 'walking' : 'active')
                  : 'idle';
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
          {/* status card, overlapping the hero like the prototype */}
          {pets.length === 0 ? (
            <Card style={styles.emptyPets} onPress={() => router.push('/pet/add')}>
              <Icon name="paw" size={36} color={colors.brandBrown} />
              <Text style={styles.emptyTitle}>Add your first pet</Text>
              <Text style={styles.emptyBody}>Get grooming, walks and more for your furry friend.</Text>
            </Card>
          ) : activeBooking ? (
            <Card style={styles.liveCard} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: activeBooking.id } })}>
              <View style={styles.liveTop}>
                <Text style={styles.eyebrow}>Happening now</Text>
                <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.livePillText}>Live</Text></View>
              </View>
              <View style={styles.liveRow}>
                <PetAvatar name={pets.find((p) => p.id === activeBooking.petId)?.name ?? '?'} size={48} ringState="active" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.liveTitle} numberOfLines={1}>
                    {activeBooking.type === 'grooming' ? 'Grooming' : 'Dog walk'} · {activeBooking.petName}
                  </Text>
                  <Text style={styles.liveSub} numberOfLines={1}>
                    {activeBooking.scheduledAt ? formatRelativeDate(activeBooking.scheduledAt) : activeBooking.status.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
            </Card>
          ) : pet ? (
            <Card style={styles.liveCard} onPress={startGroom}>
              <View style={styles.liveRow}>
                <PetAvatar name={pet.name} imageUrl={resolveMediaUrl(pet.avatarUrl)} size={48} ringState="idle" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.liveTitle}>Nothing booked for {pet.name}</Text>
                  <Text style={styles.liveSub}>Book a groom or a walk to get started</Text>
                </View>
                <View style={styles.miniBtn}><Text style={styles.miniBtnText}>Book</Text></View>
              </View>
            </Card>
          ) : null}

          {/* Book a service */}
          <SectionHead title="Book a service" sub="At your home, 7 days a week" />
          <View style={styles.svcRow}>
            <TouchableOpacity style={[styles.svcCard, styles.svcGroom]} onPress={startGroom} activeOpacity={0.9}>
              <Icon name="scissors" size={30} color={colors.white} />
              <View>
                <Text style={styles.svcTitle}>Grooming</Text>
                <Text style={styles.svcSub}>Bath, trim and styling at home</Text>
              </View>
              <View style={styles.svcCtaRow}>
                <Text style={styles.svcCta}>From ₹999</Text>
                <Icon name="chev" size={13} color={colors.white} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.svcCard, styles.svcWalk]} onPress={startWalk} activeOpacity={0.9}>
              <Icon name="paw" size={30} color={colors.brandBrown} />
              <View>
                <Text style={[styles.svcTitle, styles.svcTitleDark]}>Dog walking</Text>
                <Text style={[styles.svcSub, styles.svcSubDark]}>On demand, tracked live</Text>
              </View>
              <View style={styles.svcCtaRow}>
                <Text style={[styles.svcCta, styles.svcCtaDark]}>From ₹249</Text>
                <Icon name="chev" size={13} color={colors.brandBrown} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Promo banner */}
          <TouchableOpacity style={styles.promo} onPress={() => router.push('/account/offers')} activeOpacity={0.9}>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>20% off your first groom</Text>
              <Text style={styles.promoSub}>Valid until the end of the month</Text>
            </View>
            <View style={styles.promoCode}><Text style={styles.promoCodeText}>FIRST20</Text></View>
          </TouchableOpacity>

          {/* Ask about pet */}
          {pet && (
            <TouchableOpacity
              style={styles.askCard}
              onPress={() => router.push({ pathname: '/chat/[petId]', params: { petId: pet.id } })}
              activeOpacity={0.85}
            >
              <View style={styles.askIcon}><Icon name="spark" size={19} color={colors.marigoldDark} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.askTitle}>Ask about {pet.name}</Text>
                <Text style={styles.askSub}>Coat care, weight, grooming frequency</Text>
              </View>
              <Icon name="chev" size={17} color={colors.textDisabled} />
            </TouchableOpacity>
          )}

          {/* Book again */}
          {pastBookings.length > 0 && (
            <>
              <SectionHead title="Book again" sub="Past services" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[3] }}>
                {pastBookings.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.rebookCard}
                    onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
                  >
                    <PetAvatar name={b.petName} size={38} />
                    <Text style={styles.rebookTitle} numberOfLines={1}>{b.type === 'grooming' ? 'Groom' : 'Walk'} · {b.petName}</Text>
                    <View style={styles.rebookBadge}><Text style={styles.rebookBadgeText}>Rebook</Text></View>
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
        </View>
      </ScrollView>
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

function Metric({ v, k }: { v: string; k: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricV}>{v}</Text>
      <Text style={styles.metricK}>{k}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingBottom: spacing[10] },

  hero: { backgroundColor: colors.brandBrown, paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[6] },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroGreet: { fontFamily: 'Inter', fontSize: 12.5, color: 'rgba(255,255,255,0.62)' },
  heroName: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 23, fontWeight: '800', color: colors.white, marginTop: 2, letterSpacing: -0.4 },
  heroLoc: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing[2], alignSelf: 'flex-start' },
  heroLocText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.72)', maxWidth: 200 },
  bellBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText: { fontFamily: 'Inter', fontSize: 10, fontWeight: '800', color: colors.white },
  bellBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
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
  svcCard: { flex: 1, borderRadius: radii.lg, padding: spacing[4], minHeight: 158, justifyContent: 'space-between' },
  svcGroom: { backgroundColor: colors.brandBrownSecondary },
  svcWalk: { backgroundColor: colors.biscuitLight },
  svcTitle: { fontFamily: 'Inter', fontSize: 17, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
  svcTitleDark: { color: colors.brand800 ?? colors.textPrimary },
  svcSub: { fontFamily: 'Inter', fontSize: 11, color: 'rgba(255,255,255,0.74)', marginTop: 4 },
  svcSubDark: { color: colors.textSecondary },
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

  rebookCard: { width: 170, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.lg, padding: spacing[3], gap: spacing[2] },
  rebookTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  rebookBadge: { alignSelf: 'flex-start', backgroundColor: colors.biscuitLighter, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  rebookBadgeText: { fontFamily: 'Inter', fontSize: 10.5, fontWeight: '700', color: colors.brandBrown },

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
  helpSub: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
});
