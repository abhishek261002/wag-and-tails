import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing, TouchableOpacity, Pressable } from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';
import type { Pet } from '@wag/shared-types';
import { Icon, PetAvatar } from '@wag/ui-mobile';
import { colors, spacing, radii } from '@wag/design-tokens';
import { resolveMediaUrl } from '../lib/api';

// Once per app launch: the pop-up is a reminder on opening the app, not on every visit to the home tab.
let shownThisLaunch = false;

const isPending = (p: Pet) => p.vaccination?.state === 'overdue' || p.vaccination?.state === 'due_soon';

/**
 * Shown when the app opens and any pet has a vaccination overdue or due soon. Springs in, the syringe badge pulses,
 * and each pet links to its vaccination records.
 */
export function VaccinationPopup({ pets }: { pets: Pet[] }) {
  const [visible, setVisible] = useState(false);
  const pending = pets.filter(isPending);
  const scale = useRef(new Animated.Value(0.85)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (shownThisLaunch || pending.length === 0) return;
    shownThisLaunch = true;
    // A short delay so the home page paints first.
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [pending.length]);

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.85);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, scale, fade, pulse]);

  if (!visible || pending.length === 0) return null;

  const close = () => setVisible(false);
  const openPet = (p: Pet) => { close(); router.push({ pathname: '/pet/vaccines', params: { id: p.id } }); };
  const anyOverdue = pending.some((p) => p.vaccination?.state === 'overdue');

  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]} accessibilityViewIsModal>
          <Animated.View style={[styles.badge, anyOverdue ? styles.badgeWarn : styles.badgeSoon, { transform: [{ scale: pulse }] }]}>
            <Icon name="syringe" size={26} color={colors.white} />
          </Animated.View>
          <Text style={styles.title}>{anyOverdue ? 'Vaccination overdue' : 'Vaccination due soon'}</Text>
          <Text style={styles.sub}>
            {pending.length === 1 ? `${pending[0]!.name} needs a vaccination.` : `${pending.length} of your pets need a vaccination.`} Book a vet visit, then update the record.
          </Text>

          <View style={styles.list}>
            {pending.slice(0, 4).map((p) => {
              const v = p.vaccination!;
              const overdue = v.state === 'overdue';
              return (
                <TouchableOpacity key={p.id} style={styles.row} onPress={() => openPet(p)} accessibilityRole="button" accessibilityLabel={`${p.name}: ${v.label}. Open vaccination records`}>
                  <PetAvatar name={p.name} imageUrl={resolveMediaUrl(p.avatarUrl)} size={38} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.petName} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.petSub, overdue && styles.petSubWarn]} numberOfLines={1}>
                      {v.nextDueVaccine ?? 'Vaccine'} · {overdue ? 'was due' : 'due'} {v.nextDueDate ? format(new Date(v.nextDueDate), 'd MMM') : ''}
                    </Text>
                  </View>
                  <Icon name="chev" size={15} color={colors.textDisabled} />
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.primary} onPress={() => openPet(pending[0]!)} accessibilityRole="button">
            <Text style={styles.primaryText}>Update records</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={close} accessibilityRole="button">
            <Text style={styles.secondaryText}>Remind me later</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,16,6,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.white, borderRadius: radii['2xl'], paddingHorizontal: spacing[5], paddingBottom: spacing[4], paddingTop: spacing[8], alignItems: 'center' },
  badge: { position: 'absolute', top: -30, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white },
  badgeWarn: { backgroundColor: colors.error },
  badgeSoon: { backgroundColor: colors.marigold },
  title: { fontFamily: 'Inter', fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  sub: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2], lineHeight: 19 },
  list: { alignSelf: 'stretch', marginTop: spacing[4], gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.canvas, borderRadius: radii.lg, padding: spacing[3] },
  petName: { fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  petSub: { fontFamily: 'Inter', fontSize: 12, color: colors.marigoldDark, marginTop: 1 },
  petSubWarn: { color: colors.error },
  primary: { alignSelf: 'stretch', height: 48, borderRadius: radii.lg, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center', marginTop: spacing[4] },
  primaryText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '800', color: colors.white },
  secondary: { alignSelf: 'stretch', height: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing[1] },
  secondaryText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
