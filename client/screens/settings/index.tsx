import React, { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ScrollView,
  TouchableOpacity,
  View,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import AppHeader from '@/components/AppHeader';
import { Spacing, BorderRadius } from '@/constants/theme';
import { unifiedStorageService } from '@/services/local-storage';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface UserSettings {
  preferences: {
    ocrMode?: 'local' | 'cloud' | 'cloud-first';
    cloudBackup?: boolean;
    cloudOcrEnabled?: boolean;
    allowPrivateCloudStorage?: boolean;
    aiServiceEnabled?: boolean;
    theme?: string;
    storageMode?: 'local-only' | 'cloud';
  };
  privacy: {
    hasPassword: boolean;
    biometricEnabled: boolean;
  };
  cloudStorage: Array<{
    id: string;
    provider: string;
    is_enabled: boolean;
    last_sync_at: string | null;
  }>;
  ocrServices: Array<{
    id: string;
    name: string;
    display_name: string;
    is_enabled: boolean;
    is_default: boolean;
  }>;
  isPro: boolean;
}

type OcrMode = 'local' | 'cloud' | 'cloud-first';

const OCR_MODE_OPTIONS: { key: OcrMode; name: string; desc: string }[] = [
  { key: 'local', name: '本地优先', desc: '优先使用本地识别，速度快且隐私安全' },
  { key: 'cloud', name: '云端识别', desc: '使用云端服务，识别精度更高' },
  { key: 'cloud-first', name: '云端优先', desc: '优先云端识别，失败后降级本地' },
];

type StorageMode = 'local-only' | 'cloud';

const STORAGE_MODE_OPTIONS: { key: StorageMode; name: string; desc: string }[] = [
  { key: 'local-only', name: '本地存储', desc: '仅保存在本地设备，数据不离开设备' },
  { key: 'cloud', name: '云端+本地', desc: '双向同步：本地数据上传云端，云端数据下载到本地' },
];

export default function SettingsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { token, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [storageModalVisible, setStorageModalVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // 获取设置
  const fetchSettings = useCallback(async () => {
    if (!token) return;

    try {
      // 先获取本地存储设置（包含 storageMode）
      const localSettings = await unifiedStorageService.getSettings();
      
      // 获取云端设置
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        // 合并云端和本地设置
        // storageMode 使用本地值，其他设置使用云端值
        const mergedSettings = {
          ...data.settings,
          preferences: {
            ...data.settings.preferences,
            storageMode: localSettings.storageMode, // 保留本地存储模式设置
          },
        };
        setSettings(mergedSettings);
      } else {
        Toast.show({ type: 'error', text1: '获取设置失败', text2: data.error });
      }
    } catch (error) {
      console.error('获取设置失败:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 更新偏好设置
  const updatePreference = async (key: string, value: any) => {
    if (!token || !settings) return;

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await response.json();

      if (data.success) {
        setSettings({
          ...settings,
          preferences: data.preferences,
        });
        Toast.show({ type: 'success', text1: '设置已保存' });
      } else {
        Toast.show({ type: 'error', text1: '保存失败', text2: data.error });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    }
  };

  // 切换生物识别
  const toggleBiometric = async (enabled: boolean) => {
    if (!token) return;

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings/biometric`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json();

      if (data.success) {
        setSettings(prev => prev ? {
          ...prev,
          privacy: { ...prev.privacy, biometricEnabled: enabled }
        } : null);
        Toast.show({ type: 'success', text1: enabled ? '已开启生物识别' : '已关闭生物识别' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    }
  };

  // 选择OCR模式
  const selectOcrMode = async (mode: OcrMode) => {
    await updatePreference('ocrMode', mode);
    setOcrModalVisible(false);
  };

  // 选择存储模式
  const selectStorageMode = async (mode: StorageMode) => {
    const previousMode = settings?.preferences.storageMode || 'local-only';
    setStorageModalVisible(false);
    
    // 如果模式没有变化，不需要处理
    if (previousMode === mode) {
      return;
    }
    
    try {
      // 保存到本地存储
      await unifiedStorageService.updateSettings({ storageMode: mode as any });
      
      // 更新UI状态
      setSettings(prev => prev ? {
        ...prev,
        preferences: { ...prev.preferences, storageMode: mode as any }
      } : null);
      
      // 如果从本地模式切换到云端模式，需要同步本地数据
      if (previousMode === 'local-only' && mode === 'cloud' && token) {
        setIsSyncing(true);
        Toast.show({ type: 'info', text1: '正在同步本地数据到云端...', position: 'top' });
        
        try {
          const result = await unifiedStorageService.syncToCloud(token);
          
          if (result.success > 0 || result.skipped > 0) {
            let message = `成功同步 ${result.success} 张票据`;
            if (result.skipped > 0) {
              message += `，跳过 ${result.skipped} 张私密票据`;
            }
            Toast.show({ type: 'success', text1: '同步完成', text2: message, position: 'top' });
          } else if (result.failed > 0) {
            Toast.show({ 
              type: 'error', 
              text1: '同步部分失败', 
              text2: `${result.failed} 张票据同步失败`,
              position: 'top' 
            });
          } else {
            Toast.show({ type: 'info', text1: '无待同步数据', position: 'top' });
          }
        } catch (syncError) {
          console.error('同步失败:', syncError);
          Toast.show({ type: 'error', text1: '同步失败', text2: '请稍后重试', position: 'top' });
        } finally {
          setIsSyncing(false);
        }
      } else {
        Toast.show({ type: 'success', text1: '存储模式已更新', position: 'top' });
      }
    } catch (error) {
      console.error('更新存储模式失败:', error);
      Toast.show({ type: 'error', text1: '更新失败', position: 'top' });
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
    }, [fetchSettings])
  );

  // 菜单项组件
  const MenuItem = ({ 
    icon, 
    title, 
    desc, 
    value, 
    onPress, 
    hasArrow = true,
    isLast = false,
    isDanger = false,
  }: {
    icon: string;
    title: string;
    desc?: string;
    value?: string;
    onPress?: () => void;
    hasArrow?: boolean;
    isLast?: boolean;
    isDanger?: boolean;
  }) => (
    <TouchableOpacity 
      style={[
        styles.menuItem, 
        isLast && styles.menuItemLast,
        isDanger && styles.dangerItem,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.menuIcon, isDanger && { backgroundColor: theme.error + '10' }]}>
        <FontAwesome6 
          name={icon as any} 
          size={16} 
          color={isDanger ? theme.error : theme.primary} 
        />
      </View>
      <View style={styles.menuContent}>
        <ThemedText style={[styles.menuTitle, isDanger && styles.dangerText]}>
          {title}
        </ThemedText>
        {desc && (
          <ThemedText style={styles.menuDesc}>{desc}</ThemedText>
        )}
      </View>
      {value && (
        <ThemedText style={styles.menuValue}>{value}</ThemedText>
      )}
      {hasArrow && onPress && (
        <FontAwesome6 
          name="chevron-right" 
          size={14} 
          color={theme.textMuted}
          style={styles.menuArrow}
        />
      )}
    </TouchableOpacity>
  );

  // 开关菜单项
  const SwitchMenuItem = ({
    icon,
    title,
    desc,
    value,
    onValueChange,
    isLast = false,
    disabled = false,
  }: {
    icon: string;
    title: string;
    desc?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    isLast?: boolean;
    disabled?: boolean;
  }) => (
    <View style={[styles.menuItem, isLast && styles.menuItemLast]}>
      <View style={styles.menuIcon}>
        <FontAwesome6 name={icon as any} size={16} color={theme.primary} />
      </View>
      <View style={styles.menuContent}>
        <ThemedText style={styles.menuTitle}>{title}</ThemedText>
        {desc && (
          <ThemedText style={styles.menuDesc}>{desc}</ThemedText>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.border, true: theme.primary + '50' }}
        thumbColor={value ? theme.primary : theme.backgroundTertiary}
        style={styles.switch}
      />
    </View>
  );

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <AppHeader title="设置" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  const ocrModeLabel = {
    'local': '本地优先',
    'cloud': '云端识别',
    'cloud-first': '云端优先',
  };

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader title="设置" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* OCR设置 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>OCR识别</ThemedText>
          <View style={styles.menuGroup}>
            <SwitchMenuItem
              icon="cloud"
              title="启用云端识别"
              desc="开启后可使用云端AI进行高精度识别"
              value={settings?.preferences.cloudOcrEnabled || false}
              onValueChange={(v) => updatePreference('cloudOcrEnabled', v)}
            />
            <SwitchMenuItem
              icon="brain"
              title="启用AI大模型服务"
              desc="开启后可使用AI标签推荐、OCR内容梳理等功能"
              value={settings?.preferences.aiServiceEnabled !== false}
              onValueChange={(v) => updatePreference('aiServiceEnabled', v)}
              isLast
            />
          </View>
          <ThemedText style={styles.tipText}>
            默认使用本地识别，云端识别可在重试时选择使用
          </ThemedText>
        </View>

        {/* 数据存储 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>数据存储</ThemedText>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="folder"
              title="存储模式"
              desc={STORAGE_MODE_OPTIONS.find(o => o.key === (settings?.preferences.storageMode || 'local-only'))?.desc || '仅保存在本地设备'}
              value={STORAGE_MODE_OPTIONS.find(o => o.key === (settings?.preferences.storageMode || 'local-only'))?.name || '本地存储'}
              onPress={() => setStorageModalVisible(true)}
            />
            {(settings?.preferences.storageMode === 'cloud') && (
              <SwitchMenuItem
                icon="lock"
                title="允许私密票据云端存储"
                desc="关闭后私密票据仅保存在本地"
                value={settings?.preferences.allowPrivateCloudStorage !== false}
                onValueChange={(v) => updatePreference('allowPrivateCloudStorage', v)}
                isLast
              />
            )}
          </View>
        </View>

        {/* 隐私与安全 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>隐私与安全</ThemedText>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="key"
              title="隐私箱密码"
              desc={settings?.privacy.hasPassword ? '已设置密码，点击修改' : '设置隐私箱访问密码'}
              onPress={() => {
                if (!settings?.isPro) {
                  Toast.show({ type: 'error', text1: '隐私箱为专业版功能' });
                  return;
                }
                router.push('/privacy-password' as any);
              }}
              isLast
            />
          </View>
        </View>

        {/* 主题与外观 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>主题与外观</ThemedText>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="palette"
              title="主题皮肤"
              desc="选择喜欢的配色方案"
              value={settings?.preferences.theme || '默认'}
              onPress={() => router.push('/themes' as any)}
              isLast
            />
          </View>
        </View>

        {/* 其他功能 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>其他</ThemedText>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="upload"
              title="数据备份"
              desc="导出或导入备份数据"
              onPress={() => router.push('/backup' as any)}
            />
            <MenuItem
              icon="trash-can"
              title="回收站"
              desc="查看已删除的票据"
              onPress={() => router.push('/recycle-bin' as any)}
            />
            <MenuItem
              icon="circle-question"
              title="帮助与反馈"
              desc="使用指南和问题反馈"
              onPress={() => router.push('/help' as any)}
              isLast
            />
          </View>
        </View>

        {/* 关于 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>关于</ThemedText>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="info-circle"
              title="关于票夹管家"
              isLast
              onPress={() => {
                Toast.show({ type: 'info', text1: '票夹管家 v1.0.0' });
              }}
            />
          </View>
        </View>

        {/* 版本信息 */}
        <View style={styles.versionInfo}>
          <ThemedText style={styles.versionText}>
            票夹管家 v1.0.0
          </ThemedText>
          <ThemedText style={styles.versionText}>
            © 2024 TicketKeeper
          </ThemedText>
        </View>
      </ScrollView>

      {/* OCR模式选择弹窗 */}
      <Modal
        visible={ocrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOcrModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setOcrModalVisible(false)}
        >
          <View style={{
            width: '85%',
            backgroundColor: theme.backgroundDefault,
            borderRadius: BorderRadius.xl,
            overflow: 'hidden',
          }}>
            {/* 弹窗标题 */}
            <View style={{
              paddingVertical: Spacing.lg,
              paddingHorizontal: Spacing.xl,
              borderBottomWidth: 1,
              borderBottomColor: theme.borderLight,
            }}>
              <ThemedText variant="h4" color={theme.textPrimary}>
                选择识别模式
              </ThemedText>
            </View>

            {/* 选项列表 */}
            {OCR_MODE_OPTIONS.map((option, index) => {
              const isSelected = settings?.preferences.ocrMode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: Spacing.lg,
                    paddingHorizontal: Spacing.xl,
                    borderBottomWidth: index < OCR_MODE_OPTIONS.length - 1 ? 1 : 0,
                    borderBottomColor: theme.borderLight,
                    backgroundColor: isSelected ? theme.primary + '10' : theme.backgroundDefault,
                  }}
                  onPress={() => selectOcrMode(option.key)}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                      {option.name}
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: 2 }}>
                      {option.desc}
                    </ThemedText>
                  </View>
                  {isSelected && (
                    <FontAwesome6 name="check" size={18} color={theme.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* 取消按钮 */}
            <TouchableOpacity
              style={{
                paddingVertical: Spacing.lg,
                alignItems: 'center',
                backgroundColor: theme.backgroundTertiary,
              }}
              onPress={() => setOcrModalVisible(false)}
            >
              <ThemedText variant="bodyMedium" color={theme.textSecondary}>
                取消
              </ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 存储模式选择弹窗 */}
      <Modal
        visible={storageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStorageModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setStorageModalVisible(false)}
        >
          <View
            style={{
              backgroundColor: theme.backgroundDefault,
              borderTopLeftRadius: BorderRadius.xl,
              borderTopRightRadius: BorderRadius.xl,
              overflow: 'hidden',
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* 标题 */}
            <View style={{
              paddingVertical: Spacing.lg,
              paddingHorizontal: Spacing.xl,
              borderBottomWidth: 1,
              borderBottomColor: theme.borderLight,
            }}>
              <ThemedText variant="h4" color={theme.textPrimary}>
                选择存储模式
              </ThemedText>
            </View>

            {/* 选项列表 */}
            {STORAGE_MODE_OPTIONS.map((option, index) => {
              const isSelected = (settings?.preferences.storageMode || 'local') === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: Spacing.lg,
                    paddingHorizontal: Spacing.xl,
                    borderBottomWidth: index < STORAGE_MODE_OPTIONS.length - 1 ? 1 : 0,
                    borderBottomColor: theme.borderLight,
                    backgroundColor: isSelected ? theme.primary + '10' : theme.backgroundDefault,
                  }}
                  onPress={() => selectStorageMode(option.key)}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                      {option.name}
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: 2 }}>
                      {option.desc}
                    </ThemedText>
                  </View>
                  {isSelected && (
                    <FontAwesome6 name="check" size={18} color={theme.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* 取消按钮 */}
            <TouchableOpacity
              style={{
                paddingVertical: Spacing.lg,
                alignItems: 'center',
                backgroundColor: theme.backgroundTertiary,
              }}
              onPress={() => setStorageModalVisible(false)}
            >
              <ThemedText variant="bodyMedium" color={theme.textSecondary}>
                取消
              </ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
