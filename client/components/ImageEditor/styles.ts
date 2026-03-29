import { StyleSheet, Platform } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    container: {
      flex: 1,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    closeBtn: {
      padding: Spacing.sm,
    },
    saveBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      minWidth: 60,
      alignItems: 'center',
    },
    saveBtnDisabled: {
      backgroundColor: theme.textMuted,
    },
    previewContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
      padding: Spacing.lg,
    },
    previewWrapper: {
      position: 'relative',
    },
    previewImage: {
      borderRadius: BorderRadius.md,
    },
    processingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },

    // 矩形框样式
    dimOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    rectBorder: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 2,
      borderColor: '#FFD700',
      borderRadius: 4,
    },
    cornerHandle: {
      position: 'absolute',
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
    },
    cornerHandleInner: {
      width: 20,
      height: 20,
      backgroundColor: '#FFD700',
      borderRadius: 10,
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    edgeHandle: {
      position: 'absolute',
      zIndex: 15,
    },

    // 提示
    tipContainer: {
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      gap: 4,
    },

    // 边框确认操作栏
    edgeConfirmBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.backgroundDefault,
    },
    edgeBtn: {
      alignItems: 'center',
      gap: 4,
    },
    edgeSkipBtn: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    },
    edgeConfirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: theme.primary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.lg,
    },

    // 编辑工具栏
    processToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.backgroundDefault,
    },
    toolBtn: {
      alignItems: 'center',
      gap: Spacing.xs,
    },
    toolIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.backgroundTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
};
