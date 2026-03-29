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
    
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: Spacing.md,
    },
    
    // FAQ列表
    faqList: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    faqItem: {
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    faqItemExpanded: {
      borderBottomWidth: 0,
    },
    faqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    faqQuestion: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    faqAnswer: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 20,
      marginTop: Spacing.md,
      paddingLeft: Spacing.xl,
    },
    
    // 反馈卡片
    feedbackCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    
    // 类型选择器
    typeSelector: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    typeButton: {
      flex: 1,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
      alignItems: 'center',
    },
    typeButtonActive: {
      backgroundColor: theme.primary,
    },
    typeButtonText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    typeButtonTextActive: {
      color: '#FFFFFF',
      fontWeight: '500',
    },
    
    // 输入框
    textInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: 14,
      color: theme.textPrimary,
      minHeight: 140,
      marginBottom: Spacing.md,
    },
    contactInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: 14,
      color: theme.textPrimary,
      marginBottom: Spacing.lg,
    },
    
    // 提交按钮
    submitButton: {
      backgroundColor: theme.primary,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    
    // 联系方式
    contactList: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    contactIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    contactContent: {
      flex: 1,
    },
    contactLabel: {
      fontSize: 12,
      color: theme.textMuted,
      marginBottom: 2,
    },
    contactValue: {
      fontSize: 14,
      color: theme.textPrimary,
    },
    
    // 提示
    tipSection: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.lg,
    },
    tipText: {
      flex: 1,
      fontSize: 12,
      color: theme.textMuted,
      lineHeight: 18,
    },
  });
};
