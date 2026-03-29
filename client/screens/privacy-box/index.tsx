import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Keyboard,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

export default function PrivacyBoxScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { token } = useAuth();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
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

  // 加载密码提示语和用户手机号
  useEffect(() => {
    const loadHint = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          if (data.settings?.privacy?.passwordHint) {
            setPasswordHint(data.settings.privacy.passwordHint);
          }
          if (data.settings?.phone) {
            setUserPhone(data.settings.phone);
          }
        }
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    };
    loadHint();
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

  // 验证密码
  const handleVerify = async () => {
    if (!password) {
      Toast.show({ type: 'error', text1: '请输入密码' });
      return;
    }

    try {
      setVerifying(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings/privacy-password/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (data.success && data.valid) {
        setIsUnlocked(true);
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

  // 渲染密码输入界面
  if (!isUnlocked) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <AppHeader title="隐私箱" />
        <View style={styles.container}>
          <View style={styles.lockIcon}>
            <FontAwesome6 name="lock" size={32} color={theme.primary} />
          </View>
          
          <ThemedText variant="h4" color={theme.textPrimary} style={styles.title}>
            隐私箱已锁定
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.desc}>
            请输入密码解锁隐私箱
          </ThemedText>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="请输入密码"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleVerify}
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
            style={styles.button} 
            onPress={handleVerify}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.buttonText}>解锁</ThemedText>
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
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <ThemedText variant="h4" color={theme.textPrimary}>
                  重置隐私箱密码
                </ThemedText>
                <TouchableOpacity onPress={() => setShowResetModal(false)}>
                  <FontAwesome6 name="xmark" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
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

                <ThemedText variant="body" color={theme.textSecondary} style={styles.modalDesc}>
                  设置新的隐私箱密码，请务必牢记！
                </ThemedText>

                <View style={styles.inputGroup}>
                  <ThemedText variant="small" color={theme.textMuted} style={styles.label}>
                    新密码
                  </ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="请输入新密码（至少4位）"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText variant="small" color={theme.textMuted} style={styles.label}>
                    确认密码
                  </ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="请再次输入新密码"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText variant="small" color={theme.textMuted} style={styles.label}>
                    密码提示语（选填）
                  </ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="设置提示语帮助您回忆密码"
                    placeholderTextColor={theme.textMuted}
                    value={newHint}
                    onChangeText={setNewHint}
                    maxLength={100}
                  />
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowResetModal(false)}
                >
                  <ThemedText color={theme.textSecondary}>取消</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.confirmButton}
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

  // 渲染私密票据列表
  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader title="隐私箱" />
      <ThemedView level="root" style={styles.scrollContent}>
        {/* 私密票据列表 */}
        <View style={styles.emptyContainer}>
          <FontAwesome6 name="box-archive" size={48} color={theme.textMuted} />
          <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
            暂无私密票据
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted}>
            在票据详情中设为私密后，将显示在这里
          </ThemedText>
        </View>
      </ThemedView>
    </Screen>
  );
}
