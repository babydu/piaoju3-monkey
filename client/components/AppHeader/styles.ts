import { StyleSheet, Dimensions } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundRoot,
      height: 52,
    },
    leftSection: {
      width: 60,
      alignItems: 'flex-start',
    },
    centerSection: {
      flex: 1,
      alignItems: 'center',
    },
    rightSection: {
      width: 60,
      alignItems: 'flex-end',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
    },
    // Avatar
    avatarButton: {
      padding: Spacing.xs,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.backgroundDefault,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatarImage: {
      width: 36,
      height: 36,
      borderRadius: 18,
      resizeMode: 'cover',
    },
    // Back Button
    backButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.full,
    },
    // Logo
    logo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    logoIcon: {
      width: 24,
      height: 24,
      borderRadius: BorderRadius.sm,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoText: {
      fontWeight: '600',
    },
    // Menu Button
    menuButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.full,
    },
    
    // Modal - 实心背景
    modalOverlay: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.backgroundRoot,  // 实心背景，不透明
    },
    modalDismissArea: {
      flex: 1,
    },
    menuPanel: {
      width: SCREEN_WIDTH * 0.72,
      maxWidth: 280,
      backgroundColor: theme.backgroundDefault,
      borderLeftWidth: 1,
      borderLeftColor: theme.borderLight,
      shadowColor: '#000',
      shadowOffset: { width: -4, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
    },
    closeButton: {
      position: 'absolute',
      top: Spacing.md,
      right: Spacing.md,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    menuHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xl,
      paddingTop: Spacing["2xl"],
      backgroundColor: theme.primary + '08',
    },
    menuHeaderIcon: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuItems: {
      paddingVertical: Spacing.sm,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md + 2,
      gap: Spacing.md,
    },
    menuItemIcon: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
};
