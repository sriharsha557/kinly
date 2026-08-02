import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
// Aliased because `type` is a modifier keyword in an import clause. This
// screen has no ThemeProvider above it (it plays before the app mounts), so
// it reads the scale from the module rather than from useTheme().
import { fontFamily, spacing, type as typeScale } from '../theme/colors';
import { AnimatedPressable } from '../components/AnimatedPressable';

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
      <AnimatedPressable
        style={[styles.skip, { top: insets.top + 12 }]}
        onPress={onFinish}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
      >
        <Text style={styles.skipText}>Skip</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  skip: {
    position: 'absolute',
    right: 20,
    paddingHorizontal: spacing.s14,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  skipText: { color: 'rgba(255,255,255,0.9)', ...typeScale.caption, fontFamily: fontFamily.semibold },
});
