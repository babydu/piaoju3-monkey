import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Modal,
  Alert,
  Pressable,
  TextInput,
  Keyboard,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import AppHeader from '@/components/AppHeader';
import { Spacing, BorderRadius } from '@/constants/theme';
import Toast from 'react-native-toast-message';
import { unifiedStorageService, LocalTicket } from '@/services/local-storage';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';
const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_WIDTH = SCREEN_WIDTH - 32; // 减去左右边距
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface TicketImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  sortOrder: number;
}

interface Ticket {
  id: string;
  title: string;
  summary?: string | null;
  ocrText: string | null;
  collectionId: string | null;
  location: string | null;
  notes: string | null;
  ticketDate?: string | null;
  expiryDate?: string | null;
  isPrivate: boolean;
  createdAt: string;
  images: TicketImage[];
  tags: Array<{
    id: string;
    name: string;
  }>;
  collection?: {
    id: string;
    name: string;
  };
  // 本地票据标识
  isLocal?: boolean;
  isCloudSynced?: boolean;
}

export default function TicketDetailScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { token } = useAuth();
  const params = useSafeSearchParams<{ id: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [ocrExpanded, setOcrExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
  // 隐私验证状态
  const [needPrivacyVerify, setNeedPrivacyVerify] = useState(false);
  const [privacyPassword, setPrivacyPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [privacyUnlocked, setPrivacyUnlocked] = useState(false);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  
  // 重置密码弹窗状态
  const [showResetModal, setShowResetModal] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newHint, setNewHint] = useState('');
  const [resetting, setResetting] = useState(false);
  
  // 短信验证码相关
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  
  // 图片灯箱状态
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // 加载票据详情
  useEffect(() => {
    const fetchTicket = async () => {
      if (!params.id) return;

      setIsLoading(true);
      try {
        // 优先尝试从本地获取
        const localTicket = await unifiedStorageService.getTicket(params.id);
        
        if (localTicket) {
          // 检查是否是本地票据（通过判断是否有 localPath 属性）
          const isLocalTicket = 'images' in localTicket && 
            localTicket.images.length > 0 && 
            'localPath' in localTicket.images[0];
          
          if (isLocalTicket) {
            // 本地票据
            const localData = localTicket as LocalTicket;
            const ticketData: Ticket = {
              id: localData.id,
              title: localData.title,
              summary: localData.summary || null,
              ocrText: localData.ocrText || null,
              collectionId: localData.collectionId || null,
              location: localData.location || null,
              notes: localData.notes || null,
              ticketDate: localData.ticketDate || null,
              expiryDate: localData.expiryDate || null,
              isPrivate: localData.isPrivate,
              createdAt: localData.createdAt,
              images: localData.images.map(img => ({
                id: img.id,
                url: unifiedStorageService.getTicketImageUri(localData.id, img.localPath),
                thumbnailUrl: img.thumbnailPath 
                  ? unifiedStorageService.getTicketImageUri(localData.id, img.thumbnailPath)
                  : unifiedStorageService.getTicketImageUri(localData.id, img.localPath),
                sortOrder: img.sortOrder,
              })),
              tags: localData.tags.map((name, idx) => ({ id: `tag_${idx}`, name })),
              collection: localData.collectionName ? {
                id: localData.collectionId || '',
                name: localData.collectionName,
              } : undefined,
              isLocal: true,
              isCloudSynced: localData.isCloudSynced,
            };
            
            if (ticketData.isPrivate) {
              setTicket(ticketData);
              setNeedPrivacyVerify(true);
            } else {
              setTicket(ticketData);
              setNeedPrivacyVerify(false);
            }
            setIsLoading(false);
            return;
          }
        }

        // 如果没有token，无法从云端获取
        if (!token) {
          Toast.show({ type: 'error', text1: '票据不存在', text2: '未找到本地票据' });
          setIsLoading(false);
          return;
        }

        // 从云端获取
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (data.success) {
          const ticketData = data.ticket;
          
          // 如果是隐私票据，需要验证密码
          if (ticketData.isPrivate) {
            setTicket(ticketData);
            setNeedPrivacyVerify(true);
          } else {
            setTicket(ticketData);
            setNeedPrivacyVerify(false);
          }
        } else {
          Toast.show({ type: 'error', text1: '加载失败', text2: data.error || '无法加载票据详情' });
        }
      } catch (error) {
        console.error('获取票据详情失败:', error);
        Toast.show({ type: 'error', text1: '加载失败', text2: '无法加载票据详情' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTicket();
  }, [params.id, token]);

  // 加载用户手机号
  useEffect(() => {
    const loadUserPhone = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success && data.settings?.phone) {
          setUserPhone(data.settings.phone);
        }
      } catch (error) {
        console.error('加载用户手机号失败:', error);
      }
    };
    loadUserPhone();
  }, [token]);

  // 倒计时清理
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // 发送验证码
  const handleSendCode = async () => {
    if (countdown > 0 || sendingCode) return;
    
    setSendingCode(true);
    try {
      // 先获取用户完整手机号用于发送验证码
      const meResponse = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meResponse.json();
      
      if (!meData.success || !meData.user?.phone) {
        Toast.show({ type: 'error', text1: '无法获取手机号' });
        return;
      }

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: meData.user.phone }),
      });
      const data = await response.json();

      if (data.success) {
        Toast.show({ type: 'success', text1: '验证码已发送' });
        // 开始倒计时
        setCountdown(60);
        countdownRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        Toast.show({ type: 'error', text1: data.error || '发送失败' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    } finally {
      setSendingCode(false);
    }
  };

  // 验证隐私密码
  const handleVerifyPrivacy = async () => {
    if (!privacyPassword) {
      Toast.show({ type: 'error', text1: '请输入密码' });
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings/privacy-password/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: privacyPassword }),
      });

      const data = await response.json();
      if (data.success && data.valid) {
        setPrivacyUnlocked(true);
        setNeedPrivacyVerify(false);
        Toast.show({ type: 'success', text1: '验证成功' });
      } else {
        // 验证失败时显示提示语
        if (data.passwordHint) {
          setPasswordHint(data.passwordHint);
        }
        Toast.show({ type: 'error', text1: data.error || '密码错误' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    } finally {
      setVerifying(false);
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    Keyboard.dismiss();
    
    // 验证短信验证码
    if (!verifyCode) {
      Toast.show({ type: 'error', text1: '请输入短信验证码' });
      return;
    }
    if (!newPassword) {
      Toast.show({ type: 'error', text1: '请输入新密码' });
      return;
    }
    if (newPassword.length < 4) {
      Toast.show({ type: 'error', text1: '密码长度至少4位' });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: '两次输入的密码不一致' });
      return;
    }

    setResetting(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings/privacy-password/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verifyCode,
          newPassword,
          passwordHint: newHint || undefined,
        }),
      });
      const data = await response.json();

      if (data.success) {
        Toast.show({ type: 'success', text1: '密码重置成功' });
        setShowResetModal(false);
        setVerifyCode('');
        setNewPassword('');
        setConfirmPassword('');
        setNewHint('');
        setPasswordHint(newHint || null);
      } else {
        Toast.show({ type: 'error', text1: data.error || '重置失败' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!ticket || isDeleting) return;

    setIsDeleting(true);
    setShowDeleteConfirm(false);
    
    try {
      // 统一使用 unifiedStorageService 删除，会自动处理本地和云端
      const deleted = await unifiedStorageService.deleteTicket(ticket.id, token ?? undefined);
      
      if (deleted) {
        Toast.show({ 
          type: 'success', 
          text1: '删除成功', 
          text2: ticket.isCloudSynced ? '票据已移至回收站' : '票据已删除', 
          position: 'top' 
        });
        setTimeout(() => router.back(), 500);
      } else {
        Toast.show({ type: 'error', text1: '删除失败', text2: '票据不存在' });
      }
    } catch (error) {
      console.error('删除票据失败:', error);
      Toast.show({ type: 'error', text1: '删除失败', text2: '请检查网络后重试' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!ticket) return;
    router.push('/ticket-edit', { id: ticket.id });
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const renderImageItem = ({ item, index }: { item: { id: string; url: string }; index: number }) => {
    const hasError = imageErrors.has(item.id);
    
    return (
      <TouchableOpacity 
        style={styles.imageSlide}
        activeOpacity={0.9}
        onPress={() => {
          setLightboxIndex(index);
          setLightboxVisible(true);
        }}
      >
        {!hasError ? (
          <Image
            source={{ uri: item.url }}
            style={styles.previewImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            onError={() => {
              setImageErrors(prev => new Set(prev).add(item.id));
            }}
          />
        ) : (
          <View style={styles.imageErrorContainer}>
            <FontAwesome6 name="image" size={40} color={theme.textMuted} />
            <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: Spacing.sm }}>图片加载失败</ThemedText>
            <TouchableOpacity 
              style={{ marginTop: Spacing.sm, padding: Spacing.sm }}
              onPress={() => {
                const newErrors = new Set(imageErrors);
                newErrors.delete(item.id);
                setImageErrors(newErrors);
              }}
            >
              <ThemedText variant="small" color={theme.primary}>点击重试</ThemedText>
            </TouchableOpacity>
          </View>
        )}
        {ticket && ticket.images.length > 1 && (
          <View style={styles.imageBadge}>
            <ThemedText variant="caption" color="#FFFFFF">{index + 1}/{ticket.images.length}</ThemedText>
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  // 灯箱图片列表项
  const renderLightboxItem = ({ item, index }: { item: { id: string; url: string }; index: number }) => {
    return (
      <View style={styles.lightboxSlide}>
        <Image
          source={{ uri: item.url }}
          style={styles.lightboxImage}
          contentFit="contain"
        />
      </View>
    );
  };

  // 加载中状态
  if (isLoading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <AppHeader showBack title="票据详情" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  // 隐私票据需要验证密码
  if (needPrivacyVerify && !privacyUnlocked) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <AppHeader showBack title="隐私票据" />
        <View style={styles.privacyVerifyContainer}>
          <View style={styles.lockIconContainer}>
            <FontAwesome6 name="lock" size={40} color={theme.primary} />
          </View>
          
          <ThemedText variant="h4" color={theme.textPrimary} style={styles.privacyTitle}>
            这是一个私密票据
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.privacyDesc}>
            请输入隐私密码查看内容
          </ThemedText>

          <View style={styles.privacyInputContainer}>
            <TextInput
              style={styles.privacyInput}
              placeholder="请输入密码"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={privacyPassword}
              onChangeText={setPrivacyPassword}
              onSubmitEditing={handleVerifyPrivacy}
            />
          </View>

          {/* 显示密码提示语 */}
          {passwordHint && (
            <View style={styles.hintBox}>
              <FontAwesome6 name="lightbulb" size={14} color={theme.textMuted} />
              <ThemedText variant="small" color={theme.textMuted} style={styles.hintText}>
                提示：{passwordHint}
              </ThemedText>
            </View>
          )}

          <TouchableOpacity 
            style={styles.privacyButton} 
            onPress={handleVerifyPrivacy}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.privacyButtonText}>验证</ThemedText>
            )}
          </TouchableOpacity>

          {/* 忘记密码入口 */}
          <TouchableOpacity 
            style={styles.forgotButton}
            onPress={() => setShowResetModal(true)}
          >
            <ThemedText variant="small" color={theme.primary}>
              忘记密码？
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* 重置密码弹窗 */}
        <Modal
          visible={showResetModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowResetModal(false)}
        >
          <View style={styles.resetModalOverlay}>
            <View style={styles.resetModalContent}>
              <View style={styles.resetModalHeader}>
                <ThemedText variant="h4" color={theme.textPrimary}>
                  重置隐私箱密码
                </ThemedText>
                <TouchableOpacity onPress={() => setShowResetModal(false)}>
                  <FontAwesome6 name="xmark" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.resetModalBody}>
                {/* 短信验证步骤 */}
                <View style={styles.verifySection}>
                  <ThemedText variant="small" color={theme.textSecondary}>
                    验证码将发送至 {userPhone || '您的手机'}
                  </ThemedText>
                  
                  <View style={styles.codeRow}>
                    <TextInput
                      style={styles.codeInput}
                      placeholder="请输入验证码"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={verifyCode}
                      onChangeText={setVerifyCode}
                    />
                    <TouchableOpacity 
                      style={[styles.sendCodeBtn, (countdown > 0 || sendingCode) && styles.sendCodeBtnDisabled]}
                      onPress={handleSendCode}
                      disabled={countdown > 0 || sendingCode}
                    >
                      {sendingCode ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <ThemedText variant="small" color={countdown > 0 ? theme.textMuted : theme.primary}>
                          {countdown > 0 ? `${countdown}s` : '发送验证码'}
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.divider} />

                <ThemedText variant="body" color={theme.textSecondary} style={styles.resetModalDesc}>
                  设置新的隐私箱密码，请务必牢记！
                </ThemedText>

                <View style={styles.resetInputGroup}>
                  <ThemedText variant="small" color={theme.textMuted} style={styles.resetLabel}>
                    新密码
                  </ThemedText>
                  <TextInput
                    style={styles.resetModalInput}
                    placeholder="请输入新密码（至少4位）"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>

                <View style={styles.resetInputGroup}>
                  <ThemedText variant="small" color={theme.textMuted} style={styles.resetLabel}>
                    确认密码
                  </ThemedText>
                  <TextInput
                    style={styles.resetModalInput}
                    placeholder="请再次输入新密码"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                <View style={styles.resetInputGroup}>
                  <ThemedText variant="small" color={theme.textMuted} style={styles.resetLabel}>
                    密码提示语（选填）
                  </ThemedText>
                  <TextInput
                    style={styles.resetModalInput}
                    placeholder="设置提示语帮助您回忆密码"
                    placeholderTextColor={theme.textMuted}
                    value={newHint}
                    onChangeText={setNewHint}
                    maxLength={100}
                  />
                </View>
              </ScrollView>

              <View style={styles.resetModalFooter}>
                <TouchableOpacity 
                  style={styles.resetCancelButton}
                  onPress={() => setShowResetModal(false)}
                >
                  <ThemedText color={theme.textSecondary}>取消</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.resetConfirmButton}
                  onPress={handleResetPassword}
                  disabled={resetting}
                >
                  {resetting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <ThemedText color={theme.buttonPrimaryText}>确认重置</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Screen>
    );
  }

  if (!ticket) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <AppHeader showBack title="票据详情" />
        <View style={styles.errorContainer}>
          <FontAwesome6 name="ticket" size={48} color={theme.textMuted} />
          <ThemedText variant="body" color={theme.textMuted}>票据不存在</ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader 
        showBack 
        title={ticket.title || '票据详情'}
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleEdit}>
              <FontAwesome6 name="pen" size={16} color={theme.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowDeleteConfirm(true)}>
              <FontAwesome6 name="trash" size={16} color={theme.error} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* 图片区域 */}
        <View style={styles.imageSection}>
          <FlatList
            data={ticket.images}
            renderItem={renderImageItem}
            keyExtractor={item => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / IMAGE_WIDTH);
              setCurrentImageIndex(index);
            }}
            getItemLayout={(_, index) => ({
              length: IMAGE_WIDTH,
              offset: IMAGE_WIDTH * index,
              index,
            })}
          />
          
          {/* 分页指示器 */}
          {ticket.images.length > 1 && (
            <View style={styles.pagination}>
              {ticket.images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    currentImageIndex === index && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* 票据信息 */}
        <View style={styles.infoSection}>
          {/* 标题和隐私标识 */}
          <View style={styles.titleRow}>
            <ThemedText variant="h3" color={theme.textPrimary} style={styles.title}>
              {ticket.title}
            </ThemedText>
            {ticket.isPrivate && (
              <View style={styles.privateBadge}>
                <FontAwesome6 name="lock" size={12} color={theme.primary} />
                <ThemedText variant="caption" color={theme.primary} style={{ marginLeft: 4 }}>私密</ThemedText>
              </View>
            )}
          </View>

          {/* 标签 */}
          {ticket.tags.length > 0 && (
            <View style={styles.tagRow}>
              {ticket.tags.map(tag => (
                <View key={tag.id} style={styles.tag}>
                  <ThemedText variant="small" color={theme.primary}>{tag.name}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* AI总结简介 */}
          {ticket.summary && (
            <View style={styles.summarySection}>
              <View style={styles.summaryHeader}>
                <FontAwesome6 name="wand-magic-sparkles" size={14} color={theme.primary} />
                <ThemedText variant="smallMedium" color={theme.primary} style={styles.summaryLabel}>
                  AI 简介
                </ThemedText>
              </View>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.summaryText}>
                {ticket.summary}
              </ThemedText>
            </View>
          )}

          {/* 基本信息 */}
          <View style={styles.infoGrid}>
            {ticket.ticketDate && (
              <View style={styles.infoItem}>
                <FontAwesome6 name="calendar" size={14} color={theme.textMuted} />
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoText}>
                  {formatDate(ticket.ticketDate)}
                </ThemedText>
              </View>
            )}
            
            {ticket.expiryDate && (
              <View style={styles.infoItem}>
                <FontAwesome6 name="clock" size={14} color={theme.textMuted} />
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoText}>
                  有效期至 {formatDate(ticket.expiryDate)}
                </ThemedText>
              </View>
            )}
            
            {ticket.location && (
              <View style={styles.infoItem}>
                <FontAwesome6 name="location-dot" size={14} color={theme.textMuted} />
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoText}>
                  {ticket.location}
                </ThemedText>
              </View>
            )}
            
            {ticket.collection && (
              <View style={styles.infoItem}>
                <FontAwesome6 name="folder" size={14} color={theme.textMuted} />
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoText}>
                  {ticket.collection.name}
                </ThemedText>
              </View>
            )}
          </View>

          {/* 备注 */}
          {ticket.notes && (
            <View style={styles.notesSection}>
              <ThemedText variant="smallMedium" color={theme.textMuted} style={styles.sectionLabel}>
                备注
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary}>
                {ticket.notes}
              </ThemedText>
            </View>
          )}

          {/* OCR识别文本 */}
          {ticket.ocrText && (
            <View style={styles.ocrSection}>
              <TouchableOpacity 
                style={styles.ocrHeader} 
                onPress={() => setOcrExpanded(!ocrExpanded)}
              >
                <ThemedText variant="smallMedium" color={theme.textMuted}>
                  识别文本
                </ThemedText>
                <FontAwesome6 
                  name={ocrExpanded ? "chevron-up" : "chevron-down"} 
                  size={12} 
                  color={theme.textMuted} 
                />
              </TouchableOpacity>
              {ocrExpanded && (
                <ThemedText variant="body" color={theme.textSecondary} style={styles.ocrText}>
                  {ticket.ocrText}
                </ThemedText>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 删除确认弹窗 */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteConfirm(false)}>
          <Pressable style={styles.confirmModal} onPress={e => e.stopPropagation()}>
            <ThemedText variant="h4" color={theme.textPrimary} style={{ marginBottom: Spacing.md }}>
              确认删除
            </ThemedText>
            <ThemedText variant="body" color={theme.textSecondary} style={{ marginBottom: Spacing.lg }}>
              删除后将移至回收站，可在30天内恢复
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <ThemedText variant="bodyMedium" color={theme.textSecondary}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={handleDeleteConfirm}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText variant="bodyMedium" color="#FFFFFF">删除</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 图片灯箱 */}
      <Modal
        visible={lightboxVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
      >
        <View style={styles.lightboxContainer}>
          <TouchableOpacity 
            style={styles.lightboxClose}
            onPress={() => setLightboxVisible(false)}
          >
            <FontAwesome6 name="xmark" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <FlatList
            data={ticket.images}
            renderItem={renderLightboxItem}
            keyExtractor={item => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={lightboxIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />
          
          <View style={styles.lightboxInfo}>
            <ThemedText variant="body" color="#FFFFFF">
              {lightboxIndex + 1} / {ticket.images.length}
            </ThemedText>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
