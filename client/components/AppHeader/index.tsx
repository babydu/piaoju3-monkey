import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useSegments } from 'expo-router';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createStyles } from './styles';

interface AppHeaderProps {
  showBack?: boolean;
  title?: string;
  rightAction?: React.ReactNode;
  onBackPress?: () => boolean | void;
}

const MENU_ITEMS = [
  { icon: 'trash', label: '回收站', route: '/recycle-bin' },
  { icon: 'folder', label: '合集管理', route: '/collections' },
  { icon: 'tags', label: '标签管理', route: '/tags' },
  { icon: 'cloud-arrow-up', label: '数据备份', route: '/backup' },
  { icon: 'gear', label: '设置', route: '/settings' },
  { icon: 'crown', label: '会员中心', route: '/membership' },
  { icon: 'circle-question', label: '帮助反馈', route: '/help' },
];

export default function AppHeader({ showBack = false, title, rightAction, onBackPress }: AppHeaderProps) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const segments = useSegments();
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  
  const slideAnim = useMemo(() => new Animated.Value(Dimensions.get('window').width), []);

  // 判断是否在首页
  const isHomePage = segments.length === 1 && segments[0] === 'index';

  useEffect(() => {
    if (menuVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').width,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [menuVisible]);

  const handleAvatarPress = () => {
    router.push('/profile');
  };

  const handleLogoPress = () => {
    // 如果不在首页，点击logo返回首页
    if (!isHomePage) {
      router.navigate('/');
    }
  };

  const handleMenuPress = (route: string) => {
    setMenuVisible(false);
    setTimeout(() => {
      router.push(route);
    }, 200);
  };

  const handleBack = () => {
    if (onBackPress) {
      const shouldBlock = onBackPress();
      if (shouldBlock === true) return;
    }
    // 尝试返回，如果无法返回则导航到首页
    try {
      router.back();
    } catch (error) {
      // 如果返回失败，导航到首页
      router.navigate('/');
    }
  };

  return (
    <>
      <View style={styles.header}>
        {/* Left Section */}
        <View style={styles.leftSection}>
          {showBack ? (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <FontAwesome6 name="arrow-left" size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.avatarButton} onPress={handleAvatarPress}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <FontAwesome6 name="user" size={16} color={theme.textMuted} />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Center - Logo */}
        <View style={styles.centerSection}>
          <TouchableOpacity 
            style={styles.logo} 
            onPress={handleLogoPress}
            activeOpacity={isHomePage ? 1 : 0.7}
            disabled={isHomePage}
          >
            <View style={styles.logoIcon}>
              <FontAwesome6 name="ticket" size={14} color="#FFFFFF" />
            </View>
            <ThemedText variant="smallMedium" color={theme.textPrimary} style={styles.logoText}>
              {title || '票夹管家'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Right Section */}
        <View style={styles.rightSection}>
          {rightAction}
          {!showBack && (
            <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
              <FontAwesome6 name="bars" size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Menu Modal - 实心遮罩 + 从右侧滑出面板 */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* 左侧点击区域关闭 */}
          <Pressable 
            style={styles.modalDismissArea}
            onPress={() => setMenuVisible(false)}
          />
          
          {/* 右侧菜单面板 */}
          <Animated.View
            style={[
              styles.menuPanel,
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            {/* 关闭按钮 */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setMenuVisible(false)}
            >
              <FontAwesome6 name="xmark" size={18} color={theme.textPrimary} />
            </TouchableOpacity>

            {/* Menu Header */}
            <View style={styles.menuHeader}>
              <View style={styles.menuHeaderIcon}>
                <FontAwesome6 name="ticket" size={20} color={theme.primary} />
              </View>
              <View>
                <ThemedText variant="h4" color={theme.textPrimary}>
                  票夹管家
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>
                  管理您的票据收藏
                </ThemedText>
              </View>
            </View>

            {/* Menu Items */}
            <View style={styles.menuItems}>
              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={styles.menuItem}
                  onPress={() => handleMenuPress(item.route)}
                >
                  <View style={styles.menuItemIcon}>
                    <FontAwesome6 name={item.icon} size={16} color={theme.primary} />
                  </View>
                  <ThemedText variant="body" color={theme.textPrimary}>
                    {item.label}
                  </ThemedText>
                  <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
