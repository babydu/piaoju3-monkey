import { StyleSheet, Dimensions } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.md,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: Spacing["5xl"],
    },
    // Header Actions
    headerActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    headerBtn: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    // Image Section - 美化图片展示
    imageSection: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: theme.borderLight,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
      overflow: 'hidden',
    },
    imageSlide: {
      width: SCREEN_WIDTH - Spacing.lg * 2,
      height: 280,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    previewImage: {
      width: SCREEN_WIDTH - Spacing.lg * 2,
      height: 280,
    },
    imageBadge: {
      position: 'absolute',
      top: Spacing.md,
      right: Spacing.md,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    imageErrorContainer: {
      width: SCREEN_WIDTH - Spacing.lg * 2,
      height: 280,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      gap: Spacing.xs,
      backgroundColor: theme.backgroundDefault,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.border,
    },
    dotActive: {
      width: 20,
      backgroundColor: theme.primary,
    },
    // Info Section
    infoSection: {
      padding: Spacing.lg,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    title: {
      flex: 1,
    },
    privateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary + '15',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      marginLeft: Spacing.sm,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary + '12',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs + 2,
      borderRadius: BorderRadius.full,
    },
    summarySection: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    summaryLabel: {
      marginLeft: Spacing.sm,
    },
    summaryText: {
      lineHeight: 22,
    },
    infoGrid: {
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    infoText: {
      flex: 1,
    },
    notesSection: {
      marginBottom: Spacing.lg,
    },
    sectionLabel: {
      marginBottom: Spacing.sm,
    },
    // OCR Section
    ocrSection: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.borderLight,
      marginTop: Spacing.md,
    },
    ocrHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    ocrText: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
      lineHeight: 22,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    confirmModal: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: '80%',
      alignItems: 'center',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.lg,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    deleteBtn: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.error,
    },
    // Lightbox
    lightboxContainer: {
      flex: 1,
      backgroundColor: '#000000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    lightboxClose: {
      position: 'absolute',
      top: 60,
      right: 20,
      zIndex: 10,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    lightboxSlide: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    lightboxImage: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT * 0.8,
    },
    lightboxInfo: {
      position: 'absolute',
      bottom: 60,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
    },
    // Privacy Verify
    privacyVerifyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },
    lockIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    privacyTitle: {
      marginBottom: Spacing.sm,
    },
    privacyDesc: {
      marginBottom: Spacing.xl,
    },
    privacyInputContainer: {
      width: '100%',
      marginBottom: Spacing.lg,
    },
    privacyInput: {
      width: '100%',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.borderLight,
      textAlign: 'center',
    },
    privacyButton: {
      width: '100%',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.md + 2,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    privacyButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
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
    forgotButton: {
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    // 重置密码弹窗
    resetModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    resetModalContent: {
      width: SCREEN_WIDTH - 48,
      maxHeight: '80%',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
    },
    resetModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    resetModalBody: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
    },
    resetModalDesc: {
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
    resetModalFooter: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      gap: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    resetInputGroup: {
      marginBottom: Spacing.lg,
    },
    resetLabel: {
      marginBottom: Spacing.sm,
    },
    resetModalInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    resetCancelButton: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
    },
    resetConfirmButton: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      backgroundColor: theme.primary,
    },
  });
};
