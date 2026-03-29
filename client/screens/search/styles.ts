import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      paddingBottom: Spacing["5xl"],
    },
    // Search Section
    searchSection: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    searchRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    searchInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
    },
    searchInput: {
      flex: 1,
      marginLeft: Spacing.sm,
      fontSize: 14,
      color: theme.textPrimary,
    },
    searchBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      borderRadius: BorderRadius.full,
      justifyContent: 'center',
    },
    // Filter Section
    filterSection: {
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.lg,
    },
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterBtnActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    clearBtn: {
      paddingHorizontal: Spacing.sm,
      justifyContent: 'center',
    },
    // Results Section
    resultsSection: {
      marginTop: Spacing.xl,
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    resultList: {
      paddingHorizontal: Spacing.lg,
    },
    // Result Card
    resultCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    resultThumbnail: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    resultContent: {
      flex: 1,
    },
    resultMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs,
      gap: Spacing.sm,
    },
    resultTag: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      backgroundColor: theme.primary + '15',
      borderRadius: BorderRadius.full,
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
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerModal: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      width: '80%',
      maxHeight: '60%',
    },
    pickerTitle: {
      marginBottom: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    pickerItem: {
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    pickerItemActive: {
      backgroundColor: theme.primary + '10',
      marginHorizontal: -Spacing.md,
      paddingHorizontal: Spacing.md,
    },
  });
};
