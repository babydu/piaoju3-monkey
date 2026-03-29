import { StyleSheet, Dimensions } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundRoot,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.backgroundDefault,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Content
    scrollContent: {
      padding: Spacing.md,
      paddingBottom: Spacing["5xl"],
    },
    
    // Section
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      marginBottom: Spacing.md,
    },
    
    // Image Section
    imageRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    imageWrapper: {
      position: 'relative',
    },
    previewImage: {
      width: 80,
      height: 80,
      borderRadius: BorderRadius.md,
    },
    removeBtn: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.error,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
    },
    editBtn: {
      position: 'absolute',
      bottom: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
    },
    addImageBtn: {
      width: 80,
      height: 80,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundDefault,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // OCR Button Row
    ocrButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    ocrBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
    },
    ocrBtnLoading: {
      opacity: 0.7,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    
    // Form Fields
    field: {
      marginBottom: Spacing.md,
    },
    input: {
      marginTop: Spacing.xs,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      fontSize: 15,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
      paddingTop: Spacing.sm,
    },
    
    // Location
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs,
      gap: Spacing.sm,
    },
    locationInput: {
      flex: 1,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      fontSize: 15,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    locateBtn: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Date Picker
    datePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    datePickerIcon: {
      marginRight: Spacing.sm,
    },
    
    // Collection
    collectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs,
      gap: Spacing.sm,
    },
    collectionSelector: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    addCollectionBtn: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Tags
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: Spacing.xs,
      backgroundColor: theme.primary + '15',
      borderRadius: BorderRadius.full,
    },
    commonTagsSection: {
      marginTop: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    commonTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    commonTag: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs + 2,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
    },
    commonTagBtn: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs + 2,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
    },
    tagList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    tagItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: Spacing.xs,
      backgroundColor: theme.primary + '15',
      borderRadius: BorderRadius.full,
    },
    tagInputContainer: {
      position: 'relative',
    },
    tagInputRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    tagInput: {
      flex: 1,
      height: 40,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      fontSize: 14,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    addTagBtn: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tagSuggestions: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      maxHeight: 150,
      marginTop: Spacing.xs,
      zIndex: 100,
      elevation: 5,
    },
    tagSuggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    
    // AI Suggested Tags (待选中状态)
    suggestedTagsSection: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
      padding: Spacing.sm,
      backgroundColor: theme.accent + '08',
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.accent + '20',
    },
    suggestedTagsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    suggestedTagsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    suggestedTagItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent + '15',
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    suggestedTagAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs + 2,
    },
    suggestedTagDismiss: {
      paddingHorizontal: Spacing.xs + 2,
      paddingVertical: Spacing.xs + 2,
    },
    
    // Privacy Toggle
    privacyToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.xs,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    privacyToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    toggleTrack: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.border,
      padding: 2,
    },
    toggleTrackActive: {
      backgroundColor: theme.primary,
    },
    toggleThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
    },
    toggleThumbActive: {
      transform: [{ translateX: 20 }],
    },
    
    // Switch
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    switchLabel: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    switch: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.border,
      padding: 2,
      justifyContent: 'center',
    },
    switchActive: {
      backgroundColor: theme.primary,
    },
    switchThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
    },
    switchThumbActive: {
      alignSelf: 'flex-end',
    },
    
    // Buttons
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.xl,
      paddingHorizontal: Spacing.md,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    submitBtn: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      width: '85%',
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    newCollectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
      marginBottom: Spacing.sm,
    },
    newCollectionIcon: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    collectionList: {
      maxHeight: 300,
    },
    collectionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    collectionItemActive: {
      backgroundColor: theme.primary + '10',
    },
    collectionItemSelected: {
      backgroundColor: theme.primary + '10',
    },
    createNewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.md,
    },
    createModalContent: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: '85%',
    },
    createInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      marginTop: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    createModalBtns: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    createModalCancelBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    createModalConfirmBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary,
    },
    newCollectionModal: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: '85%',
    },
    newCollectionInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      marginBottom: Spacing.lg,
    },
    newCollectionButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    newCollectionCancelBtn: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    newCollectionConfirmBtn: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary,
    },
    
    // OCR Retry Modal
    ocrRetryModal: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: '85%',
    },
    ocrRetryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    ocrRetryOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    ocrRetryOptionIcon: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    ocrRetryOptionContent: {
      flex: 1,
    },
    ocrCancelBtn: {
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
  });
};
