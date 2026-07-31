import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// logo-web.png, not logo-master.png: the master is the raw artwork and
// carries its own opaque white field, which rendered as a white square on
// the cream background here (and worse in dark mode). logo-web.png is that
// same gradient mark after generate-brand-icons.mjs keys the white out and
// crops it to the glyph, so it composites onto colors.background cleanly.
const LOGO = require('../../assets/brand/logo-web.png');

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
