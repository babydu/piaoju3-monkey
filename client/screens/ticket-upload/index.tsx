import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  FlatList,
  Keyboard,
  Platform,
  Alert,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { createFormDataFile } from '@/utils';
import { Spacing, BorderRadius } from '@/constants/theme';
import { ImageEditorModal } from '@/components/ImageEditor';
import { unifiedStorageService, LocalSettings } from '@/services/local-storage';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface Collection {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

interface OcrResult {
  text: string;
  ticketType: string;
  suggestedTitle: string;  // AI提炼的标题
  summary: string;  // AI生成的票据简介
  suggestedTags: string[];
  keyInfo: {
    title?: string;
    date?: string;
    location?: string;
    amount?: string;
    number?: string;
  };
}

// OCR识别超时时间（毫秒）
const OCR_TIMEOUT = 40000; // 40秒

// 常用标签推荐
const COMMON_TAGS = ['证件', '门票', '车票', '发票', '收据', '合同', '证书', '景点'];

/**
 * 解析OCR识别出的日期字符串，返回Date对象
 * 支持多种日期格式：
 * - YYYY年MM月DD日
 * - YYYY-MM-DD
 * - YYYY/MM/DD
 * - MM月DD日（默认当年）
 * - 其他常见格式
 */
const parseDateFromOcr = (dateStr: string): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const str = dateStr.trim();
  
  // 匹配 YYYY年MM月DD日 格式
  const chineseFormat = str.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (chineseFormat) {
    const year = parseInt(chineseFormat[1], 10);
    const month = parseInt(chineseFormat[2], 10);
    const day = parseInt(chineseFormat[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }
  
  // 匹配 YYYY-MM-DD 或 YYYY/MM/DD 格式
  const isoFormat = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoFormat) {
    const year = parseInt(isoFormat[1], 10);
    const month = parseInt(isoFormat[2], 10);
    const day = parseInt(isoFormat[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }
  
  // 匹配 MM月DD日 格式（默认当年）
  const shortChineseFormat = str.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (shortChineseFormat) {
    const currentYear = new Date().getFullYear();
    const month = parseInt(shortChineseFormat[1], 10);
    const day = parseInt(shortChineseFormat[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(currentYear, month - 1, day);
    }
  }
  
  // 匹配 MM-DD 或 MM/DD 格式（默认当年）
  const shortFormat = str.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (shortFormat) {
    const currentYear = new Date().getFullYear();
    const month = parseInt(shortFormat[1], 10);
    const day = parseInt(shortFormat[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(currentYear, month - 1, day);
    }
  }
  
  // 尝试直接解析
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
};

export default function TicketUploadScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { token, user } = useAuth();

  // 图片
  const [images, setImages] = useState<string[]>([]);
  
  // 用户设置
  const [cloudOcrEnabled, setCloudOcrEnabled] = useState(false);
  const [aiServiceEnabled, setAiServiceEnabled] = useState(true); // AI服务开关（默认开启）
  const [cloudBackup, setCloudBackup] = useState(false); // 云端备份开关
  
  // 表单
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');  // 票据简介（AI生成）
  const [ticketDate, setTicketDate] = useState<Date | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false); // 隐私票据开关
  
  // 合集列表
  const [collections, setCollections] = useState<Collection[]>([]);
  
  // 标签列表
  const [existingTags, setExistingTags] = useState<Tag[]>([]);
  
  // 合集选择器Modal
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  
  // 新建合集Modal
  const [newCollectionModalVisible, setNewCollectionModalVisible] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  
  // 标签选择器
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  
  // 日期选择器
  const [showTicketDatePicker, setShowTicketDatePicker] = useState(false);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);
  
  // 图片编辑器状态
  const [imageEditorVisible, setImageEditorVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null); // 待编辑的新图片
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null); // 编辑现有图片的索引
  
  // 状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  // 设备ID（用于云端存储过滤）
  const [deviceId, setDeviceId] = useState<string | null>(null);
  
  // OCR重试选择弹窗
  const [ocrRetryModalVisible, setOcrRetryModalVisible] = useState(false);
  // 当前OCR识别进度
  const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 });
  // 是否已尝试过OCR识别
  const [hasOcrAttempted, setHasOcrAttempted] = useState(false);
  // AI推荐的标签（待选中状态，需要用户点击添加）
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  // 初始化统一存储服务
  useEffect(() => {
    unifiedStorageService.initialize();
  }, []);

  // 加载合集列表（优先本地，云端补充）
  const loadCollections = useCallback(async () => {
    try {
      const collections = await unifiedStorageService.getCollections(token ?? undefined);
      setCollections(collections.map(c => ({ id: c.id, name: c.name })));
    } catch (error) {
      console.error('加载合集失败:', error);
    }
  }, [token]);

  // 加载标签列表（优先本地，云端补充）
  const loadTags = useCallback(async () => {
    try {
      const tags = await unifiedStorageService.getTags(token ?? undefined);
      setExistingTags(tags.map(t => ({ id: t.id, name: t.name })));
    } catch (error) {
      console.error('加载标签失败:', error);
    }
  }, [token]);

  // 加载用户设置
  const loadUserSettings = useCallback(async () => {
    try {
      // 从本地存储获取设置
      const settings = await unifiedStorageService.getSettings();
      setCloudOcrEnabled(settings.cloudOcrEnabled || false);
      setAiServiceEnabled(settings.aiServiceEnabled !== false);
      setCloudBackup(settings.cloudBackup || false);
      
      // 如果有云端token，也同步云端设置
      if (token) {
        try {
          const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/settings`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();
          if (data.success) {
            // 云端设置优先
            const cloudSettings = data.settings?.preferences;
            if (cloudSettings) {
              setCloudOcrEnabled(cloudSettings.cloudOcrEnabled || false);
              setAiServiceEnabled(cloudSettings.aiServiceEnabled !== false);
              setCloudBackup(cloudSettings.cloudBackup || false);
              
              // 更新本地设置
              await unifiedStorageService.updateSettings({
                cloudOcrEnabled: cloudSettings.cloudOcrEnabled || false,
                aiServiceEnabled: cloudSettings.aiServiceEnabled !== false,
                cloudBackup: cloudSettings.cloudBackup || false,
              });
            }
          }
        } catch (error) {
          console.error('获取云端设置失败:', error);
        }
      }
    } catch (error) {
      console.error('加载用户设置失败:', error);
    }
  }, [token]);

  useEffect(() => {
    loadCollections();
    loadTags();
    loadUserSettings();
  }, [loadCollections, loadTags, loadUserSettings]);

  // 标签输入过滤
  const handleTagInputChange = (text: string) => {
    setTagInput(text);
    if (text.trim()) {
      const filtered = existingTags.filter(tag => 
        tag.name.toLowerCase().includes(text.trim().toLowerCase()) &&
        !tagNames.includes(tag.name)
      );
      setFilteredTags(filtered);
      setShowTagSuggestions(filtered.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  };

  // 拍照 - 选择后直接进入编辑器
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: '权限不足', text2: '需要相机权限才能拍照' });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      // 直接进入编辑器，自动扫描
      setPendingImageUri(result.assets[0].uri);
      setEditingImageIndex(null);
      setImageEditorVisible(true);
    }
  };

  // 从相册选择 - 选择后直接进入编辑器
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: '权限不足', text2: '需要相册权限才能选择图片' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false, // 改为单选，每张图片单独编辑
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      // 直接进入编辑器，自动扫描
      setPendingImageUri(result.assets[0].uri);
      setEditingImageIndex(null);
      setImageEditorVisible(true);
    }
  };

  // 编辑现有图片
  const handleEditImage = (index: number) => {
    setPendingImageUri(images[index]);
    setEditingImageIndex(index);
    setImageEditorVisible(true);
  };

  // 图片编辑完成回调
  const handleImageEditSave = (editedUri: string) => {
    if (editingImageIndex !== null) {
      // 更新现有图片
      setImages(prev => prev.map((uri, i) => i === editingImageIndex ? editedUri : uri));
    } else {
      // 添加新图片
      setImages(prev => [...prev, editedUri].slice(0, 9));
    }
    setImageEditorVisible(false);
    setPendingImageUri(null);
    setEditingImageIndex(null);
  };

  // 关闭编辑器
  const handleImageEditorClose = () => {
    setImageEditorVisible(false);
    setPendingImageUri(null);
    setEditingImageIndex(null);
  };

  // 删除图片
  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // OCR识别单张图片（带超时）
  const recognizeSingleImage = async (
    imageUri: string, 
    mode: 'local' | 'cloud' = 'local',
    abortSignal?: AbortSignal
  ): Promise<OcrResult | null> => {
    try {
      const formData = new FormData();
      const file = await createFormDataFile(imageUri, `ocr_${Date.now()}.jpg`, 'image/jpeg');
      formData.append('file', file as any);

      const endpoint = mode === 'local' 
        ? `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/ocr/local`
        : `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/ocr/recognize`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: abortSignal,
      });

      const data = await response.json();
      if (data.success && data.result) {
        return data.result;
      } else {
        console.error('OCR识别失败:', data.error || '未知错误');
        return null;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('OCR识别已取消');
        return null;
      }
      console.error('OCR识别异常:', error);
      return null;
    }
  };

  // OCR识别票据
  const handleOcrRecognize = async (mode: 'local' | 'cloud' = 'local') => {
    if (images.length === 0) {
      Toast.show({ type: 'info', text1: '提示', text2: '请先选择一张图片' });
      return;
    }

    if (!token) {
      Toast.show({ type: 'error', text1: '错误', text2: '请先登录' });
      return;
    }

    setIsOcrLoading(true);
    setHasOcrAttempted(true);
    setOcrProgress({ current: 0, total: images.length });
    
    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;
    
    const startTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        isCancelled = true;
        abortController.abort();
        Toast.show({ type: 'error', text1: '识别超时', text2: '识别时间过长，已自动停止' });
        setIsOcrLoading(false);
        setOcrProgress({ current: 0, total: 0 });
      }, OCR_TIMEOUT);
    };
    
    const clearTimeout_ = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    
    try {
      const allResults: OcrResult[] = [];
      
      for (let i = 0; i < images.length; i++) {
        if (isCancelled) break;
        
        setOcrProgress({ current: i + 1, total: images.length });
        startTimeout();
        
        const result = await recognizeSingleImage(images[i], mode, abortController.signal);
        if (result) {
          allResults.push(result);
        }
      }
      
      clearTimeout_();
      
      if (isCancelled) return;
      
      if (allResults.length === 0) {
        Toast.show({ type: 'error', text1: '识别失败', text2: '未能识别任何图片' });
        return;
      }

      const mergedResult: OcrResult = {
        text: allResults.map(r => r.text).filter(Boolean).join('\n\n'),
        ticketType: allResults[0]?.ticketType || '票据',
        suggestedTitle: allResults.find(r => r.suggestedTitle)?.suggestedTitle || '',
        summary: allResults.find(r => r.summary)?.summary || '',
        suggestedTags: [...new Set(allResults.flatMap(r => r.suggestedTags || []))],
        keyInfo: {},
      };

      for (const result of allResults) {
        if (result.keyInfo) {
          if (!mergedResult.keyInfo.title && result.keyInfo.title) {
            mergedResult.keyInfo.title = result.keyInfo.title;
          }
          if (!mergedResult.keyInfo.date && result.keyInfo.date) {
            mergedResult.keyInfo.date = result.keyInfo.date;
          }
          if (!mergedResult.keyInfo.location && result.keyInfo.location) {
            mergedResult.keyInfo.location = result.keyInfo.location;
          }
          if (!mergedResult.keyInfo.amount && result.keyInfo.amount) {
            mergedResult.keyInfo.amount = result.keyInfo.amount;
          }
        }
      }
      
      // 使用AI提炼的标题（优先使用suggestedTitle）
      if (mergedResult.suggestedTitle && !title) {
        setTitle(mergedResult.suggestedTitle);
      }
      
      // 使用AI生成的票据简介
      if (mergedResult.summary && !summary) {
        setSummary(mergedResult.summary);
      }
      
      // 自动填充位置信息
      if (mergedResult.keyInfo?.location && !location) {
        setLocation(mergedResult.keyInfo.location);
      }
      
      // 自动填充票据日期（解析日期字符串）
      if (mergedResult.keyInfo?.date && !ticketDate) {
        const parsedDate = parseDateFromOcr(mergedResult.keyInfo.date);
        if (parsedDate) {
          setTicketDate(parsedDate);
        }
      }
      
      // 设置推荐标签为待选中状态（不直接添加，需用户点击确认）
      if (mergedResult.suggestedTags && mergedResult.suggestedTags.length > 0) {
        const newSuggestedTags = mergedResult.suggestedTags.filter(
          tag => !tagNames.includes(tag) && !suggestedTags.includes(tag)
        );
        if (newSuggestedTags.length > 0) {
          setSuggestedTags(prev => [...prev, ...newSuggestedTags]);
        }
      }
      
      // OCR原文保存到ocrText（用于提交到后端）
      if (mergedResult.text) {
        setOcrText(mergedResult.text);
        // 同时将OCR原文填充到备注字段（如果备注为空），让用户可以查看和编辑
        if (!notes) {
          setNotes(mergedResult.text);
        }
      }

      setHasOcrAttempted(true);

      const imageCount = allResults.length;
      Toast.show({ 
        type: 'success', 
        text1: '识别成功', 
        text2: `已识别${imageCount}张图片，识别为${mergedResult.ticketType}` 
      });
    } catch (error) {
      console.error('OCR识别失败:', error);
      Toast.show({ type: 'error', text1: '识别失败', text2: '网络错误' });
    } finally {
      clearTimeout_();
      setIsOcrLoading(false);
      setOcrProgress({ current: 0, total: 0 });
      setOcrRetryModalVisible(false);
    }
  };

  const handleOcrStart = () => {
    handleOcrRecognize('local');
  };

  const handleOcrRetry = () => {
    setOcrRetryModalVisible(true);
  };

  const handleOcrRetryLocal = () => {
    setOcrRetryModalVisible(false);
    handleOcrRecognize('local');
  };

  const handleOcrRetryCloud = () => {
    setOcrRetryModalVisible(false);
    handleOcrRecognize('cloud');
  };

  // 定位当前位置
  const handleLocate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: '权限不足', text2: '需要位置权限才能定位' });
      return;
    }

    setIsLocating(true);
    try {
      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses.length > 0) {
        const addr = addresses[0];
        const locationStr = [addr.city, addr.district, addr.street, addr.name]
          .filter(Boolean)
          .join('');
        setLocation(locationStr || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch (error) {
      console.error('定位失败:', error);
      Toast.show({ type: 'error', text1: '定位失败', text2: '请检查定位权限或手动输入地点' });
    } finally {
      setIsLocating(false);
    }
  };

  // 添加标签
  const handleAddTag = (tagName?: string) => {
    const trimmed = (tagName || tagInput).trim();
    if (trimmed && !tagNames.includes(trimmed)) {
      setTagNames(prev => [...prev, trimmed]);
      setTagInput('');
      setShowTagSuggestions(false);
      Keyboard.dismiss();
    }
  };

  // 删除标签
  const handleRemoveTag = (tag: string) => {
    setTagNames(prev => prev.filter(t => t !== tag));
  };

  // 添加推荐标签（从AI推荐列表点击添加）
  const handleAddSuggestedTag = (tag: string) => {
    if (!tagNames.includes(tag)) {
      setTagNames(prev => [...prev, tag]);
    }
    // 从推荐列表移除
    setSuggestedTags(prev => prev.filter(t => t !== tag));
  };

  // 忽略推荐标签
  const handleDismissSuggestedTag = (tag: string) => {
    setSuggestedTags(prev => prev.filter(t => t !== tag));
  };

  // 创建新合集
  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) {
      Toast.show({ type: 'info', text1: '提示', text2: '请输入合集名称' });
      return;
    }

    setIsCreatingCollection(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();
      if (data.success) {
        await loadCollections();
        setCollectionId(data.collection.id);
        setNewCollectionModalVisible(false);
        setNewCollectionName('');
        setCollectionModalVisible(false);
        Toast.show({ type: 'success', text1: '成功', text2: '合集创建成功' });
      } else {
        Toast.show({ type: 'error', text1: '错误', text2: data.error || '创建失败' });
      }
    } catch (error) {
      console.error('创建合集失败:', error);
      Toast.show({ type: 'error', text1: '错误', text2: '创建合集失败' });
    } finally {
      setIsCreatingCollection(false);
    }
  };

  // 提交票据
  const handleSubmit = async () => {
    if (images.length === 0) {
      Toast.show({ type: 'info', text1: '提示', text2: '请至少选择一张图片' });
      return;
    }

    if (!title.trim()) {
      Toast.show({ type: 'info', text1: '提示', text2: '请输入票据标题' });
      return;
    }

    if (!token) {
      Toast.show({ type: 'error', text1: '错误', text2: '请先登录' });
      return;
    }

    if (isPrivate && user?.memberLevel !== 'pro') {
      Toast.show({ type: 'error', text1: '权限不足', text2: '隐私票据为专业版功能' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 格式化日期
      const formatDate = (date: Date | null): string | undefined => {
        if (!date) return undefined;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 获取选中的合集名称
      const selectedCollection = collections.find(c => c.id === collectionId);

      // 使用统一存储服务创建票据（本地优先）
      const result = await unifiedStorageService.createTicket(
        {
          title: title.trim(),
          summary: summary.trim() || undefined,
          ticketDate: formatDate(ticketDate),
          expiryDate: formatDate(expiryDate),
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          ocrText: ocrText || undefined,
          collectionId: collectionId || undefined,
          collectionName: selectedCollection?.name,
          isPrivate: isPrivate,
          tags: tagNames.length > 0 ? tagNames : undefined,
        },
        images,
        token
      );

      if (result.ticket) {
        const syncStatus = result.cloudSynced ? '已同步到云端' : '已保存到本地';
        Toast.show({
          type: 'success',
          text1: '保存成功',
          text2: syncStatus,
        });
        setTimeout(() => {
          router.replace('/' as any);
        }, 1000);
      } else {
        Toast.show({ type: 'error', text1: '保存失败', text2: '请重试' });
      }
    } catch (error: any) {
      console.error('创建票据异常:', error);
      const errorMessage = error?.message || String(error) || '创建票据失败，请重试';
      Toast.show({ type: 'error', text1: '保存失败', text2: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCollection = collections.find(c => c.id === collectionId);

  return (
    <Screen
      backgroundColor={theme.backgroundRoot}
      statusBarStyle={isDark ? 'light' : 'dark'}
      safeAreaEdges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/' as any)} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={16} color={theme.textPrimary} />
        </TouchableOpacity>
        <ThemedText variant="h4" color={theme.textPrimary}>新建票据</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 图片选择区 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            票据图片 *
          </ThemedText>
          
          <View style={styles.imageRow}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <TouchableOpacity onPress={() => handleEditImage(index)}>
                  <Image source={{ uri }} style={styles.previewImage} contentFit="cover" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.editBtn}
                  onPress={() => handleEditImage(index)}
                >
                  <FontAwesome6 name="pen" size={10} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.removeBtn}
                  onPress={() => handleRemoveImage(index)}
                >
                  <FontAwesome6 name="xmark" size={10} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            
            {images.length < 9 && (
              <>
                <TouchableOpacity style={styles.addImageBtn} onPress={handlePickImage}>
                  <FontAwesome6 name="images" size={20} color={theme.textMuted} />
                  <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: 4 }}>相册</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addImageBtn} onPress={handleTakePhoto}>
                  <FontAwesome6 name="camera" size={20} color={theme.textMuted} />
                  <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: 4 }}>拍照</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
          
          {/* OCR识别按钮 */}
          {images.length > 0 && (
            <View style={styles.ocrButtonRow}>
              <TouchableOpacity 
                style={[styles.ocrBtn, isOcrLoading && styles.ocrBtnLoading]}
                onPress={isOcrLoading ? undefined : handleOcrStart}
                disabled={isOcrLoading}
              >
                {isOcrLoading ? (
                  <>
                    <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                    <ThemedText variant="smallMedium" color={theme.buttonPrimaryText} style={{ marginLeft: 8 }}>
                      {ocrProgress.total > 0 ? `识别中 ${ocrProgress.current}/${ocrProgress.total}` : '识别中...'}
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <FontAwesome6 name="wand-magic-sparkles" size={16} color={theme.buttonPrimaryText} />
                    <ThemedText variant="smallMedium" color={theme.buttonPrimaryText} style={{ marginLeft: 8 }}>
                      智能识别
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
              
              {hasOcrAttempted && !isOcrLoading && (
                <TouchableOpacity 
                  style={styles.retryBtn}
                  onPress={handleOcrRetry}
                >
                  <FontAwesome6 name="rotate" size={14} color={theme.primary} />
                  <ThemedText variant="smallMedium" color={theme.primary} style={{ marginLeft: 4 }}>
                    重试
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          <ThemedText variant="caption" color={theme.textMuted}>
            选择图片后会自动进入编辑器进行扫描和裁剪
          </ThemedText>
        </View>

        {/* 基本信息 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            基本信息
          </ThemedText>
          
          {/* 标题 */}
          <View style={styles.field}>
            <ThemedText variant="small" color={theme.textSecondary}>标题 *</ThemedText>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="给票据起个名字"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          {/* 票据简介 */}
          <View style={styles.field}>
            <ThemedText variant="small" color={theme.textSecondary}>简介</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={summary}
              onChangeText={setSummary}
              placeholder="票据内容概述（可AI自动生成）"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: 4 }}>
              简介是对票据内容的整体梳理，方便快速了解票据信息
            </ThemedText>
          </View>

          {/* 票据日期 */}
          <View style={styles.field}>
            <ThemedText variant="small" color={theme.textSecondary}>票据日期</ThemedText>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowTicketDatePicker(true)}
            >
              <FontAwesome6 name="calendar" size={14} color={theme.textMuted} style={styles.datePickerIcon} />
              <ThemedText variant="body" color={ticketDate ? theme.textPrimary : theme.textMuted}>
                {ticketDate ? `${ticketDate.getFullYear()}-${String(ticketDate.getMonth() + 1).padStart(2, '0')}-${String(ticketDate.getDate()).padStart(2, '0')}` : '点击选择日期'}
              </ThemedText>
              <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* 失效日期 */}
          <View style={styles.field}>
            <ThemedText variant="small" color={theme.textSecondary}>有效期至</ThemedText>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowExpiryDatePicker(true)}
            >
              <FontAwesome6 name="clock" size={14} color={theme.textMuted} style={styles.datePickerIcon} />
              <ThemedText variant="body" color={expiryDate ? theme.textPrimary : theme.textMuted}>
                {expiryDate ? `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}` : '点击选择有效期（可选）'}
              </ThemedText>
              <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* 地点 */}
          <View style={styles.field}>
            <ThemedText variant="small" color={theme.textSecondary}>地点</ThemedText>
            <View style={styles.locationRow}>
              <TextInput
                style={styles.locationInput}
                value={location}
                onChangeText={setLocation}
                placeholder="票据上的地点"
                placeholderTextColor={theme.textMuted}
              />
              <TouchableOpacity 
                style={styles.locateBtn}
                onPress={handleLocate}
                disabled={isLocating}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <FontAwesome6 name="location-crosshairs" size={16} color={theme.primary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 备注 */}
          <View style={styles.field}>
            <ThemedText variant="small" color={theme.textSecondary}>备注</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="添加备注信息..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* 标签 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            标签
          </ThemedText>
          
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              value={tagInput}
              onChangeText={handleTagInputChange}
              placeholder="输入标签"
              placeholderTextColor={theme.textMuted}
              onSubmitEditing={() => handleAddTag()}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addTagBtn} onPress={() => handleAddTag()}>
              <FontAwesome6 name="plus" size={16} color={theme.buttonPrimaryText} />
            </TouchableOpacity>
          </View>

          {/* 标签建议 */}
          {showTagSuggestions && filteredTags.length > 0 && (
            <View style={styles.tagSuggestions}>
              {filteredTags.slice(0, 5).map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={styles.tagSuggestionItem}
                  onPress={() => handleAddTag(tag.name)}
                >
                  <ThemedText variant="small" color={theme.primary}>{tag.name}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 已选标签 */}
          {tagNames.length > 0 && (
            <View style={styles.tagList}>
              {tagNames.map((tag, index) => (
                <View key={index} style={styles.tagItem}>
                  <ThemedText variant="small" color={theme.primary}>{tag}</ThemedText>
                  <TouchableOpacity onPress={() => handleRemoveTag(tag)}>
                    <FontAwesome6 name="xmark" size={10} color={theme.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* AI推荐标签（待选中状态）- 仅在AI服务开启时显示 */}
          {aiServiceEnabled && suggestedTags.length > 0 && (
            <View style={styles.suggestedTagsSection}>
              <View style={styles.suggestedTagsHeader}>
                <FontAwesome6 name="wand-magic-sparkles" size={12} color={theme.accent} />
                <ThemedText variant="caption" color={theme.accent} style={{ marginLeft: 4 }}>
                  AI推荐标签
                </ThemedText>
              </View>
              <View style={styles.suggestedTagsList}>
                {suggestedTags.map((tag, index) => (
                  <View key={index} style={styles.suggestedTagItem}>
                    <TouchableOpacity 
                      style={styles.suggestedTagAdd}
                      onPress={() => handleAddSuggestedTag(tag)}
                    >
                      <FontAwesome6 name="plus" size={8} color={theme.accent} style={{ marginRight: 4 }} />
                      <ThemedText variant="small" color={theme.accent}>{tag}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.suggestedTagDismiss}
                      onPress={() => handleDismissSuggestedTag(tag)}
                    >
                      <FontAwesome6 name="xmark" size={8} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 常用标签 */}
          <View style={styles.commonTagsRow}>
            <ThemedText variant="caption" color={theme.textMuted}>常用: </ThemedText>
            {COMMON_TAGS.filter(t => !tagNames.includes(t)).slice(0, 4).map(tag => (
              <TouchableOpacity
                key={tag}
                style={styles.commonTagBtn}
                onPress={() => handleAddTag(tag)}
              >
                <ThemedText variant="caption" color={theme.textSecondary}>{tag}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 合集选择 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            合集（可选）
          </ThemedText>
          
          <TouchableOpacity
            style={styles.collectionSelector}
            onPress={() => setCollectionModalVisible(true)}
          >
            {selectedCollection ? (
              <>
                <FontAwesome6 name="folder" size={16} color={theme.primary} />
                <ThemedText variant="body" color={theme.textPrimary} style={{ marginLeft: 8 }}>
                  {selectedCollection.name}
                </ThemedText>
              </>
            ) : (
              <>
                <FontAwesome6 name="folder-plus" size={16} color={theme.textMuted} />
                <ThemedText variant="body" color={theme.textMuted} style={{ marginLeft: 8 }}>
                  选择合集（可选）
                </ThemedText>
              </>
            )}
            <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        {/* 隐私设置 */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <FontAwesome6 name="lock" size={16} color={theme.textSecondary} />
              <ThemedText variant="body" color={theme.textPrimary} style={{ marginLeft: 8 }}>
                隐私票据
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.switch, isPrivate && styles.switchActive]}
              onPress={() => {
                if (!isPrivate && user?.memberLevel !== 'pro') {
                  Toast.show({ type: 'info', text1: '专业版功能', text2: '升级专业版解锁隐私票据' });
                  return;
                }
                setIsPrivate(!isPrivate);
              }}
            >
              <View style={[styles.switchThumb, isPrivate && styles.switchThumbActive]} />
            </TouchableOpacity>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>
            隐私票据仅自己可见，需要密码才能查看
          </ThemedText>
        </View>

        {/* 提交按钮 */}
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
          ) : (
            <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>保存票据</ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* 日期选择器 */}
      <DateTimePickerModal
        isVisible={showTicketDatePicker}
        mode="date"
        display="inline"
        onConfirm={(date) => {
          setTicketDate(date);
          setShowTicketDatePicker(false);
        }}
        onCancel={() => setShowTicketDatePicker(false)}
        accentColor={theme.primary}
      />

      <DateTimePickerModal
        isVisible={showExpiryDatePicker}
        mode="date"
        display="inline"
        onConfirm={(date) => {
          setExpiryDate(date);
          setShowExpiryDatePicker(false);
        }}
        onCancel={() => setShowExpiryDatePicker(false)}
        accentColor={theme.primary}
      />

      {/* 合集选择Modal */}
      <Modal visible={collectionModalVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setCollectionModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" color={theme.textPrimary}>选择合集</ThemedText>
              <TouchableOpacity onPress={() => setCollectionModalVisible(false)}>
                <FontAwesome6 name="xmark" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <TouchableOpacity
                style={styles.collectionItem}
                onPress={() => {
                  setCollectionId(null);
                  setCollectionModalVisible(false);
                }}
              >
                <FontAwesome6 name="folder-minus" size={20} color={theme.textMuted} />
                <ThemedText variant="body" color={theme.textMuted} style={{ marginLeft: 12 }}>
                  不选择合集
                </ThemedText>
              </TouchableOpacity>

              {collections.map(collection => (
                <TouchableOpacity
                  key={collection.id}
                  style={[styles.collectionItem, collectionId === collection.id && styles.collectionItemActive]}
                  onPress={() => {
                    setCollectionId(collection.id);
                    setCollectionModalVisible(false);
                  }}
                >
                  <FontAwesome6 
                    name="folder" 
                    size={20} 
                    color={collectionId === collection.id ? theme.primary : theme.textMuted} 
                  />
                  <ThemedText 
                    variant="body" 
                    color={collectionId === collection.id ? theme.primary : theme.textPrimary} 
                    style={{ marginLeft: 12 }}
                  >
                    {collection.name}
                  </ThemedText>
                  {collectionId === collection.id && (
                    <FontAwesome6 name="check" size={16} color={theme.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.createNewBtn}
              onPress={() => {
                setCollectionModalVisible(false);
                setNewCollectionModalVisible(true);
              }}
            >
              <FontAwesome6 name="plus" size={16} color={theme.buttonPrimaryText} />
              <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText} style={{ marginLeft: 8 }}>
                创建新合集
              </ThemedText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* 新建合集Modal */}
      <Modal visible={newCollectionModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setNewCollectionModalVisible(false)}>
          <View style={styles.createModalContent}>
            <ThemedText variant="h4" color={theme.textPrimary}>创建合集</ThemedText>
            <TextInput
              style={styles.createInput}
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              placeholder="输入合集名称"
              placeholderTextColor={theme.textMuted}
              autoFocus
            />
            <View style={styles.createModalBtns}>
              <TouchableOpacity
                style={styles.createModalCancelBtn}
                onPress={() => setNewCollectionModalVisible(false)}
              >
                <ThemedText variant="body" color={theme.textSecondary}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createModalConfirmBtn, isCreatingCollection && { opacity: 0.6 }]}
                onPress={handleCreateCollection}
                disabled={isCreatingCollection}
              >
                {isCreatingCollection ? (
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                ) : (
                  <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>创建</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* OCR重试选择Modal */}
      <Modal visible={ocrRetryModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setOcrRetryModalVisible(false)}>
          <View style={styles.createModalContent}>
            <ThemedText variant="h4" color={theme.textPrimary}>选择识别方式</ThemedText>
            <ThemedText variant="body" color={theme.textSecondary} style={{ marginTop: Spacing.sm }}>
              {cloudOcrEnabled 
                ? '本地识别更快，云端识别更准确' 
                : '使用本地识别引擎识别票据内容'}
            </ThemedText>
            <View style={styles.createModalBtns}>
              <TouchableOpacity
                style={styles.createModalCancelBtn}
                onPress={handleOcrRetryLocal}
              >
                <FontAwesome6 name="microchip" size={16} color={theme.textSecondary} />
                <ThemedText variant="body" color={theme.textSecondary} style={{ marginLeft: 8 }}>本地识别</ThemedText>
              </TouchableOpacity>
              {cloudOcrEnabled && (
                <TouchableOpacity
                  style={styles.createModalConfirmBtn}
                  onPress={handleOcrRetryCloud}
                >
                  <FontAwesome6 name="cloud" size={16} color={theme.buttonPrimaryText} />
                  <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText} style={{ marginLeft: 8 }}>云端识别</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            {!cloudOcrEnabled && (
              <TouchableOpacity 
                style={{ marginTop: Spacing.md }}
                onPress={() => router.push('/settings' as any)}
              >
                <ThemedText variant="small" color={theme.primary}>
                  在设置中启用云端识别
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* 图片编辑器 */}
      {pendingImageUri && (
        <ImageEditorModal
          visible={imageEditorVisible}
          imageUri={pendingImageUri}
          onClose={handleImageEditorClose}
          onSave={handleImageEditSave}
          mode="ticket"
        />
      )}
    </Screen>
  );
}
