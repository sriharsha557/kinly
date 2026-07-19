import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLifeTimeline, type TimelineEntry } from '../hooks/useLifeTimeline';
import { categoryColors, colors, radii, shadow } from '../theme/colors';

// Same two event types TodayScreen's Circle Activity already uses for
// goal_completed/streak - reused here rather than inventing a separate
// palette, since achievements don't carry a goal category (health/wealth/
// etc.) to key categoryColors off of.
const ENTRY_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  goal_completed: { bg: categoryColors.health.bg, text: categoryColors.health.text, icon: '✅' },
  streak: { bg: '#FFE4D6', text: '#C2410C', icon: '🔥' },
};

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function relativeDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface MonthGroup {
  label: string;
  entries: TimelineEntry[];
}

// Entries already arrive newest-first from the query, so a single linear
// pass groups them into months without a separate sort.
function groupByMonth(entries: TimelineEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const entry of entries) {
    const label = monthLabel(entry.achieved_at);
    const current = groups[groups.length - 1];
    if (current?.label === label) {
      current.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }
  return groups;
}

export function LifeTimeline({ userId }: { userId: string }) {
  const { data: entries, isLoading } = useLifeTimeline(userId);

  if (isLoading) return null;

  if (!entries || entries.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>Your story starts with your first goal.</Text>
      </View>
    );
  }

  const groups = groupByMonth(entries);

  return (
    <View style={styles.container}>
      {groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={styles.monthHeader}>{group.label}</Text>
          {group.entries.map((entry, index) => {
            const style = ENTRY_STYLE[entry.type] ?? ENTRY_STYLE.goal_completed;
            return (
              <Animated.View
                key={entry.id}
                entering={FadeInDown.duration(300).delay(index * 30)}
                style={styles.row}
              >
                <View style={[styles.iconBubble, { backgroundColor: style.bg }]}>
                  <Text style={styles.icon}>{style.icon}</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.entryTitle, { color: style.text }]}>{entry.title}</Text>
                  <Text style={styles.entryDate}>{relativeDay(entry.achieved_at)}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  group: { gap: 10 },
  monthHeader: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadow,
  },
  iconBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 16 },
  rowBody: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 14, fontWeight: '600' },
  entryDate: { fontSize: 11, color: colors.textSecondary },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    alignItems: 'center',
    ...shadow,
  },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
