import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMeetups, useProposeMeetup, useRsvpMeetup, type MeetupWithRsvps } from '../hooks/useMeetups';
import { PillButton } from './PillButton';
import { categoryColors, colors, radii, shadow } from '../theme/colors';
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
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            style={styles.modalInput}
            value={when}
            onChangeText={setWhen}
            placeholder="When / where (optional)"
            placeholderTextColor={colors.textSecondary}
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
          <TouchableOpacity
            key={status}
            style={[styles.rsvpChip, myRsvp === status && styles.rsvpChipActive]}
            onPress={() => rsvpMeetup.mutate({ meetupId: meetup.id, userId, status })}
          >
            <Text style={[styles.rsvpChipText, myRsvp === status && styles.rsvpChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function MeetUpCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: meetups } = useMeetups(circleId);
  const [proposing, setProposing] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MeetupIcon width={22} height={22} />
          <Text style={styles.title}>Meet Up</Text>
        </View>
        <TouchableOpacity onPress={() => setProposing(true)}>
          <Text style={styles.newLink}>+ Suggest</Text>
        </TouchableOpacity>
      </View>

      {meetups && meetups.length > 0 ? (
        <View style={{ gap: 10 }}>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: categoryColors.learning.bg,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
    ...shadow,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: categoryColors.learning.text },
  newLink: { fontSize: 13, fontWeight: '700', color: categoryColors.learning.text },
  empty: { fontSize: 12, color: categoryColors.learning.text, opacity: 0.8 },
  meetupRow: { backgroundColor: colors.surface, borderRadius: radii.input, padding: 12, gap: 4 },
  meetupTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  meetupNote: { fontSize: 12, color: colors.textSecondary },
  meetupMeta: { fontSize: 11, color: colors.textSecondary },
  rsvpRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  rsvpChip: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rsvpChipActive: { backgroundColor: colors.primary },
  rsvpChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  rsvpChipTextActive: { color: '#fff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
