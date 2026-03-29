import { StyleSheet, Dimensions } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing["2xl"],
    },
    
    lockIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },

    title: {
      marginBottom: Spacing.md,
    },

    desc: {
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },

    inputContainer: {
      width: '100%',
      marginBottom: Spacing.lg,
    },

    input: {
      width: '100%',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      fontSize: 16,
      color: theme.textPrimary,
      textAlign: 'center',
      letterSpacing: 8,
    },

    hintBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },

    hintText: {
      flex: 1,
    },

    button: {
      width: '100%',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      marginTop: Spacing.md,
    },

    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },

    forgotButton: {
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
    },

    biometricButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
    },

    biometricText: {
      color: theme.primary,
      marginLeft: Spacing.sm,
    },

    setPasswordText: {
      color: theme.textMuted,
      marginTop: Spacing.xl,
    },

    // 票据列表
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

    emptyText: {
      marginTop: Spacing.md,
    },

    // 重置密码弹窗
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    modalContent: {
      width: SCREEN_WIDTH - 48,
      maxHeight: '80%',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
    },

    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },

    modalBody: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
    },

    modalDesc: {
      marginBottom: Spacing.lg,
    },

    // 短信验证
    verifySection: {
      marginBottom: Spacing.lg,
    },

    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },

    codeInput: {
      flex: 1,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },

    sendCodeBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.primary,
      minWidth: 100,
      alignItems: 'center',
    },

    sendCodeBtnDisabled: {
      borderColor: theme.border,
    },

    divider: {
      height: 1,
      backgroundColor: theme.borderLight,
      marginBottom: Spacing.lg,
    },

    modalFooter: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      gap: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },

    inputGroup: {
      marginBottom: Spacing.lg,
    },

    label: {
      marginBottom: Spacing.sm,
    },

    modalInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },

    cancelButton: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
    },

    confirmButton: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      backgroundColor: theme.primary,
    },
  });
};
