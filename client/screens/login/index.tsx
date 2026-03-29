import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { createStyles } from './styles';
import { mobVerifyService, VerifyStatus, OperatorType, MobEnvironment } from '@/src/native/MobVerify';

type LoginMode = 'oneClick' | 'sms';

export default function LoginScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { login, oneClickLogin, sendVerificationCode, isLoading } = useAuth();

  // 登录模式
  const [loginMode, setLoginMode] = useState<LoginMode>('oneClick');
  
  // 短信验证码登录
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState<string | null>(null); // 开发环境显示的验证码
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 秒验状态
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [operatorInfo, setOperatorInfo] = useState<{ operator: OperatorType }>({ operator: 'UNKNOWN' });
  const [isOneClickSupported, setIsOneClickSupported] = useState(false);
  const [environment, setEnvironment] = useState<MobEnvironment>('native');
  const [environmentMessage, setEnvironmentMessage] = useState('');

  // 检查秒验支持状态
  useEffect(() => {
    checkOneClickSupport();
  }, []);

  const checkOneClickSupport = async () => {
    try {
      // 获取环境信息
      const env = mobVerifyService.getEnvironment();
      const envMsg = mobVerifyService.getEnvironmentMessage();
      setEnvironment(env);
      setEnvironmentMessage(envMsg);
      
      console.log('[Login] 当前环境:', env, envMsg);
      
      const supported = await mobVerifyService.isSupported();
      setIsOneClickSupported(supported);
      
      if (supported) {
        // 获取运营商信息
        const info = await mobVerifyService.getOperatorInfo();
        setOperatorInfo(info);
        
        // 开始预取号
        preVerify();
      } else {
        // 不支持秒验，自动切换到短信验证码模式
        setLoginMode('sms');
      }
    } catch (error) {
      console.error('检查秒验支持失败:', error);
      setLoginMode('sms');
    }
  };

  // 预取号
  const preVerify = async () => {
    if (verifyStatus === 'preVerifying') return;
    
    setVerifyStatus('preVerifying');
    try {
      const result = await mobVerifyService.preVerify();
      if (result.success) {
        setVerifyStatus('ready');
      } else {
        setVerifyStatus('failed');
        console.log('预取号失败:', result.message);
      }
    } catch (error) {
      console.error('预取号失败:', error);
      setVerifyStatus('failed');
    }
  };

  // 一键登录
  const handleOneClickLogin = async () => {
    if (verifyStatus !== 'ready') {
      // 如果还没准备好，先预取号
      await preVerify();
      return;
    }

    setVerifyStatus('verifying');
    setIsLoggingIn(true);

    try {
      const result = await mobVerifyService.oneClickLogin();
      
      if (result.success && result.token) {
        // 使用 AuthContext 的 oneClickLogin 方法
        const loginResult = await oneClickLogin(result.token, result.operator || 'UNKNOWN');
        
        if (loginResult.success) {
          setVerifyStatus('success');
          router.replace('/');
        } else {
          setVerifyStatus('failed');
          alert(loginResult.error || '登录失败');
          // 重新预取号
          setTimeout(() => preVerify(), 1000);
        }
      } else {
        setVerifyStatus('failed');
        alert(result.message || '一键登录失败');
        // 重新预取号
        setTimeout(() => preVerify(), 1000);
      }
    } catch (error: any) {
      console.error('一键登录失败:', error);
      setVerifyStatus('failed');
      alert('网络错误，请稍后重试');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 发送验证码
  const handleSendCode = async () => {
    const isPhoneValid = /^1[3-9]\d{9}$/.test(phone);
    if (!isPhoneValid || countdown > 0 || isSendingCode) return;

    setIsSendingCode(true);
    setSentCode(null); // 清除之前的验证码
    try {
      const result = await sendVerificationCode(phone);
      if (result.success) {
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        // 开发环境：如果后端返回了验证码，显示给用户
        if (result.code) {
          setSentCode(result.code);
          console.log('[Login] 验证码:', result.code);
        }
      } else {
        alert(result.error || '发送验证码失败');
      }
    } catch (error) {
      console.error('发送验证码失败:', error);
      alert('网络错误，请稍后重试');
    } finally {
      setIsSendingCode(false);
    }
  };

  // 短信验证码登录
  const handleSmsLogin = async () => {
    const isPhoneValid = /^1[3-9]\d{9}$/.test(phone);
    const isCodeValid = /^\d{6}$/.test(code);
    if (!isPhoneValid || !isCodeValid || isLoggingIn) return;

    setIsLoggingIn(true);
    try {
      const result = await login(phone, code);
      if (result.success) {
        router.replace('/');
      } else {
        alert(result.error || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      alert('网络错误，请稍后重试');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 切换登录模式
  const toggleLoginMode = () => {
    setLoginMode(loginMode === 'oneClick' ? 'sms' : 'oneClick');
  };

  // 渲染状态文本
  const renderStatusText = () => {
    switch (verifyStatus) {
      case 'preVerifying':
        return '正在检测网络环境...';
      case 'ready':
        return `${mobVerifyService.getOperatorName(operatorInfo.operator)}用户可使用一键登录`;
      case 'verifying':
        return '正在验证...';
      case 'failed':
        return '一键登录失败，请重试或使用短信验证码';
      case 'notSupported':
        return '当前网络不支持一键登录';
      default:
        return '';
    }
  };

  const isPhoneValid = /^1[3-9]\d{9}$/.test(phone);
  const isCodeValid = /^\d{6}$/.test(code);
  const canSmsLogin = isPhoneValid && isCodeValid && !isLoggingIn;
  const canSendCode = isPhoneValid && countdown === 0 && !isSendingCode;
  const canOneClickLogin = verifyStatus === 'ready' && !isLoggingIn;

  if (isLoading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText variant="h1" color={theme.textPrimary} style={styles.title}>
              票夹管家
            </ThemedText>
            <ThemedText variant="body" color={theme.textSecondary} style={styles.subtitle}>
              收藏每一张票据，留住每一份回忆
            </ThemedText>
          </View>

          {/* 登录模式切换 */}
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeButton, loginMode === 'oneClick' && styles.modeButtonActive]}
              onPress={() => setLoginMode('oneClick')}
              disabled={!isOneClickSupported}
            >
              <ThemedText
                variant="smallMedium"
                color={loginMode === 'oneClick' ? theme.primary : theme.textSecondary}
              >
                一键登录
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, loginMode === 'sms' && styles.modeButtonActive]}
              onPress={() => setLoginMode('sms')}
            >
              <ThemedText
                variant="smallMedium"
                color={loginMode === 'sms' ? theme.primary : theme.textSecondary}
              >
                验证码登录
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* 一键登录模式 */}
          {loginMode === 'oneClick' && (
            <View style={styles.form}>
              {/* 环境提示（Expo Go/Web 环境显示） */}
              {!isOneClickSupported && (
                <View style={styles.envWarning}>
                  <ThemedText variant="small" color={theme.error}>
                    {environment === 'expo-go' && '⚠️ Expo Go 不支持秒验功能'}
                    {environment === 'web' && '⚠️ Web 平台不支持秒验功能'}
                    {environment === 'ios' && '⚠️ iOS 尚未集成秒验 SDK'}
                    {environment === 'native' && '⚠️ 原生模块未加载，请运行 prebuild'}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted} style={styles.envHint}>
                    {environment === 'expo-go' && '请使用 npx expo run:android 在真机上运行'}
                    {environment === 'web' && '请使用 Android 真机测试秒验功能'}
                    {environment === 'ios' && '请联系开发者添加 iOS 秒验支持'}
                    {environment === 'native' && '请运行 npx expo prebuild 生成原生项目'}
                  </ThemedText>
                </View>
              )}

              {/* 运营商信息 */}
              <View style={styles.operatorInfo}>
                <ThemedText variant="body" color={theme.textSecondary}>
                  {renderStatusText()}
                </ThemedText>
              </View>

              {/* 一键登录按钮 */}
              <TouchableOpacity
                style={[
                  styles.oneClickButton,
                  !canOneClickLogin && styles.oneClickButtonDisabled,
                ]}
                onPress={handleOneClickLogin}
                disabled={!canOneClickLogin || isLoggingIn}
              >
                {isLoggingIn ? (
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                ) : (
                  <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                    {verifyStatus === 'preVerifying' ? '正在准备...' : 
                     verifyStatus === 'ready' ? '本机号码一键登录' : '请稍候...'}
                  </ThemedText>
                )}
              </TouchableOpacity>

              {/* 切换到短信验证码 */}
              <TouchableOpacity style={styles.switchModeLink} onPress={toggleLoginMode}>
                <ThemedText variant="small" color={theme.primary}>
                  使用其他手机号登录
                </ThemedText>
              </TouchableOpacity>

              {/* 提示信息 */}
              <View style={styles.disclaimer}>
                <ThemedText variant="caption" color={theme.textMuted}>
                  登录即表示同意《用户协议》和《隐私政策》
                </ThemedText>
              </View>
            </View>
          )}

          {/* 短信验证码模式 */}
          {loginMode === 'sms' && (
            <View style={styles.form}>
              {/* Phone Input */}
              <View style={styles.inputGroup}>
                <ThemedText variant="smallMedium" color={theme.textPrimary} style={styles.label}>
                  手机号
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="请输入手机号"
                  placeholderTextColor={theme.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  autoComplete="tel"
                />
              </View>

              {/* Verification Code */}
              <View style={styles.inputGroup}>
                <ThemedText variant="smallMedium" color={theme.textPrimary} style={styles.label}>
                  验证码
                </ThemedText>
                <View style={styles.codeRow}>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="请输入验证码"
                    placeholderTextColor={theme.textMuted}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoComplete="sms-otp"
                  />
                  <TouchableOpacity
                    style={[styles.codeButton, !canSendCode && styles.codeButtonDisabled]}
                    onPress={handleSendCode}
                    disabled={!canSendCode}
                  >
                    <ThemedText
                      variant="smallMedium"
                      color={canSendCode ? theme.primary : theme.textMuted}
                    >
                      {countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                
                {/* 开发环境：显示验证码 */}
                {sentCode && (
                  <View style={styles.codeHint}>
                    <ThemedText variant="small" color={theme.success}>
                      验证码已发送: {sentCode}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, !canSmsLogin && styles.loginButtonDisabled]}
                onPress={handleSmsLogin}
                disabled={!canSmsLogin}
              >
                <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                  {isLoggingIn ? '登录中...' : '登录'}
                </ThemedText>
              </TouchableOpacity>

              {/* 一键登录入口 */}
              {isOneClickSupported && (
                <TouchableOpacity style={styles.switchModeLink} onPress={toggleLoginMode}>
                  <ThemedText variant="small" color={theme.primary}>
                    使用本机号码一键登录
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.tip}>
              <ThemedText variant="caption" color={theme.textMuted} style={styles.tipText}>
                {loginMode === 'sms' 
                  ? (environment === 'expo-go' ? 'Expo Go 环境：验证码将显示在页面上' : '验证码将发送到您的手机')
                  : '一键登录需要使用手机数据网络'}
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
