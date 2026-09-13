import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, Icon } from '@wag/ui-mobile';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { format, isToday, isTomorrow } from 'date-fns';

export default function ScheduleScreen() {
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    wagApi.partner.getMyJobs().then((data) => setJobs(data as any[])).catch(() => {});
  }, []);

  const groupedJobs = jobs.reduce((acc: Record<string, any[]>, job) => {
    const date = job.scheduledAt ? new Date(job.scheduledAt).toDateString() : 'Unscheduled';
    if (!acc[date]) acc[date] = [];
    acc[date]!.push(job);
    return acc;
  }, {});

  const sections = Object.entries(groupedJobs).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());

  const dateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'EEEE, d MMM');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="cal" size={36} color={colors.textDisabled} />
          <Text style={styles.emptyText}>No scheduled jobs yet</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={([date]) => date}
          contentContainerStyle={styles.list}
          renderItem={({ item: [dateStr, dayJobs] }) => (
            <View style={styles.daySection}>
              <Text style={styles.dayLabel}>{dateLabel(dateStr)}</Text>
              {(dayJobs as any[]).map((job) => (
                <TouchableOpacity
                  key={job.bookingId}
                  onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.bookingId } })}
                >
                  <Card style={styles.jobCard}>
                    <View style={styles.jobRow}>
                      <Icon name={job.type === 'grooming' ? 'scissors' : 'route'} size={18} color={colors.marigoldDark} />
                      <View style={styles.jobInfo}>
                        <Text style={styles.jobPet}>{job.petName} · {job.petBreed}</Text>
                        {job.scheduledAt && (
                          <Text style={styles.jobTime}>{format(new Date(job.scheduledAt), 'h:mm a')}</Text>
                        )}
                      </View>
                      <Badge
                        variant={job.status === 'completed' ? 'success' : job.status === 'in_progress' ? 'marigold' : 'default'}
                        label={job.status.replace(/_/g, ' ')}
                      />
                    </View>
                    {job.petCareNotes && (
                      <View style={styles.careNoteRow}>
                        <Icon name="doc" size={11} color={colors.textMuted} />
                        <Text style={styles.careNotePreview} numberOfLines={1}>{job.petCareNotes}</Text>
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] },
  title: { fontFamily: 'Inter', fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[10] },
  daySection: { marginBottom: spacing[4] },
  dayLabel: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[2] },
  jobCard: { marginBottom: spacing[2], padding: spacing[4] },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  jobInfo: { flex: 1 },
  jobPet: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  jobTime: { fontFamily: 'Inter', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  careNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing[2] },
  careNotePreview: { flex: 1, fontFamily: 'Inter', fontSize: 12, color: colors.warning },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'Inter', fontSize: 15, color: colors.textMuted, marginTop: spacing[3] },
});
