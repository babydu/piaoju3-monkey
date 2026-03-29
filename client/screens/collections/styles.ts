import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      backgroundColor: theme.backgroundDefault,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: Spacing.sm,
    },
    headerTitle: {
      color: theme.textPrimary,
    },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    addButtonText: {
      color: theme.buttonPrimaryText,
    },
    listContent: {
      padding: Spacing.lg,
    },
    collectionItem: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    collectionInfo: {
      flex: 1,
    },
    collectionName: {
      color: theme.textPrimary,
      marginBottom: Spacing.xs,
    },
    collectionCount: {
      color: theme.textMuted,
    },
    collectionActions: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    actionButton: {
      padding: Spacing.sm,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing["5xl"],
    },
    emptyStateText: {
      color: theme.textMuted,
      marginTop: Spacing.lg,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: '85%',
      maxWidth: 400,
    },
    modalTitle: {
      marginBottom: Spacing.xl,
      textAlign: 'center',
    },
    modalInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      marginBottom: Spacing.xl,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    modalButton: {
      flex: 1,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.backgroundTertiary,
    },
    confirmButton: {
      backgroundColor: theme.primary,
    },
    cancelButtonText: {
      color: theme.textPrimary,
    },
    confirmButtonText: {
      color: theme.buttonPrimaryText,
    },
  });
};
