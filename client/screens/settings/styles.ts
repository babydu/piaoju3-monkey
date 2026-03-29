import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing["2xl"],
      paddingBottom: Spacing["5xl"],
    },

    // 分组
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textMuted,
      marginBottom: Spacing.sm,
      marginLeft: Spacing.xs,
    },

    // 菜单组
    menuGroup: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },

    // 菜单项
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    menuContent: {
      flex: 1,
    },
    menuTitle: {
      fontSize: 15,
      color: theme.textPrimary,
    },
    menuDesc: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 2,
    },
    menuValue: {
      fontSize: 14,
      color: theme.textSecondary,
      marginRight: Spacing.sm,
    },
    menuArrow: {
      marginLeft: Spacing.sm,
    },

    // 开关
    switch: {
      marginLeft: Spacing.sm,
    },

    // 按钮样式
    primaryButton: {
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing["2xl"],
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },

    // 提示文字
    tipText: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: Spacing.md,
      lineHeight: 18,
    },

    // 危险区域
    dangerItem: {
      backgroundColor: theme.error + '10',
    },
    dangerText: {
      color: theme.error,
    },

    // 版本信息
    versionInfo: {
      alignItems: 'center',
      marginTop: Spacing["3xl"],
      marginBottom: Spacing.xl,
    },
    versionText: {
      fontSize: 12,
      color: theme.textMuted,
    },
  });
};
