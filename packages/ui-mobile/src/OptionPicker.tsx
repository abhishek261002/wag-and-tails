import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@wag/design-tokens';
import { BottomSheet } from './BottomSheet';
import { Input } from './Input';
import { Icon } from './Icon';

export interface OptionPickerProps {
  visible: boolean;
  title: string;
  options: readonly string[];
  value: string | null | undefined;
  onSelect: (value: string) => void;
  onDismiss: () => void;
  searchPlaceholder?: string;
  /** Shown when the search matches nothing, e.g. "Choose Mixed or Other if your pet's breed isn't listed". */
  emptyHint?: string;
  /** Options always kept at the bottom of the list and shown even when the search hides everything else. */
  pinned?: readonly string[];
}

const normalize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w ]/g, '').trim();

/**
 * A searchable single-choice list in a bottom sheet (breeds, cities, ...). Matches on any word of the option, keeps
 * the "Mixed" / "Other" style options reachable at all times, ticks the current choice, and clears the search
 * whenever it opens.
 */
export function OptionPicker({ visible, title, options, value, onSelect, onDismiss, searchPlaceholder = 'Search', emptyHint, pinned = [] }: OptionPickerProps) {
  const [query, setQuery] = useState('');
  useEffect(() => { if (visible) setQuery(''); }, [visible]);

  const { matches, extras } = useMemo(() => {
    const q = normalize(query);
    const pinnedSet = new Set(pinned);
    const regular = options.filter((o) => !pinnedSet.has(o));
    const found = q ? regular.filter((o) => normalize(o).split(' ').some((w) => w.startsWith(q)) || normalize(o).includes(q)) : regular;
    const pinnedFound = pinned.filter((o) => options.includes(o));
    return { matches: found, extras: pinnedFound };
  }, [options, pinned, query]);

  const data = [...matches, ...extras];

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} snapPoints="70%">
      <Text style={styles.title}>{title}</Text>
      <View style={styles.search}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          leftIcon={<Icon name="search" size={16} color={colors.textMuted} />}
          accessibilityLabel={searchPlaceholder}
        />
      </View>
      <FlatList
        style={styles.list}
        data={data}
        keyExtractor={(o) => o}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        ListHeaderComponent={matches.length === 0 && query ? (
          <Text style={styles.empty}>No match for "{query}".{emptyHint ? ` ${emptyHint}` : ''}</Text>
        ) : null}
        renderItem={({ item, index }) => {
          const selected = item === value;
          const firstPinned = extras.length > 0 && index === matches.length;
          return (
            <TouchableOpacity
              style={[styles.row, firstPinned && styles.pinnedDivider]}
              onPress={() => { onSelect(item); onDismiss(); }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.rowText, selected && styles.rowTextSelected]}>{item}</Text>
              {selected && <Icon name="check" size={16} color={colors.brandBrown} />}
            </TouchableOpacity>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: 'Inter', fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing[5], marginBottom: spacing[3] },
  search: { paddingHorizontal: spacing[5], marginBottom: spacing[2] },
  list: { flex: 1, paddingHorizontal: spacing[5] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  pinnedDivider: { borderTopWidth: 6, borderTopColor: colors.biscuitLighter },
  rowText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '600', color: colors.textPrimary },
  rowTextSelected: { color: colors.brandBrown, fontWeight: '800' },
  empty: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, paddingVertical: spacing[3], lineHeight: 19 },
});

