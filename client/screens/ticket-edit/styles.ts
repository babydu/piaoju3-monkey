import { StyleSheet, Dimensions } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingBottom: Spacing["5xl"],
    },
    // Image
    imageSection: {
      marginBottom: Spacing.md,
    },
    imageCarousel: {
      width: SCREEN_WIDTH,
      height: 220,
    },
    imageSlide: {
      width: SCREEN_WIDTH,
      height: 220,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewImage: {
      width: SCREEN_WIDTH,
      height: 220,
    },
    imageBadge: {
      position: 'absolute',
      top: Spacing.md,
      right: Spacing.md,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
    },
    // Form
    formSection: {
      backgroundColor: theme.backgroundDefault,
      marginHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
    },
    inputGroup: {
      marginBottom: Spacing.md,
    },
    textInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 14,
      color: theme.textPrimary,
      marginTop: Spacing.xs,
    },
    textArea: {
      minHeight: 72,
      textAlignVertical: 'top',
      paddingTop: Spacing.sm,
    },
    inputWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      marginTop: Spacing.xs,
    },
    inputIcon: {
      marginRight: Spacing.sm,
    },
    textInputWithIcon: {
      flex: 1,
      paddingVertical: Spacing.sm,
      fontSize: 14,
      color: theme.textPrimary,
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginTop: Spacing.xs,
    },
    // Tags
    selectedTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    selectedTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary + '15',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.full,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    tagChip: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.md - 2,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tagChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    customTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.sm,
      gap: Spacing.xs,
    },
    customTagInput: {
      flex: 1,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs + 2,
      fontSize: 13,
      color: theme.textPrimary,
    },
    addTagBtn: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addTagBtnDisabled: {
      backgroundColor: theme.backgroundTertiary,
    },
    // Switch
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.xs,
    },
    switchLabel: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // Save Button - 缩小尺寸
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.lg,
      alignSelf: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    confirmModal: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      width: '75%',
      alignItems: 'center',
    },
    confirmButtons: {
      flexDirection: 'row',
      marginTop: Spacing.lg,
      gap: Spacing.md,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    confirmBtnPrimary: {
      backgroundColor: theme.primary,
    },
    confirmBtnDanger: {
      backgroundColor: theme.error + '15',
    },
  });
};
