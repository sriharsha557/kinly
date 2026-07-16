import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function Mascot({ size = 120 }: { size?: number }) {
  const eyeSize = size * 0.13;
  const eyeGap = size * 0.22;
  const mouthWidth = size * 0.28;
  const mouthHeight = mouthWidth * 0.5;

  return (
    <View
      style={[
        styles.body,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface },
      ]}
    >
      <View style={[styles.eyeRow, { gap: eyeGap }]}>
        <View style={[styles.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 }]} />
        <View style={[styles.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 }]} />
      </View>
      <View
        style={[
          styles.mouth,
          {
            width: mouthWidth,
            height: mouthHeight,
            borderBottomLeftRadius: mouthHeight,
            borderBottomRightRadius: mouthHeight,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  eyeRow: {
    flexDirection: 'row',
  },
  eye: {
    backgroundColor: colors.textPrimary,
  },
  mouth: {
    borderWidth: 3,
    borderTopWidth: 0,
    borderColor: colors.textPrimary,
  },
});
