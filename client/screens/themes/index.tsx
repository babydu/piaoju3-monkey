import React, { useState, useMemo, useCallback } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme, ThemeMode } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import AppHeader from '@/components/AppHeader';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createStyles } from './styles';

interface ThemeOption {
  key: ThemeMode;
  name: string;
  desc: string;
  previewColor: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { key: 'light', name: '浅色模式', desc: '明亮清新的界面', previewColor: '#FFFFFF' },
  { key: 'dark', name: '深色模式', desc: '护眼暗黑主题', previewColor: '#1F2937' },
  { key: 'system', name: '跟随系统', desc: '自动切换明暗主题', previewColor: '#4F46E5' },
];

export default function ThemesScreen() {
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // 切换主题模式
  const handleThemeChange = async (mode: ThemeMode) => {
    await setThemeMode(mode);
    Toast.show({ type: 'success', text1: `已切换到${THEME_OPTIONS.find(t => t.key === mode)?.name}` });
  };

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader title="主题换肤" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 主题模式选择 */}
        <View style={styles.section}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionTitle}>
            主题模式
          </ThemedText>
          <View style={styles.card}>
            {THEME_OPTIONS.map((option, index) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.themeItem,
                  index === THEME_OPTIONS.length - 1 && styles.themeItemLast,
                ]}
                onPress={() => handleThemeChange(option.key)}
              >
                <View style={[styles.themePreview, { backgroundColor: option.previewColor }]}>
                  <View style={styles.themePreviewGradient}>
                    <FontAwesome6
                      name={option.key === 'dark' ? 'moon' : option.key === 'light' ? 'sun' : 'circle-half-stroke'}
                      size={20}
                      color={option.key === 'dark' ? '#9CA3AF' : option.key === 'light' ? '#F59E0B' : theme.primary}
                    />
                  </View>
                </View>
                <View style={styles.themeInfo}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.themeName}>
                    {option.name}
                  </ThemedText>
                  <ThemedText variant="small" color={theme.textMuted} style={styles.themeDesc}>
                    {option.desc}
                  </ThemedText>
                </View>
                {themeMode === option.key && (
                  <View style={styles.checkIcon}>
                    <FontAwesome6 name="check" size={14} color={theme.buttonPrimaryText} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <ThemedText variant="small" color={theme.textMuted} style={styles.tipText}>
          主题设置将自动保存
        </ThemedText>
      </ScrollView>
    </Screen>
  );
}
