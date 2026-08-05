import { Alert } from 'react-native';

const REPORT_REASONS = ['Spam', 'Harassment or abuse', 'Something else'];

// Shared by every free-text UGC surface (nudge messages, ask posts, ask
// replies) so Report/Block behave identically everywhere rather than each
// screen inventing its own action-sheet copy.
export function showModerationSheet({
  authorName,
  onReport,
  onBlock,
}: {
  authorName: string;
  onReport: (reason: string) => void;
  onBlock: () => void;
}) {
  Alert.alert(authorName, undefined, [
    {
      text: 'Report',
      onPress: () => {
        // cancelable is the only escape here. Android's Alert keeps
        // buttons.slice(0, 3), so the three reasons fill the dialog and the
        // trailing Cancel is silently discarded - and Alert.alert defaults
        // cancelable to false, which left back and tap-outside dead too.
        // Reporting is a flow people enter by accident; it must be leavable.
        Alert.alert(
          'Why are you reporting this?',
          undefined,
          [
            ...REPORT_REASONS.map((reason) => ({ text: reason, onPress: () => onReport(reason) })),
            { text: 'Cancel', style: 'cancel' as const },
          ],
          { cancelable: true },
        );
      },
    },
    {
      text: `Block ${authorName}`,
      style: 'destructive',
      onPress: () =>
        Alert.alert(`Block ${authorName}?`, "You won't see their posts or messages anymore.", [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: onBlock },
        ]),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
