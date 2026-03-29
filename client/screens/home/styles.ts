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
    // Search Bar - 可输入的搜索框
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    searchInput: {
      flex: 1,
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.sm,
      fontSize: 14,
      color: theme.textPrimary,
    },
    clearSearchBtn: {
      padding: Spacing.xs,
    },
    searchBtn: {
      backgroundColor: theme.primary,
      paddingVertical: Spacing.xs + 2,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
      marginLeft: Spacing.sm,
    },
    // New Ticket Button - 简洁的单按钮
    newTicketBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: Spacing.md,
      marginTop: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.lg,
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    newTicketIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Filter Section
    filterSection: {
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.md,
    },
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'flex-start',
    },
    clearBtn: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Ticket Section
    ticketSection: {
      marginTop: Spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    ticketList: {
      paddingHorizontal: Spacing.md,
    },
    // Ticket Card
    ticketCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    thumbnailContainer: {
      position: 'relative',
    },
    thumbnail: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    thumbnailPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageCount: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: BorderRadius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    syncBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: theme.success,
      borderRadius: BorderRadius.full,
      width: 14,
      height: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ticketContent: {
      flex: 1,
      justifyContent: 'space-between',
      minHeight: 56,
    },
    tagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    miniTag: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      backgroundColor: theme.primary + '15',
      borderRadius: BorderRadius.full,
    },
    ticketMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // Loading & Empty
    loadingContainer: {
      paddingVertical: Spacing["3xl"],
      alignItems: 'center',
    },
    emptyContainer: {
      paddingVertical: Spacing["3xl"],
      alignItems: 'center',
    },
    // Selection Mode Styles
    checkboxContainer: {
      marginRight: Spacing.sm,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectModeBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingTop: Spacing.xl,
    },
    selectModeCancel: {
      padding: Spacing.xs,
    },
    bottomActionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingBottom: Spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    actionItem: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionIconBg: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
  });
};
