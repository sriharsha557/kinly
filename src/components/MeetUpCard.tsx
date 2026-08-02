import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMeetups, useProposeMeetup, useRsvpMeetup, type MeetupWithRsvps } from '../hooks/useMeetups';
import { PillButton } from './PillButton';
import { useTheme } from '../theme/ThemeProvider';
import type { RsvpStatus } from '../types/models';
import MeetupIcon from '../../assets/illustrations/kinly-ill-calendar-meetup.svg';

const RSVP_OPTIONS: { status: RsvpStatus; label: string }[] = [
  { status: 'yes', label: "I'm in" },
  { status: 'maybe', label: 'Maybe' },
  { status: 'no', label: "Can't make it" },
];

function ProposeMeetupModal({
  circleId,
  userId,
  onClose,
}: {
  circleId: string;
  userId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const proposeMeetup = useProposeMeetup(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handlePropose() {
    if (!title.trim()) return;
    await proposeMeetup.mutateAsync({ userId, title: title.trim(), note: when.trim() });
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Suggest a meet up</Text>
          <TextInput
            style={styles.modalInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Coffee this weekend?"
            placeholderTextColor={theme.colors.textSecondary}
          />
          <TextInput
            style={styles.modalInput}
            value={when}
            onChangeText={setWhen}
            placeholder="When / where (optional)"
            placeholderTextColor={theme.colors.textSecondary}
          />
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Propose"
              onPress={handlePropose}
              loading={proposeMeetup.isPending}
              disabled={!title.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MeetupRow({ meetup, circleId, userId }: { meetup: MeetupWithRsvps; circleId: string; userId: string }) {
  const rsvpMeetup = useRsvpMeetup(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const myRsvp = meetup.meetup_rsvps.find((r) => r.user_id === userId)?.status;
  const yesCount = meetup.meetup_rsvps.filter((r) => r.status === 'yes').length;

  return (
    <View style={styles.meetupRow}>
      <Text style={styles.meetupTitle}>{meetup.title}</Text>
      {meetup.note ? <Text style={styles.meetupNote}>{meetup.note}</Text> : null}
      <Text style={styles.meetupMeta}>
        {meetup.profiles?.name ?? 'Someone'} · {yesCount} {yesCount === 1 ? 'person is' : 'people are'} in
      </Text>
      <View style={styles.rsvpRow}>
        {RSVP_OPTIONS.map(({ status, label }) => (
          <AnimatedPressable
      accessibilityRole="button"
            key={status}
            style={[styles.rsvpChip, myRsvp === status && styles.rsvpChipActive]}
            onPress={() => rsvpMeetup.mutate({ meetupId: meetup.id, userId, status })}
          >
            <Text style={[styles.rsvpChipText, myRsvp === status && styles.rsvpChipTextActive]}>{label}</Text>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

export function MeetUpCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: meetups } = useMeetups(circleId);
  const [proposing, setProposing] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MeetupIcon width={22} height={22} color={theme.colors.textSecondary} />
          <Text style={styles.title}>Meet Up</Text>
        </View>
        <AnimatedPressable
      accessibilityRole="button" onPress={() => setProposing(true)}>
          <Text style={styles.newLink}>+ Suggest</Text>
        </AnimatedPressable>
      </View>

      {meetups && meetups.length > 0 ? (
        <View style={{ gap: spacing.s10 }}>
          {meetups.map((meetup) => (
            <MeetupRow key={meetup.id} meetup={meetup} circleId={circleId} userId={userId} />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Growth happens offline too — suggest a hangout.</Text>
      )}

      {proposing && (
        <ProposeMeetupModal circleId={circleId} userId={userId} onClose={() => setProposing(false)} />
      )}
    </View>
  );
}

function createStyles({ colors, radii, cardShell, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      ...cardShell,
      padding: spacing.xl,
      paddingLeft: spacing.s18,
      marginBottom: spacing.xl,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { ...type.body, fontFamily: fontFamily.medium, color: colors.shellTitle },
    newLink: { ...type.caption, fontFamily: fontFamily.medium, color: colors.primary },
    empty: { ...type.caption, fontFamily: fontFamily.regular, color: colors.shellSecondary },
    meetupRow: { backgroundColor: colors.inputBg, borderRadius: radii.input, padding: spacing.md, gap: spacing.xs },
    meetupTitle: { ...type.secondary, fontFamily: fontFamily.bold, color: colors.textPrimary },
    meetupNote: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
    meetupMeta: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
    rsvpRow: { flexDirection: 'row', gap: spacing.s6, marginTop: spacing.s6 },
    rsvpChip: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.s10,
      paddingVertical: spacing.s6,
    },
    rsvpChipActive: { backgroundColor: colors.primary },
    rsvpChipText: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    rsvpChipTextActive: { color: colors.onAccent },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      padding: spacing.xl,
      gap: spacing.md,
    },
    modalTitle: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    modalInput: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: spacing.s14,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      ...type.body, fontFamily: fontFamily.regular,
    },
    modalButtons: { flexDirection: 'row', gap: spacing.s10, marginTop: spacing.xs },
  });
}
