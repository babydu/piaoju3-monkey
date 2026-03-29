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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing["3xl"],
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    ticketCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.md,
      overflow: 'hidden',
    },
    ticketContent: {
      flexDirection: 'row',
      padding: Spacing.md,
    },
    thumbnail: {
      width: 60,
      height: 60,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    ticketInfo: {
      flex: 1,
      marginLeft: Spacing.md,
      justifyContent: 'center',
    },
    ticketTitle: {
      marginBottom: Spacing.xs,
    },
    ticketMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    deletedAt: {
      marginLeft: Spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing.md,
    },
    actionButtonLeft: {
      borderRightWidth: 1,
      borderRightColor: theme.borderLight,
    },
    actionText: {
      marginLeft: Spacing.sm,
    },
    restoreText: {
      color: theme.primary,
    },
    deleteText: {
      color: theme.error,
    },
    tipText: {
      textAlign: 'center',
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.xl,
    },
  });
};
