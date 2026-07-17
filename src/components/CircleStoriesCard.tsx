import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useActiveStory, useAddStoryLine, useStartStory, STORY_LINE_CAP } from '../hooks/useStories';
import { randomStoryPrompt } from '../lib/storyPrompts';
import { PillButton } from './PillButton';
import { categoryColors, colors, radii, shadow } from '../theme/colors';

export function CircleStoriesCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: story } = useActiveStory(circleId);
  const startStory = useStartStory(circleId);
  const addLine = useAddStoryLine(circleId);
  const [draft, setDraft] = useState('');

  async function handleStart() {
    await startStory.mutateAsync({ userId, prompt: randomStoryPrompt() });
  }

  async function handleAddLine() {
    if (!draft.trim() || !story) return;
    await addLine.mutateAsync({
      storyId: story.id,
      userId,
      text: draft.trim(),
      currentLineCount: story.story_lines.length,
    });
    setDraft('');
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>✍️ Circle Stories</Text>

      {!story ? (
        <>
          <Text style={styles.empty}>Build a silly story together, one sentence at a time.</Text>
          <PillButton label="Start a story" onPress={handleStart} loading={startStory.isPending} style={{ marginTop: 10 }} />
        </>
      ) : (
        <>
          <Text style={styles.prompt}>{story.prompt}</Text>
          <View style={styles.lines}>
            {story.story_lines.map((line) => (
              <Text key={line.id} style={styles.line}>
                <Text style={styles.lineAuthor}>{line.profiles?.name ?? 'Someone'}: </Text>
                {line.text}
              </Text>
            ))}
          </View>
          <Text style={styles.progress}>
            {story.story_lines.length}/{STORY_LINE_CAP} sentences
          </Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add the next sentence..."
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddLine} disabled={addLine.isPending}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </>
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
  title: { fontSize: 16, fontWeight: '700', color: categoryColors.learning.text, marginBottom: 8 },
  empty: { fontSize: 12, color: categoryColors.learning.text, opacity: 0.8 },
  prompt: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  lines: { gap: 4, marginBottom: 8 },
  line: { fontSize: 13, color: colors.textPrimary },
  lineAuthor: { fontWeight: '700' },
  progress: { fontSize: 11, color: colors.textSecondary, marginBottom: 8 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
