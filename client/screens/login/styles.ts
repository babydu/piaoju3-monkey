import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing["2xl"],
      paddingTop: Spacing["6xl"],
      paddingBottom: Spacing["5xl"],
    },
    header: {
      marginBottom: Spacing["4xl"],
      alignItems: 'center',
    },
    logo: {
      width: 80,
      height: 80,
      marginBottom: Spacing["2xl"],
      alignSelf: 'center',
    },
    title: {
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    subtitle: {
      textAlign: 'center',
    },
    // 登录模式切换
    modeSwitch: {
      flexDirection: 'row',
      marginBottom: Spacing["2xl"],
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xs,
    },
    modeButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
    },
    modeButtonActive: {
      backgroundColor: theme.backgroundDefault,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    // 表单
    form: {
      marginBottom: Spacing["3xl"],
    },
    inputGroup: {
      marginBottom: Spacing.lg,
    },
    label: {
      marginBottom: Spacing.sm,
    },
    input: {
      backgroundColor: theme.backgroundDefault,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
    },
    inputFocused: {
      borderColor: theme.primary,
    },
    codeRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    codeInput: {
      flex: 1,
    },
    codeButton: {
      backgroundColor: theme.backgroundDefault,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      minWidth: 120,
      alignItems: 'center',
      justifyContent: 'center',
    },
    codeButtonDisabled: {
      borderColor: theme.border,
      opacity: 0.5,
    },
    codeButtonText: {
      color: theme.primary,
    },
    codeButtonTextDisabled: {
      color: theme.textMuted,
    },
    codeHint: {
      marginTop: Spacing.sm,
      padding: Spacing.sm,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    loginButton: {
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    loginButtonDisabled: {
      opacity: 0.5,
    },
    loginButtonText: {
      color: theme.buttonPrimaryText,
    },
    // 一键登录相关样式
    operatorInfo: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      marginBottom: Spacing.lg,
    },
    oneClickButton: {
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing["2xl"],
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    oneClickButtonDisabled: {
      opacity: 0.5,
      backgroundColor: theme.textMuted,
    },
    switchModeLink: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
      marginTop: Spacing.md,
    },
    disclaimer: {
      alignItems: 'center',
      marginTop: Spacing["2xl"],
      paddingHorizontal: Spacing.xl,
    },
    // 环境提示
    envWarning: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      alignItems: 'center',
    },
    envHint: {
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    // Footer
    footer: {
      marginTop: 'auto',
      alignItems: 'center',
    },
    tip: {
      marginTop: Spacing.lg,
      alignItems: 'center',
    },
    tipText: {
      textAlign: 'center',
    },
  });
};
