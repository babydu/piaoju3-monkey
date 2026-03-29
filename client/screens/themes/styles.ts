import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing["3xl"],
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      marginBottom: Spacing.md,
    },
    card: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    themeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    themeItemLast: {
      borderBottomWidth: 0,
    },
    themePreview: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      marginRight: Spacing.md,
      overflow: 'hidden',
    },
    themePreviewGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    themeInfo: {
      flex: 1,
    },
    themeName: {
      marginBottom: 2,
    },
    themeDesc: {
      marginTop: 2,
    },
    checkIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorSection: {
      marginBottom: Spacing.xl,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    colorItem: {
      width: '30%',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    colorPreview: {
      width: 60,
      height: 60,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorName: {
      textAlign: 'center',
    },
    proBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      backgroundColor: theme.primary,
    },
    proBadgeText: {
      color: theme.buttonPrimaryText,
      fontSize: 10,
    },
    tipText: {
      marginTop: Spacing.lg,
    },
  });
};
