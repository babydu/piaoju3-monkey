import { Colors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const THEME_STORAGE_KEY = '@ticket_manager_theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink';

interface ThemeContextType {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setAccentColor: (color: AccentColor) => Promise<void>;
  isDark: boolean;
  theme: typeof Colors.light;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 获取系统主题
function getSystemTheme(): 'light' | 'dark' {
  // 在React Native中，我们需要使用expo的API
  // 这里简化处理，默认返回light
  return 'light';
}

// 根据主题模式和系统主题获取实际主题
function getActualTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [accentColor, setAccentColorState] = useState<AccentColor>('blue');
  const [isLoading, setIsLoading] = useState(true);

  // 初始化时从存储加载主题设置
  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    try {
      const savedThemeMode = await AsyncStorage.getItem(THEME_STORAGE_KEY + '_mode');
      const savedAccentColor = await AsyncStorage.getItem(THEME_STORAGE_KEY + '_accent');
      
      if (savedThemeMode) {
        setThemeModeState(savedThemeMode as ThemeMode);
      }
      if (savedAccentColor) {
        setAccentColorState(savedAccentColor as AccentColor);
      }
    } catch (error) {
      console.error('加载主题设置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY + '_mode', mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  };

  const setAccentColor = async (color: AccentColor) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY + '_accent', color);
      setAccentColorState(color);
    } catch (error) {
      console.error('保存强调色设置失败:', error);
    }
  };

  const actualTheme = getActualTheme(themeMode);
  const isDark = actualTheme === 'dark';
  const theme = Colors[actualTheme];

  // 根据强调色调整主题
  const themeWithAccent = {
    ...theme,
    accent: getAccentColorValue(accentColor),
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        accentColor,
        setThemeMode,
        setAccentColor,
        isDark,
        theme: themeWithAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

function getAccentColorValue(color: AccentColor): string {
  const colors: Record<AccentColor, string> = {
    blue: '#4F46E5',
    purple: '#7C3AED',
    green: '#059669',
    orange: '#EA580C',
    pink: '#EC4899',
  };
  return colors[color];
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// 保持向后兼容的导出
export { useTheme as useThemeHook };
