import React, { useMemo, useState, useCallback } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { ImageEditorModal } from '@/components/ImageEditor';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createFormDataFile } from '@/utils';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface Stats {
  ticketCount: number;
  imageCount: number;
  ocrCount: number;
  storageUsed: number;
  storageLimit: number;
  memberLevel: string;
}

export default function ProfileScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, logout, updateUser, token } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // 头像编辑器状态
  const [avatarEditorVisible, setAvatarEditorVisible] = useState(false);
  const [selectedAvatarUri, setSelectedAvatarUri] = useState<string | null>(null);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [user?.id]);

  // 页面获得焦点时刷新
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const storagePercentage = stats && stats.storageLimit > 0 ? (stats.storageUsed / stats.storageLimit) * 100 : 0;

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    await logout();
    router.replace('/login');
  };

  // 头像上传
  const handleAvatarPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: '权限不足', text2: '需要相册权限才能选择头像' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // 禁用系统自带编辑，使用我们的编辑器
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // 打开编辑器进行编辑
      setSelectedAvatarUri(result.assets[0].uri);
      setAvatarEditorVisible(true);
    }
  };

  // 头像编辑完成
  const handleAvatarEditSave = async (editedUri: string) => {
    setAvatarEditorVisible(false);
    setSelectedAvatarUri(null);
    await uploadAvatar(editedUri);
  };

  const uploadAvatar = async (imageUri: string) => {
    if (!token) {
      Toast.show({ type: 'error', text1: '请先登录' });
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      const filename = `avatar_${Date.now()}.jpg`;
      
      // 使用 createFormDataFile 创建跨平台兼容的文件对象
      const file = await createFormDataFile(imageUri, filename, 'image/jpeg');
      formData.append('avatar', file as any);

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        updateUser({ avatar: data.avatarUrl });
        Toast.show({ type: 'success', text1: '头像已更新' });
      } else {
        const errorMsg = data.error || '上传失败';
        console.error('头像上传失败:', errorMsg, 'Response:', data);
        Toast.show({ type: 'error', text1: '上传失败', text2: errorMsg });
      }
    } catch (error) {
      console.error('上传头像失败:', error);
      Toast.show({ type: 'error', text1: '上传失败', text2: '请检查网络后重试' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <Screen
      backgroundColor={theme.backgroundRoot}
      statusBarStyle={isDark ? 'light' : 'dark'}
      safeAreaEdges={['top']}
    >
      <AppHeader title="个人中心" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.avatarContainer} 
              onPress={handleAvatarPress}
              disabled={uploadingAvatar}
            >
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <FontAwesome6 name="user" size={40} color={theme.textMuted} />
                </View>
              )}
              {uploadingAvatar && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <FontAwesome6 name="camera" size={12} color={theme.buttonPrimaryText} />
              </View>
            </TouchableOpacity>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.phoneText}>
              {user?.phone || '未登录'}
            </ThemedText>
            <View style={styles.memberBadge}>
              <ThemedText variant="captionMedium" color="#FFFFFF">
                {stats?.memberLevel === 'pro' ? '专业版' : '免费版'}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <ThemedText variant="smallMedium" color={theme.textMuted} style={styles.sectionTitle}>
            数据统计
          </ThemedText>

          {isLoadingStats ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {/* 票据数量 */}
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: theme.primary + '15' }]}>
                  <FontAwesome6 name="ticket" size={20} color={theme.primary} />
                </View>
                <ThemedText variant="h3" color={theme.textPrimary}>
                  {stats?.ticketCount || 0}
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>票据数量</ThemedText>
              </View>

              {/* 图片数量 */}
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#10B98115' }]}>
                  <FontAwesome6 name="images" size={20} color="#10B981" />
                </View>
                <ThemedText variant="h3" color={theme.textPrimary}>
                  {stats?.imageCount || 0}
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>图片数量</ThemedText>
              </View>

              {/* OCR次数 */}
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#F59E0B15' }]}>
                  <FontAwesome6 name="wand-magic-sparkles" size={20} color="#F59E0B" />
                </View>
                <ThemedText variant="h3" color={theme.textPrimary}>
                  {stats?.ocrCount || 0}
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>OCR识别</ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* Storage Card */}
        <View style={styles.storageCard}>
          <View style={styles.storageHeader}>
            <View style={styles.storageTitleRow}>
              <FontAwesome6 name="hard-drive" size={16} color={theme.primary} />
              <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.storageTitle}>
                存储空间
              </ThemedText>
            </View>
            <ThemedText variant="small" color={theme.textMuted} style={styles.storageUsage}>
              {formatBytes(stats?.storageUsed || 0)} / {formatBytes(stats?.storageLimit || 0)}
            </ThemedText>
          </View>
          <View style={styles.storageBar}>
            <View
              style={[
                styles.storageProgress,
                { width: `${Math.min(storagePercentage, 100)}%` },
              ]}
            />
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <ThemedText variant="smallMedium" color={theme.textMuted} style={styles.menuTitle}>
            账户设置
          </ThemedText>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings')}>
            <View style={styles.menuLeft}>
              <FontAwesome6 name="gear" size={20} color={theme.textPrimary} />
              <ThemedText variant="body" color={theme.textPrimary} style={styles.menuText}>
                设置
              </ThemedText>
            </View>
            <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/membership')}>
            <View style={styles.menuLeft}>
              <FontAwesome6 name="crown" size={20} color={theme.accent} />
              <ThemedText variant="body" color={theme.textPrimary} style={styles.menuText}>
                会员中心
              </ThemedText>
            </View>
            <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
          </TouchableOpacity>

          {/* 隐私箱入口 - 仅专业版可见 */}
          {stats?.memberLevel === 'pro' && (
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/privacy-box')}>
              <View style={styles.menuLeft}>
                <FontAwesome6 name="lock" size={20} color={theme.primary} />
                <ThemedText variant="body" color={theme.textPrimary} style={styles.menuText}>
                  隐私箱
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <ThemedText variant="bodyMedium" color={theme.error}>
            退出登录
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      {logoutModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              确认退出
            </ThemedText>
            <ThemedText variant="body" color={theme.textSecondary} style={styles.modalMessage}>
              确定要退出登录吗？
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setLogoutModalVisible(false)}
              >
                <ThemedText variant="bodyMedium" color={theme.textPrimary}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmLogout}
              >
                <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>确定</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 头像编辑器 */}
      {selectedAvatarUri && (
        <ImageEditorModal
          visible={avatarEditorVisible}
          imageUri={selectedAvatarUri}
          onClose={() => {
            setAvatarEditorVisible(false);
            setSelectedAvatarUri(null);
          }}
          onSave={handleAvatarEditSave}
          mode="avatar"
        />
      )}
    </Screen>
  );
}
