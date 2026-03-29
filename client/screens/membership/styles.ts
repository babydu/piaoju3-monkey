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
    
    // 头部会员状态
    header: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    crownIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    memberBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      marginTop: Spacing.sm,
    },
    memberBadgeText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    expiredText: {
      color: theme.error,
      fontSize: 12,
      marginTop: Spacing.xs,
    },

    // 用量统计卡片
    statsCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
    statLimit: {
      fontSize: 11,
      color: theme.textMuted,
    },

    // 进度条
    progressBar: {
      height: 8,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: Spacing.sm,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },

    // 权益列表
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: Spacing.md,
    },
    benefitsList: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
      marginBottom: Spacing.lg,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    benefitIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    benefitText: {
      flex: 1,
      fontSize: 14,
      color: theme.textPrimary,
    },
    benefitCheck: {
      marginLeft: Spacing.sm,
    },

    // 价格卡片
    priceCards: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    priceCard: {
      flex: 1,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    priceCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '08',
    },
    priceCardRecommended: {
      position: 'relative',
    },
    recommendedBadge: {
      position: 'absolute',
      top: -10,
      backgroundColor: theme.accent,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
    },
    recommendedText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '600',
    },
    priceTitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: Spacing.sm,
    },
    priceValue: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    priceCurrency: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.primary,
    },
    priceAmount: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.primary,
    },
    pricePeriod: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },

    // 按钮
    primaryButton: {
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing["2xl"],
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    
    // 确认弹窗
    modalOverlay: {
      flex: 1,
      backgroundColor: '#000000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '85%',
      maxWidth: 320,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    modalMessage: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.lg,
    },
    modalPrice: {
      fontSize: 36,
      fontWeight: '700',
      color: theme.primary,
      textAlign: 'center',
      marginBottom: Spacing.lg,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    modalCancelButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
    },
    modalCancelText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    modalConfirmButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      backgroundColor: theme.primary,
    },
    modalConfirmText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    secondaryButton: {
      backgroundColor: theme.backgroundDefault,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing["2xl"],
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.primary,
    },
    secondaryButtonText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: '600',
    },

    // 说明文字
    disclaimer: {
      fontSize: 12,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: Spacing.lg,
    },
  });
};
