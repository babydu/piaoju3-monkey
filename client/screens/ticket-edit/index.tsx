import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  Switch,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import AppHeader from '@/components/AppHeader';
import { DropdownPicker } from '@/components/DropdownPicker';
import { Spacing, BorderRadius } from '@/constants/theme';
import Toast from 'react-native-toast-message';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';
const SCREEN_WIDTH = Dimensions.get('window').width;

const COMMON_TAGS = ['证件', '门票', '车票', '发票', '收据', '合同', '证书', '其他'];

interface Collection {
  id: string;
  name: string;
}

interface Ticket {
  id: string;
  title: string;
  summary: string | null;
  ocrText: string | null;
  collectionId: string | null;
  location: string | null;
  notes: string | null;
  ticketDate?: string | null;
  expiryDate?: string | null;
  isPrivate: boolean;
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    sortOrder: number;
  }>;
  tags: Array<{
    id: string;
    name: string;
  }>;
}

export default function TicketEditScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { token } = useAuth();
  const params = useSafeSearchParams<{ id: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  // 原始数据（用于判断是否有修改）
  const originalDataRef = useRef<string>('');

  // 表单数据
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [ticketDate, setTicketDate] = useState<Date | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [images, setImages] = useState<Ticket['images']>([]);

  // 自定义标签输入
  const [customTagInput, setCustomTagInput] = useState('');

  // 日期选择器
  const [showTicketDatePicker, setShowTicketDatePicker] = useState(false);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);

  // 合集相关
  const [collections, setCollections] = useState<Collection[]>([]);

  // 退出确认弹窗
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // 格式化日期
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // 解析日期字符串
  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // 检测数据变化
  const checkHasChanges = useCallback(() => {
    const currentData = JSON.stringify({
      title, summary, notes, location, ticketDate: formatDate(ticketDate),
      expiryDate: formatDate(expiryDate), ocrText, selectedCollection,
      selectedTags, isPrivate
    });
    return currentData !== originalDataRef.current;
  }, [title, summary, notes, location, ticketDate, expiryDate, ocrText, selectedCollection, selectedTags, isPrivate]);

  // 加载票据数据
  useEffect(() => {
    const fetchData = async () => {
      if (!params.id || !token) return;

      setIsLoading(true);
      try {
        const ticketRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const ticketData = await ticketRes.json();

        if (ticketData.success) {
          const ticket = ticketData.ticket;
          setTitle(ticket.title || '');
          setSummary(ticket.summary || '');
          setNotes(ticket.notes || '');
          setLocation(ticket.location || '');
          setTicketDate(parseDate(ticket.ticketDate));
          setExpiryDate(parseDate(ticket.expiryDate));
          setOcrText(ticket.ocrText || '');
          setSelectedCollection(ticket.collectionId);
          setIsPrivate(ticket.isPrivate);
          setImages(ticket.images || []);
          const tags = ticket.tags?.map((t: { name: string }) => t.name) || [];
          setSelectedTags(tags);

          // 保存原始数据
          originalDataRef.current = JSON.stringify({
            title: ticket.title || '',
            summary: ticket.summary || '',
            notes: ticket.notes || '',
            location: ticket.location || '',
            ticketDate: ticket.ticketDate || '',
            expiryDate: ticket.expiryDate || '',
            ocrText: ticket.ocrText || '',
            selectedCollection: ticket.collectionId,
            selectedTags: tags,
            isPrivate: ticket.isPrivate
          });
        }

        const collectionsRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const collectionsData = await collectionsRes.json();
        if (collectionsData.success) {
          setCollections(collectionsData.collections);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        Toast.show({ type: 'error', text1: '加载失败', text2: '无法加载票据数据' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.id, token]);

  // 监听数据变化
  useEffect(() => {
    setHasChanges(checkHasChanges());
  }, [checkHasChanges]);

  // 切换标签
  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  // 添加自定义标签
  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (!tag) return;
    if (selectedTags.includes(tag)) {
      Toast.show({ type: 'info', text1: '标签已存在' });
      return;
    }
    setSelectedTags(prev => [...prev, tag]);
    setCustomTagInput('');
  };

  // 创建合集
  const handleCreateCollection = async (name: string) => {
    if (!name.trim()) return;
    
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        const collectionsRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const collectionsData = await collectionsRes.json();
        if (collectionsData.success) {
          setCollections(collectionsData.collections);
          setSelectedCollection(data.collection.id);
        }
        Toast.show({ type: 'success', text1: '创建成功' });
      }
    } catch (error) {
      console.error('创建合集失败:', error);
      Toast.show({ type: 'error', text1: '创建失败' });
    }
  };

  // 保存票据
  const handleSave = async () => {
    if (!title.trim()) {
      Toast.show({ type: 'error', text1: '请填写标题' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || null,
          notes: notes.trim() || null,
          location: location.trim() || null,
          ticketDate: formatDate(ticketDate) || null,
          expiryDate: formatDate(expiryDate) || null,
          ocrText: ocrText.trim() || null,
          collectionId: selectedCollection,
          tagNames: selectedTags,
          isPrivate,
        }),
      });

      const data = await response.json();
      if (data.success) {
        Toast.show({ type: 'success', text1: '保存成功', position: 'top' });
        setTimeout(() => router.back(), 500);
      } else {
        Toast.show({ type: 'error', text1: '保存失败', text2: data.error });
      }
    } catch (error) {
      console.error('保存失败:', error);
      Toast.show({ type: 'error', text1: '保存失败' });
    } finally {
      setIsSaving(false);
    }
  };

  // 处理返回
  const handleBackPress = () => {
    if (hasChanges) {
      setShowExitConfirm(true);
      return true;
    }
    return false;
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    router.back();
  };

  const renderImageItem = ({ item, index }: { item: { url: string }; index: number }) => (
    <TouchableOpacity style={styles.imageSlide} onPress={() => setCurrentImageIndex(index)}>
      <Image source={{ uri: item.url }} style={styles.previewImage} contentFit="contain" />
      <View style={styles.imageBadge}>
        <ThemedText variant="caption" color="#FFFFFF">{index + 1}/{images.length}</ThemedText>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <AppHeader showBack title="编辑票据" onBackPress={handleBackPress} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader showBack title="编辑票据" onBackPress={handleBackPress} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* 图片预览 */}
          {images.length > 0 && (
            <View style={styles.imageSection}>
              <FlatList
                data={images}
                renderItem={renderImageItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  if (newIndex !== currentImageIndex && newIndex >= 0 && newIndex < images.length) {
                    setCurrentImageIndex(newIndex);
                  }
                }}
                scrollEventThrottle={16}
                style={styles.imageCarousel}
                getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              />
            </View>
          )}

          {/* 表单区域 */}
          <View style={styles.formSection}>
            {/* 标题 */}
            <View style={styles.inputGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>标题 *</ThemedText>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="请输入票据标题"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            {/* 简介 */}
            <View style={styles.inputGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>简介</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={summary}
                onChangeText={setSummary}
                placeholder="票据内容概述（可AI自动生成）"
                placeholderTextColor={theme.textMuted}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* 标签 - 预设 + 自定义 */}
            <View style={styles.inputGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>标签</ThemedText>
              
              {/* 已选标签 */}
              {selectedTags.length > 0 && (
                <View style={styles.selectedTagsRow}>
                  {selectedTags.map(tag => (
                    <TouchableOpacity 
                      key={tag} 
                      style={styles.selectedTag}
                      onPress={() => toggleTag(tag)}
                    >
                      <ThemedText variant="small" color={theme.primary}>{tag}</ThemedText>
                      <FontAwesome6 name="xmark" size={10} color={theme.primary} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* 预设标签 */}
              <View style={styles.tagsRow}>
                {COMMON_TAGS.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipSelected]}
                    onPress={() => toggleTag(tag)}
                  >
                    <ThemedText variant="small" color={selectedTags.includes(tag) ? theme.buttonPrimaryText : theme.textSecondary}>
                      {tag}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* 自定义标签输入 */}
              <View style={styles.customTagRow}>
                <TextInput
                  style={styles.customTagInput}
                  value={customTagInput}
                  onChangeText={setCustomTagInput}
                  placeholder="输入自定义标签..."
                  placeholderTextColor={theme.textMuted}
                  onSubmitEditing={addCustomTag}
                  returnKeyType="done"
                />
                <TouchableOpacity 
                  style={[styles.addTagBtn, !customTagInput.trim() && styles.addTagBtnDisabled]}
                  onPress={addCustomTag}
                  disabled={!customTagInput.trim()}
                >
                  <FontAwesome6 name="plus" size={12} color={customTagInput.trim() ? theme.buttonPrimaryText : theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 合集 - 下拉选择 */}
            <View style={styles.inputGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>合集</ThemedText>
              <DropdownPicker
                label="合集"
                value={selectedCollection}
                options={collections.map(c => ({ id: c.id, name: c.name }))}
                placeholder="选择合集（可选）"
                onChange={setSelectedCollection}
                allowCreate
                onCreate={handleCreateCollection}
                theme={theme}
              />
            </View>

            {/* 位置 */}
            <View style={styles.inputGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>位置</ThemedText>
              <View style={styles.inputWithIcon}>
                <FontAwesome6 name="location-dot" size={14} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInputWithIcon}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="添加位置信息"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            {/* 票据日期 */}
            <View style={styles.inputGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>票据日期</ThemedText>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTicketDatePicker(true)}>
                <FontAwesome6 name="calendar" size={14} color={theme.textMuted} style={styles.inputIcon} />
                <ThemedText variant="body" color={ticketDate ? theme.textPrimary : theme.textMuted}>
                  {ticketDate ? formatDate(ticketDate) : '选择票据日期（可选）'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* 失效日期 */}
            <View style={styles.inputGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>失效日期</ThemedText>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowExpiryDatePicker(true)}>
                <FontAwesome6 name="clock" size={14} color={theme.textMuted} style={styles.inputIcon} />
                <ThemedText variant="body" color={expiryDate ? theme.textPrimary : theme.textMuted}>
                  {expiryDate ? formatDate(expiryDate) : '选择失效日期（可选）'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* 备注 */}
            <View style={styles.inputGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>备注</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="添加备注信息..."
                placeholderTextColor={theme.textMuted}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* 私密开关 */}
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <FontAwesome6 name="lock" size={14} color={theme.textSecondary} style={{ marginRight: Spacing.sm }} />
                <ThemedText variant="body" color={theme.textPrimary}>设为私密</ThemedText>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: theme.border, true: theme.primary + '60' }}
                thumbColor={isPrivate ? theme.primary : '#f4f3f4'}
              />
            </View>
          </View>

          {/* 保存按钮 */}
          <TouchableOpacity 
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
            ) : (
              <>
                <FontAwesome6 name="check" size={14} color={theme.buttonPrimaryText} />
                <ThemedText variant="smallMedium" color={theme.buttonPrimaryText} style={{ marginLeft: Spacing.sm }}>
                  保存
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 日期选择器 */}
      <DateTimePickerModal
        isVisible={showTicketDatePicker}
        mode="date"
        onConfirm={(date) => { setTicketDate(date); setShowTicketDatePicker(false); }}
        onCancel={() => setShowTicketDatePicker(false)}
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        locale="zh-CN"
      />
      <DateTimePickerModal
        isVisible={showExpiryDatePicker}
        mode="date"
        onConfirm={(date) => { setExpiryDate(date); setShowExpiryDatePicker(false); }}
        onCancel={() => setShowExpiryDatePicker(false)}
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        locale="zh-CN"
      />

      {/* 退出确认弹窗 */}
      <Modal visible={showExitConfirm} transparent animationType="fade" onRequestClose={() => setShowExitConfirm(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowExitConfirm(false)}>
          <View style={styles.confirmModal}>
            <FontAwesome6 name="circle-exclamation" size={32} color={theme.warning} />
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={{ marginTop: Spacing.md }}>
              有未保存的修改
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: Spacing.xs, textAlign: 'center' }}>
              确定要放弃修改吗？
            </ThemedText>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowExitConfirm(false)}>
                <ThemedText variant="smallMedium" color={theme.textSecondary}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, styles.confirmBtnPrimary]} onPress={confirmExit}>
                <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>放弃</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
