import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing["3xl"],
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      marginBottom: Spacing.sm,
    },
    card: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    infoRowLast: {
      borderBottomWidth: 0,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.md + 2,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginTop: Spacing.md,
    },
    actionButtonDisabled: {
      opacity: 0.6,
    },
    actionButtonText: {
      marginLeft: Spacing.sm,
    },
    secondaryButton: {
      backgroundColor: theme.backgroundTertiary,
    },
    secondaryButtonText: {
      color: theme.textPrimary,
    },
    warningCard: {
      paddingVertical: Spacing.sm,
    },
    warningItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    warningText: {
      marginLeft: Spacing.sm,
    },
  });
};
