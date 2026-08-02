import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface ActionSheetOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

// React Native's Alert.alert() renders as a native OS dialog - it can't be
// themed, so every "options"/"confirm" menu using it looked like a plain
// system popup dropped into an otherwise fully-branded app. This is the
// themed replacement, same bottom-sheet shape MoodCheckinCard's
// MoodPickerModal already established for a "title + list of choices" sheet.
export function ActionSheet({
  title,
  message,
  options,
  onCancel,
  cancelLabel = 'Cancel',
}: {
  title: string;
  message?: string;
  options: ActionSheetOption[];
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayDismiss} activeOpacity={1} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.options}>
            {options.map((option) => (
              <AnimatedPressable
                key={option.label}
                style={styles.option}
                onPress={option.onPress}
                accessibilityRole="button"
              >
                <Text style={[styles.optionText, option.destructive && styles.optionTextDestructive]}>
                  {option.label}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
          <AnimatedPressable style={[styles.option, styles.cancelOption]} onPress={onCancel} accessibilityRole="button">
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles({ colors, radii, shadow, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    overlayDismiss: { ...StyleSheet.absoluteFillObject },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: spacing.xxl,
      paddingBottom: spacing.s36,
      gap: spacing.xs,
      ...shadow,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    title: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.shellTitle, textAlign: 'center' },
    message: { ...type.caption, fontFamily: fontFamily.regular, color: colors.shellSecondary, textAlign: 'center', marginTop: spacing.xs },
    options: { marginTop: spacing.lg, gap: spacing.xs },
    option: {
      borderRadius: radii.input,
      paddingVertical: spacing.s14,
      alignItems: 'center',
    },
    optionText: { ...type.body, fontFamily: fontFamily.semibold, color: colors.textPrimary },
    optionTextDestructive: { color: colors.danger },
    cancelOption: { marginTop: spacing.s10, backgroundColor: colors.inputBg },
    cancelText: { ...type.body, fontFamily: fontFamily.semibold, color: colors.textSecondary },
  });
}
