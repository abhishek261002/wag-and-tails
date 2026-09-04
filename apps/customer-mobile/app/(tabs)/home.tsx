import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PetAvatar } from '@wag/ui-mobile';
import { Card } from '@wag/ui-mobile';
import { Badge } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import type { Pet, GroomingBooking, WalkingBooking } from '@wag/shared-types';
import { bookingStatusVariantMobile } from '../../src/utils/booking';
import { formatRelativeDate } from '../../src/utils/date';

export default function HomeScreen() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [upcomingBooking, setUpcomingBooking] = useState<GroomingBooking | WalkingBooking | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');

  const hour = new Date().getHours();
  useEffect(() => {
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  const load = useCallback(async () => {
    try {
      const [petsData, bookingsData] = await Promise.all([
        wagApi.pets.list(),
        wagApi.bookings.list({ page: 1, pageSize: 1, status: 'confirmed' }),
      ]);
      setPets(petsData);
      const upcoming = bookingsData.data?.[0] ?? null;
      setUpcomingBooking(upcoming);
    } catch {
      // silent — offline state shown by empty data
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBrown} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.headerSub}>What would you like to do today?</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/account')}
            style={styles.notifBtn}
            accessibilityLabel="Account"
          >
            <Text style={{ fontSize: 22 }}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Pets Row */}
        {pets.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Pets</Text>
              <TouchableOpacity onPress={() => router.push('/pet/add')}>
                <Text style={styles.sectionAction}>+ Add</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pets}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ paddingLeft: spacing[1] }}
              renderItem={({ item: pet }) => (
                <TouchableOpacity
                  style={styles.petItem}
                  onPress={() => router.push({ pathname: '/pet/[id]', params: { id: pet.id } })}
                  accessibilityLabel={`View ${pet.name}'s profile`}
                >
                  <PetAvatar name={pet.name} imageUrl={pet.avatarUrl} size={64} ringState="idle" />
                  <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
                  <Text style={styles.petBreed} numberOfLines={1}>{pet.breed}</Text>
                </TouchableOpacity>
              )}
              ListFooterComponent={
                <TouchableOpacity
                  style={styles.addPetBtn}
                  onPress={() => router.push('/pet/add')}
                  accessibilityLabel="Add a new pet"
                >
                  <Text style={{ fontSize: 28, color: colors.textMuted }}>＋</Text>
                </TouchableOpacity>
              }
            />
          </View>
        )}

        {/* No pets empty state */}
        {pets.length === 0 && (
          <Card style={styles.emptyPets} onPress={() => router.push('/pet/add')}>
            <Text style={{ fontSize: 40 }}>🐶</Text>
            <Text style={styles.emptyTitle}>Add your first pet</Text>
            <Text style={styles.emptyBody}>Get grooming, walks and more for your furry friend</Text>
          </Card>
        )}

        {/* Upcoming Booking */}
        {upcomingBooking && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            <Card
              style={styles.bookingCard}
              onPress={() => router.push({ pathname: '/booking/[id]', params: { id: upcomingBooking.id } })}
            >
              <View style={styles.bookingRow}>
                <View style={styles.bookingIcon}>
                  <Text style={{ fontSize: 28 }}>
                    {upcomingBooking.type === 'grooming' ? '✂️' : '🐾'}
                  </Text>
                </View>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingTitle}>
                    {upcomingBooking.type === 'grooming' ? 'Grooming' : 'Dog Walk'}
                    {' — '}{upcomingBooking.petName}
                  </Text>
                  <Text style={styles.bookingDate}>
                    {upcomingBooking.scheduledAt
                      ? formatRelativeDate(upcomingBooking.scheduledAt)
                      : 'Scheduled'}
                  </Text>
                </View>
                <Badge
                  variant={bookingStatusVariantMobile(upcomingBooking.status)}
                  label={upcomingBooking.status.replace(/_/g, ' ')}
                />
              </View>
            </Card>
          </View>
        )}

        {/* Service Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.serviceGrid}>
            <ServiceCard
              emoji="✂️"
              title="Grooming"
              subtitle="Bath, cut & style"
              color="#FEF3EA"
              accent={colors.marigold}
              onPress={() => {
                if (pets.length === 0) {
                  router.push('/pet/add');
                } else {
                  router.push('/booking/grooming/select-pet');
                }
              }}
            />
            <ServiceCard
              emoji="🐾"
              title="Dog Walking"
              subtitle="30, 45 or 60 mins"
              color="#E8F5E9"
              accent="#2E7D32"
              onPress={() => {
                if (pets.length === 0) {
                  router.push('/pet/add');
                } else {
                  router.push('/booking/walking/select-dog');
                }
              }}
            />
          </View>
          <View style={styles.serviceGrid}>
            <ServiceCard
              emoji="🛒"
              title="Pet Store"
              subtitle="Food, toys & more"
              color="#E3F2FD"
              accent="#1565C0"
              onPress={() => router.push('/(tabs)/store')}
            />
            <ServiceCard
              emoji="🤖"
              title="Pet AI Chat"
              subtitle="Ask your pet anything"
              color="#F3E5F5"
              accent="#7B1FA2"
              onPress={() => {
                if (pets.length > 0) {
                  router.push({ pathname: '/chat/[petId]', params: { petId: pets[0]!.id } });
                } else {
                  router.push('/pet/add');
                }
              }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceCard({
  emoji, title, subtitle, color, accent, onPress,
}: {
  emoji: string; title: string; subtitle: string;
  color: string; accent: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.serviceCard, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={{ fontSize: 32, marginBottom: spacing[2] }}>{emoji}</Text>
      <Text style={[styles.serviceTitle, { color: accent }]}>{title}</Text>
      <Text style={styles.serviceSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: spacing[5], paddingBottom: spacing[4] },
  greeting: { fontFamily: 'Inter', fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.textPrimary },
  headerSub: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight },
  section: { marginBottom: spacing[6] },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  sectionTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  sectionAction: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.marigoldDark, fontWeight: '700' },
  petItem: { alignItems: 'center', marginRight: spacing[4], width: 72 },
  petName: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, fontWeight: '700', color: colors.textPrimary, marginTop: spacing[1], textAlign: 'center' },
  petBreed: { fontFamily: 'Inter', fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  addPetBtn: { width: 64, height: 64, borderRadius: radii.full, borderWidth: 2, borderColor: colors.borderLight, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginRight: spacing[2] },
  emptyPets: { alignItems: 'center', paddingVertical: spacing[8], marginBottom: spacing[5] },
  emptyTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginTop: spacing[3] },
  emptyBody: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing[1] },
  bookingCard: { padding: spacing[4] },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  bookingIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  bookingInfo: { flex: 1 },
  bookingTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary },
  bookingDate: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  serviceGrid: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  serviceCard: { flex: 1, borderRadius: radii.xl, padding: spacing[5], minHeight: 120 },
  serviceTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', marginBottom: 2 },
  serviceSubtitle: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, color: colors.textSecondary },
});
