import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

const FAQ_LIST = [
  {
    q: '如何添加票据？',
    a: '点击首页的"+"按钮，可以拍照或从相册选择图片。系统会自动识别票据信息，您也可以手动填写标题、日期、地点等。',
  },
  {
    q: '如何使用OCR识别？',
    a: '在新建票据页面，选择图片后点击"智能识别"按钮，系统会自动提取图片中的文字信息并填充到表单中。',
  },
  {
    q: '如何开启云端备份？',
    a: '进入设置 > 云端存储 > 启用云端备份。开启后，票据数据会自动同步到云端，支持多设备访问。',
  },
  {
    q: '如何保护隐私票据？',
    a: '专业版用户可以使用隐私箱功能，对敏感票据进行加密存储，需要密码或生物识别才能访问。',
  },
  {
    q: '如何导出票据？',
    a: '在票据详情页点击分享按钮，可以选择导出为PDF或图片格式。专业版用户支持导出原图。',
  },
  {
    q: '会员权益有哪些？',
    a: '专业版会员享有：10GB存储空间、无限票据数量、无限OCR识别、隐私箱、多设备同步、皮肤主题等功能。',
  },
];

export default function HelpScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { token, user } = useAuth();

  const [feedbackType, setFeedbackType] = useState<'bug' | 'suggestion' | 'other'>('suggestion');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // 提交反馈
  const handleSubmitFeedback = async () => {
    if (!feedbackContent.trim()) {
      Toast.show({ type: 'error', text1: '请输入反馈内容' });
      return;
    }

    if (!token) {
      Toast.show({ type: 'error', text1: '请先登录' });
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: feedbackType,
          content: feedbackContent.trim(),
          contact: contactInfo.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Toast.show({ type: 'success', text1: '感谢您的反馈', text2: '我们会尽快处理' });
        setFeedbackContent('');
        setContactInfo('');
      } else {
        Toast.show({ type: 'error', text1: '提交失败', text2: data.error });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader title="帮助与反馈" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 常见问题 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>常见问题</ThemedText>
          <View style={styles.faqList}>
            {FAQ_LIST.map((faq, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.faqItem, expandedFaq === index && styles.faqItemExpanded]}
                onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
                activeOpacity={0.8}
              >
                <View style={styles.faqHeader}>
                  <FontAwesome6
                    name={expandedFaq === index ? 'chevron-down' : 'chevron-right'}
                    size={14}
                    color={theme.primary}
                  />
                  <ThemedText style={styles.faqQuestion}>{faq.q}</ThemedText>
                </View>
                {expandedFaq === index && (
                  <ThemedText style={styles.faqAnswer}>{faq.a}</ThemedText>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 反馈表单 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>问题反馈</ThemedText>
          <ThemedView level="default" style={styles.feedbackCard}>
            {/* 反馈类型 */}
            <View style={styles.typeSelector}>
              {(['bug', 'suggestion', 'other'] as const).map((type) => {
                const labels = {
                  bug: '问题反馈',
                  suggestion: '功能建议',
                  other: '其他',
                };
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      feedbackType === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setFeedbackType(type)}
                  >
                    <ThemedText
                      style={[
                        styles.typeButtonText,
                        feedbackType === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {labels[type]}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 反馈内容 */}
            <TextInput
              style={styles.textInput}
              placeholder="请详细描述您遇到的问题或建议..."
              placeholderTextColor={theme.textMuted}
              value={feedbackContent}
              onChangeText={setFeedbackContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* 联系方式 */}
            <TextInput
              style={styles.contactInput}
              placeholder="联系方式（选填，便于我们回复您）"
              placeholderTextColor={theme.textMuted}
              value={contactInfo}
              onChangeText={setContactInfo}
            />

            {/* 提交按钮 */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!feedbackContent.trim() || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitFeedback}
              disabled={!feedbackContent.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.submitButtonText}>提交反馈</ThemedText>
              )}
            </TouchableOpacity>
          </ThemedView>
        </View>

        {/* 联系方式 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>联系我们</ThemedText>
          <View style={styles.contactList}>
            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <FontAwesome6 name="envelope" size={18} color={theme.primary} />
              </View>
              <View style={styles.contactContent}>
                <ThemedText style={styles.contactLabel}>邮箱</ThemedText>
                <ThemedText style={styles.contactValue}>support@ticketkeeper.app</ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* 提示信息 */}
        <View style={styles.tipSection}>
          <FontAwesome6 name="circle-info" size={14} color={theme.textMuted} />
          <ThemedText style={styles.tipText}>
            我们会在1-3个工作日内处理您的反馈，如有需要会通过邮箱联系您
          </ThemedText>
        </View>
      </ScrollView>
    </Screen>
  );
}
