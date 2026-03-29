import React, { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface MembershipStatus {
  level: string;
  name: string;
  expiredAt: string | null;
  isExpired: boolean;
  trialUsed: boolean;
}

interface Benefits {
  exportWithImage: boolean;
  multiDevice: boolean;
  privacyBox: boolean;
  themeUnlock: boolean;
}

// 格式化日期
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function MembershipScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { token, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<MembershipStatus | null>(null);
  const [benefits, setBenefits] = useState<Benefits | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 获取会员状态
  const fetchMembershipStatus = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/membership/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        setMembership(data.membership);
        setBenefits(data.benefits);
        
        // 同步更新AuthContext中的会员状态
        if (data.membership) {
          updateUser({
            memberLevel: data.membership.level as 'free' | 'pro' | 'trial',
            memberExpiredAt: data.membership.expiredAt,
          });
        }
      } else {
        Toast.show({ type: 'error', text1: '获取会员状态失败', text2: data.error });
      }
    } catch (error) {
      console.error('获取会员状态失败:', error);
      Toast.show({ type: 'error', text1: '网络错误', text2: '请检查网络连接' });
    } finally {
      setLoading(false);
    }
  }, [token, updateUser]);

  // 开通试用
  const handleStartTrial = async () => {
    if (!token) return;

    try {
      setPurchasing(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/membership/trial`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        Toast.show({ type: 'success', text1: '试用已开通', text2: '有效期3天' });
        // 立即更新AuthContext中的会员状态
        updateUser({
          memberLevel: 'trial',
          memberExpiredAt: data.expiredAt,
        });
        fetchMembershipStatus();
      } else {
        Toast.show({ type: 'error', text1: '开通失败', text2: data.error });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    } finally {
      setPurchasing(false);
    }
  };

  // 购买会员
  const handlePurchase = async () => {
    if (!token) return;

    setShowConfirmModal(false);
    try {
      setPurchasing(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/membership/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: selectedPlan }),
      });
      const data = await response.json();

      if (data.success) {
        Toast.show({ type: 'success', text1: '购买成功', text2: '感谢您的支持' });
        // 立即更新AuthContext中的会员状态
        updateUser({
          memberLevel: 'pro',
          memberExpiredAt: data.expiredAt,
        });
        fetchMembershipStatus();
      } else {
        Toast.show({ type: 'error', text1: '购买失败', text2: data.error });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    } finally {
      setPurchasing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMembershipStatus();
    }, [fetchMembershipStatus])
  );

  const isPro = membership?.level === 'pro' || membership?.level === 'trial';
  const showTrial = !membership?.trialUsed && !isPro;

  // 权益列表
  const benefitItems = [
    { icon: 'hard-drive', text: '存储空间', has: isPro },
    { icon: 'ticket', text: '无限票据', has: isPro },
    { icon: 'scan', text: '无限OCR识别', has: isPro },
    { icon: 'download', text: '导出原图', has: benefits?.exportWithImage || false },
    { icon: 'devices', text: '多设备同步', has: benefits?.multiDevice || false },
    { icon: 'lock', text: '隐私箱', has: benefits?.privacyBox || false },
    { icon: 'palette', text: '皮肤主题', has: benefits?.themeUnlock || false },
  ];

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <AppHeader title="会员中心" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader title="会员中心" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 会员状态头部 */}
        <View style={styles.header}>
          <View style={styles.crownIcon}>
            <FontAwesome6 
              name="crown" 
              size={28} 
              color={isPro ? theme.accent : theme.textMuted} 
            />
          </View>
          <ThemedText variant="h4" color={theme.textPrimary}>
            {membership?.name || '免费版'}
          </ThemedText>
          {membership?.expiredAt && (
            <ThemedText variant="small" color={theme.textSecondary}>
              有效期至 {formatDate(membership.expiredAt)}
            </ThemedText>
          )}
          {membership?.isExpired && (
            <ThemedText style={styles.expiredText}>
              会员已过期
            </ThemedText>
          )}
          <View style={styles.memberBadge}>
            <ThemedText style={styles.memberBadgeText}>
              {isPro ? '专业版会员' : '免费版用户'}
            </ThemedText>
          </View>
        </View>

        {/* 权益列表 */}
        <ThemedText style={styles.sectionTitle}>专业版权益</ThemedText>
        <View style={styles.benefitsList}>
          {benefitItems.map((item, index) => (
            <View 
              key={item.icon} 
              style={[
                styles.benefitItem,
                index === benefitItems.length - 1 && { borderBottomWidth: 0 }
              ]}
            >
              <View style={styles.benefitIcon}>
                <FontAwesome6 
                  name={item.icon as any} 
                  size={16} 
                  color={item.has ? theme.primary : theme.textMuted} 
                />
              </View>
              <ThemedText style={[
                styles.benefitText,
                !item.has && { color: theme.textMuted }
              ]}>
                {item.text}
              </ThemedText>
              {item.has && (
                <FontAwesome6 
                  name="check" 
                  size={16} 
                  color={theme.success}
                  style={styles.benefitCheck}
                />
              )}
            </View>
          ))}
        </View>

        {/* 试用入口 */}
        {showTrial && (
          <>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleStartTrial}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>
                  免费试用3天专业版
                </ThemedText>
              )}
            </TouchableOpacity>
            <ThemedText style={styles.disclaimer}>
              新用户专享3天专业版体验，试用结束后自动恢复为免费版
            </ThemedText>
          </>
        )}

        {/* 购买会员 */}
        {!isPro && !showTrial && (
          <>
            <ThemedText style={styles.sectionTitle}>升级专业版</ThemedText>
            <View style={styles.priceCards}>
              <TouchableOpacity 
                style={[
                  styles.priceCard,
                  selectedPlan === 'monthly' && styles.priceCardSelected
                ]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <ThemedText style={styles.priceTitle}>包月</ThemedText>
                <View style={styles.priceValue}>
                  <ThemedText style={styles.priceCurrency}>¥</ThemedText>
                  <ThemedText style={styles.priceAmount}>19.9</ThemedText>
                </View>
                <ThemedText style={styles.pricePeriod}>/月</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.priceCard,
                  selectedPlan === 'yearly' && styles.priceCardSelected,
                  styles.priceCardRecommended
                ]}
                onPress={() => setSelectedPlan('yearly')}
              >
                <View style={styles.recommendedBadge}>
                  <ThemedText style={styles.recommendedText}>推荐</ThemedText>
                </View>
                <ThemedText style={styles.priceTitle}>包年</ThemedText>
                <View style={styles.priceValue}>
                  <ThemedText style={styles.priceCurrency}>¥</ThemedText>
                  <ThemedText style={styles.priceAmount}>199</ThemedText>
                </View>
                <ThemedText style={styles.pricePeriod}>/年（省¥39.8）</ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => setShowConfirmModal(true)}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>
                  立即开通
                </ThemedText>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* 已是会员显示续费 */}
        {isPro && (
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <ThemedText style={styles.secondaryButtonText}>
                续费会员
              </ThemedText>
            )}
          </TouchableOpacity>
        )}

        <ThemedText style={styles.disclaimer}>
          开通即表示同意《会员服务协议》{'\n'}
          会员权益立即生效，虚拟商品不支持退款
        </ThemedText>
      </ScrollView>

      {/* 支付确认弹窗 */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>确认开通专业版</ThemedText>
            <ThemedText style={styles.modalMessage}>
              {selectedPlan === 'monthly' ? '包月会员 19.9元/月' : '包年会员 199元/年'}
              {'\n\n'}
              会员权益立即生效，虚拟商品不支持退款
            </ThemedText>
            <ThemedText style={styles.modalPrice}>
              ¥{selectedPlan === 'monthly' ? '19.9' : '199'}
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowConfirmModal(false)}
              >
                <ThemedText style={styles.modalCancelText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={handlePurchase}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.modalConfirmText}>确认支付</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
