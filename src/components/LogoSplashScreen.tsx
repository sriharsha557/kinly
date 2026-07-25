import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// logo-master.png is the gradient version made for a light surface (see
// ARCHITECTURE.md's Brand note) - the counterpart to logo-white-glyph.png,
// which only reads on an orange/dark background. Square (1254x1254).
const LOGO = require('../../assets/brand/logo-master.png');

// Lightweight stand-in for LaunchVideoScreen on every cold start after the
// first - just the mark on the app's background, gone the moment loading
// resolves and RootNavigator routes onward. The video itself only plays
// once ever (see useAuthStore's hasSeenLaunchVideo doc comment).
export function LogoSplashScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    logo: { width: 96, height: 96 },
  });
}
