import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    scrollContent: {
      paddingBottom: Spacing["5xl"],
    },
    // Header
    header: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing["2xl"],
      paddingTop: Spacing.xl,
      paddingBottom: Spacing["4xl"],
    },
    headerContent: {
      alignItems: 'center',
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.backgroundDefault,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: Spacing.lg,
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 40,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.buttonPrimaryText,
    },
    phoneText: {
      color: theme.buttonPrimaryText,
      marginBottom: Spacing.sm,
    },
    memberBadge: {
      backgroundColor: theme.accent,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    memberBadgeText: {
      color: theme.buttonPrimaryText,
    },
    // Stats Section
    statsSection: {
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.lg,
    },
    sectionTitle: {
      marginBottom: Spacing.md,
    },
    statsLoading: {
      paddingVertical: Spacing.xl,
      alignItems: 'center',
    },
    statsGrid: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    statIcon: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    // Storage Card
    storageCard: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    storageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    storageTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    storageTitle: {
      color: theme.textPrimary,
    },
    storageUsage: {
      color: theme.textMuted,
    },
    storageBar: {
      height: 8,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    storageProgress: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.full,
    },
    // Menu Section
    menuSection: {
      marginTop: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    },
    menuTitle: {
      marginBottom: Spacing.md,
      color: theme.textPrimary,
    },
    menuItem: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
      padding: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    menuLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    menuText: {
      color: theme.textPrimary,
    },
    logoutButton: {
      marginTop: Spacing.xl,
      marginHorizontal: Spacing.lg,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    logoutText: {
      color: theme.error,
    },
    // Modal Styles
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: '80%',
      maxWidth: 320,
    },
    modalTitle: {
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    modalMessage: {
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    modalButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.backgroundTertiary,
    },
    confirmButton: {
      backgroundColor: theme.primary,
    },
  });
};
