import React, { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import AppHeader from '@/components/AppHeader';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

export default function PrivacyPasswordScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { token } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  // 检查是否已设置密码
  React.useEffect(() => {
    const checkPassword = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          setHasPassword(data.settings?.privacy?.hasPassword || false);
          // 加载已有的提示语
          if (data.settings?.privacy?.passwordHint) {
            setPasswordHint(data.settings.privacy.passwordHint);
          }
        }
      } catch (error) {
        console.error('检查密码状态失败:', error);
      }
    };
    checkPassword();
  }, [token]);

  const handleSubmit = async () => {
    Keyboard.dismiss();

    // 验证输入
    if (hasPassword && !currentPassword) {
      Toast.show({ type: 'error', text1: '请输入当前密码' });
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

    // 提示语长度验证
    if (passwordHint && passwordHint.length > 100) {
      Toast.show({ type: 'error', text1: '密码提示语最长100个字符' });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings/privacy-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password: newPassword,
          oldPassword: hasPassword ? currentPassword : undefined,
          passwordHint: passwordHint || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Toast.show({ type: 'success', text1: hasPassword ? '密码已修改' : '密码设置成功' });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: data.error || '操作失败' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader title={hasPassword ? '修改密码' : '设置密码'} />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconContainer}>
          <FontAwesome6 name="lock" size={40} color={theme.primary} />
        </View>

        <ThemedText variant="body" color={theme.textSecondary} style={styles.desc}>
          {hasPassword 
            ? '请输入当前密码和新密码' 
            : '设置隐私箱访问密码，保护您的私密票据'}
        </ThemedText>

        {/* 警告提示 */}
        <View style={styles.warningBox}>
          <FontAwesome6 name="circle-exclamation" size={16} color="#F59E0B" />
          <ThemedText variant="small" color="#F59E0B" style={styles.warningText}>
            请务必牢记密码，忘记后将无法找回！
          </ThemedText>
        </View>

        <View style={styles.form}>
          {hasPassword && (
            <View style={styles.inputGroup}>
              <ThemedText variant="small" color={theme.textMuted} style={styles.label}>
                当前密码
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="请输入当前密码"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <ThemedText variant="small" color={theme.textMuted} style={styles.label}>
              新密码
            </ThemedText>
            <TextInput
              style={styles.input}
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
              style={styles.input}
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
              style={styles.input}
              placeholder="设置提示语帮助您回忆密码"
              placeholderTextColor={theme.textMuted}
              value={passwordHint}
              onChangeText={setPasswordHint}
              maxLength={100}
            />
            <ThemedText variant="caption" color={theme.textMuted} style={styles.hintCount}>
              {passwordHint.length}/100
            </ThemedText>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.buttonText}>
              {hasPassword ? '修改密码' : '设置密码'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}
