import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

const VIDEO_SOURCE = require('../../assets/applaunch.mp4');
// Fallback in case playback events never fire (e.g. a corrupt/unsupported file) -
// the app must never get stuck behind this screen.
const MAX_DURATION_MS = 8000;

export function LaunchVideoScreen({ onFinish }: { onFinish: () => void }) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(VIDEO_SOURCE, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const endSub = player.addListener('playToEnd', onFinish);
    const errorSub = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') onFinish();
    });
    const timeout = setTimeout(onFinish, MAX_DURATION_MS);
    return () => {
      endSub.remove();
      errorSub.remove();
      clearTimeout(timeout);
    };
  }, [player, onFinish]);

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
      <TouchableOpacity
        style={[styles.skip, { top: insets.top + 12 }]}
        onPress={onFinish}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  skip: {
    position: 'absolute',
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  skipText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
});
