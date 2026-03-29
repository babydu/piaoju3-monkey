export const Colors = {
  light: {
    // 淡蓝色风格 - 清新、简洁、现代
    textPrimary: "#1E3A5F", // 深蓝灰 - 主要文本
    textSecondary: "#4A6FA5", // 中蓝色 - 次要文本
    textMuted: "#7BA3D0", // 浅蓝色 - 辅助文本
    primary: "#4A90E2", // 主蓝色 - 品牌色
    accent: "#6CB4EE", // 天空蓝 - 点缀色
    success: "#5CB85C", // 成功绿
    error: "#E74C3C", // 错误红
    warning: "#F39C12", // 警告橙
    backgroundRoot: "#F0F6FF", // 淡蓝白 - 根背景
    backgroundDefault: "#FFFFFF", // 纯白色 - 卡片背景
    backgroundTertiary: "#E8F2FF", // 浅蓝背景 - 去线留白
    buttonPrimaryText: "#FFFFFF", // 按钮文字
    tabIconSelected: "#4A90E2", // Tab选中色
    border: "#D6E4FF", // 边框色 - 淡蓝边框
    borderLight: "#EBF3FF", // 浅色边框
  },
  dark: {
    textPrimary: "#E8F2FF",
    textSecondary: "#A8C8E8",
    textMuted: "#7BA3D0",
    primary: "#6CB4EE", // 暗色模式 - 浅蓝色
    accent: "#4A90E2",
    success: "#5CB85C",
    error: "#E74C3C",
    warning: "#F39C12", // 警告橙
    backgroundRoot: "#0D1B2A", // 深蓝黑
    backgroundDefault: "#1B2838", // 深蓝灰
    backgroundTertiary: "#243447",
    buttonPrimaryText: "#0D1B2A",
    tabIconSelected: "#6CB4EE",
    border: "#2C4A6E",
    borderLight: "#1E3A5F",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 32,
  full: 9999,
};

export const Typography = {
  display: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: "200" as const,
    letterSpacing: -4,
  },
  displayLarge: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: "200" as const,
    letterSpacing: -2,
  },
  displayMedium: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "200" as const,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "300" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  smallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  labelSmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  labelTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  stat: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "300" as const,
  },
  tiny: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "400" as const,
  },
  navLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500" as const,
  },
};

export type Theme = typeof Colors.light;
