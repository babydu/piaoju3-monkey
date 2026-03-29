import React, { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import JSZip from 'jszip';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Spacing, BorderRadius } from '@/constants/theme';
import { 
  unifiedStorageService, 
  LocalTicket,
  LocalCollection,
  LocalTag,
  TicketIndexItem,
} from '@/services/local-storage';
import { localTicketService } from '@/services/local-storage/LocalTicketService';
import * as FileSystem from 'expo-file-system/legacy';
import { createStyles } from './styles';

// 从 legacy 模块获取常量
// @ts-ignore - 这些属性存在于 legacy 模块中
const EncodingType = FileSystem.EncodingType;
// @ts-ignore
const cacheDirectory = FileSystem.cacheDirectory;

// 备份文件版本（升级版本号以支持备份范围标识）
const BACKUP_VERSION = 2;
const BACKUP_FILE_EXTENSION = '.ticketbackup';

// 备份数据来源类型
type BackupSource = 'local' | 'cloud' | 'all';

// 备份时间范围类型
type BackupTimeRange = 'all' | 'week' | 'month' | 'quarter' | 'halfyear';

// 时间范围配置
const TIME_RANGE_OPTIONS: { key: BackupTimeRange; name: string; days: number }[] = [
  { key: 'all', name: '全部', days: 0 },
  { key: 'week', name: '最近1周', days: 7 },
  { key: 'month', name: '最近1个月', days: 30 },
  { key: 'quarter', name: '最近3个月', days: 90 },
  { key: 'halfyear', name: '最近半年', days: 180 },
];

// 云端票据类型
interface CloudTicket {
  id: string;
  title: string;
  summary?: string;
  ocrText: string | null;
  collectionId: string | null;
  location: string | null;
  notes: string | null;
  ticketDate: string | null;
  expiryDate: string | null;
  isPrivate: boolean;
  deviceId?: string;
  isCloudSynced?: boolean;
  createdAt: string;
  updatedAt?: string;
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
  collection?: {
    id: string;
    name: string;
  };
}

interface BackupManifest {
  version: number;
  appName: string;
  exportedAt: string;
  ticketCount: number;
  imageCount: number;
  platform: string;
  backupSource: BackupSource;
  backupTimeRange: BackupTimeRange;
  hasCloudData: boolean;
}

interface BackupData {
  tickets: LocalTicket[];
  collections: LocalCollection[];
  tags: LocalTag[];
  cloudTickets?: CloudTicket[]; // 云端独有票据
}

export default function BackupScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // 统计数据
  const [stats, setStats] = useState({
    ticketCount: 0,
    imageCount: 0,
    cloudTicketCount: 0,
    cloudImageCount: 0,
  });
  
  // 备份范围选择弹窗
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<BackupSource>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<BackupTimeRange>('all');
  
  // 备份进度
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
  
  // 备份结果弹窗
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<{
    success: boolean;
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      
      // 获取本地统计
      const storageStats = await unifiedStorageService.getStorageStats();
      const localTicketCount = storageStats.ticketCount;
      const localImageCount = storageStats.totalImages;
      
      // 获取云端统计（如果有token）
      let cloudTicketCount = 0;
      let cloudImageCount = 0;
      
      if (token) {
        try {
          // 统计云端独有票据（本地没有的）
          const allTickets = await unifiedStorageService.getTickets(undefined, token);
          const localOnly = await localTicketService.getTickets();
          const localIds = new Set(localOnly.map(t => t.id));
          const localCloudIds = new Set(localOnly.filter(t => t.cloudId).map(t => t.cloudId));
          
          for (const ticket of allTickets) {
            // 如果是云端独有票据（本地没有对应记录）
            if (!localIds.has(ticket.id) && !localCloudIds.has(ticket.id)) {
              cloudTicketCount++;
              cloudImageCount += ticket.imageCount || 0;
            }
          }
        } catch (e) {
          console.warn('获取云端统计失败:', e);
        }
      }
      
      setStats({
        ticketCount: localTicketCount,
        imageCount: localImageCount,
        cloudTicketCount,
        cloudImageCount,
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  /**
   * 处理备份按钮点击 - 显示范围选择弹窗
   */
  const handleExportPress = () => {
    if (exporting) return;
    
    const totalTickets = stats.ticketCount + stats.cloudTicketCount;
    if (totalTickets === 0) {
      Toast.show({ type: 'info', text1: '暂无数据', text2: '没有票据可以备份' });
      return;
    }
    
    setShowScopeModal(true);
  };

  /**
   * 根据选择的范围执行备份
   */
  const handleExportWithScope = async (source: BackupSource, timeRange: BackupTimeRange) => {
    setShowScopeModal(false);
    
    if (exporting) return;

    setExporting(true);
    setProgress({ current: 0, total: 0, stage: '准备数据...' });

    try {
      // 1. 获取数据
      const { tickets, cloudTickets, collections, tags } = await gatherBackupData(source, timeRange);
      
      const totalTickets = tickets.length + (cloudTickets?.length || 0);
      const totalImages = tickets.reduce((sum, t) => sum + t.images.length, 0) + 
                          (cloudTickets?.reduce((sum, t) => sum + t.images.length, 0) || 0);
      
      if (totalTickets === 0) {
        Toast.show({ type: 'info', text1: '暂无数据', text2: '所选范围内没有票据' });
        setExporting(false);
        return;
      }

      setProgress({ current: 0, total: totalImages, stage: '打包票据数据...' });

      // 2. 创建 Zip 文件
      const zip = new JSZip();

      // 3. 添加 manifest
      const manifest: BackupManifest = {
        version: BACKUP_VERSION,
        appName: '票夹管家',
        exportedAt: new Date().toISOString(),
        ticketCount: totalTickets,
        imageCount: totalImages,
        platform: Platform.OS,
        backupSource: source,
        backupTimeRange: timeRange,
        hasCloudData: (cloudTickets?.length || 0) > 0,
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      // 4. 添加票据数据
      const backupData: BackupData = {
        tickets: tickets.map(t => ({
          ...t,
          localPath: undefined,
        })),
        collections,
        tags,
      };
      if (cloudTickets && cloudTickets.length > 0) {
        backupData.cloudTickets = cloudTickets;
      }
      zip.file('data.json', JSON.stringify(backupData, null, 2));

      // 5. 添加本地图片
      const imagesFolder = zip.folder('images');
      let processedImages = 0;
      
      // 本地票据图片
      for (const ticket of tickets) {
        if (ticket.images.length === 0) continue;
        
        const ticketFolder = imagesFolder?.folder(`local/${ticket.id}`);
        for (let i = 0; i < ticket.images.length; i++) {
          const image = ticket.images[i];
          try {
            setProgress({ 
              current: processedImages + 1, 
              total: totalImages, 
              stage: `打包本地图片 ${processedImages + 1}/${totalImages}` 
            });
            
            const imageUri = localTicketService.getTicketImageUri(ticket.id, image.localPath);
            const base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: EncodingType.Base64,
            });
            ticketFolder?.file(`${i}.jpg`, base64, { base64: true });
            processedImages++;
          } catch (error) {
            console.warn(`读取本地图片失败: ${ticket.id}/${image.localPath}`, error);
          }
        }
      }

      // 6. 下载云端图片
      if (cloudTickets && cloudTickets.length > 0) {
        const cloudFolder = imagesFolder?.folder('cloud');
        
        for (const ticket of cloudTickets) {
          if (ticket.images.length === 0) continue;
          
          const ticketFolder = cloudFolder?.folder(ticket.id);
          for (let i = 0; i < ticket.images.length; i++) {
            const image = ticket.images[i];
            try {
              setProgress({ 
                current: processedImages + 1, 
                total: totalImages, 
                stage: `下载云端图片 ${processedImages + 1}/${totalImages}` 
              });
              
              // 下载图片
              const response = await fetch(image.url);
              const blob = await response.blob();
              const base64 = await blobToBase64(blob);
              
              // 移除 data:image/xxx;base64, 前缀
              const base64Data = base64.split(',')[1] || base64;
              ticketFolder?.file(`${i}.jpg`, base64Data, { base64: true });
              processedImages++;
            } catch (error) {
              console.warn(`下载云端图片失败: ${ticket.id}/${image.id}`, error);
            }
          }
        }
      }

      setProgress({ current: 0, total: 0, stage: '生成备份文件...' });

      // 7. 生成 zip 文件
      const zipContent = await zip.generateAsync({ 
        type: 'base64',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // 8. 保存到临时文件
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `ticket-backup-${timestamp}${BACKUP_FILE_EXTENSION}`;
      const tempPath = `${cacheDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(tempPath, zipContent, {
        encoding: EncodingType.Base64,
      });

      // 9. 分享文件
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempPath, {
          mimeType: 'application/zip',
          dialogTitle: '保存备份文件',
          UTI: 'public.zip-archive',
        });
        
        setResultData({
          success: true,
          title: '备份成功',
          message: `已导出 ${totalTickets} 张票据，${processedImages} 张图片`,
          details: `备份文件: ${fileName}`,
        });
        setShowResult(true);
      } else {
        Toast.show({ 
          type: 'error', 
          text1: '分享功能不可用', 
          text2: '请检查设备设置' 
        });
      }
    } catch (error) {
      console.error('导出备份失败:', error);
      Toast.show({ 
        type: 'error', 
        text1: '备份失败', 
        text2: error instanceof Error ? error.message : '未知错误' 
      });
    } finally {
      setExporting(false);
      setProgress({ current: 0, total: 0, stage: '' });
    }
  };

  /**
   * 根据范围收集备份数据
   */
  const gatherBackupData = async (source: BackupSource, timeRange: BackupTimeRange): Promise<{
    tickets: LocalTicket[];
    cloudTickets: CloudTicket[] | undefined;
    collections: LocalCollection[];
    tags: LocalTag[];
  }> => {
    const tickets: LocalTicket[] = [];
    let cloudTickets: CloudTicket[] | undefined;
    
    // 获取合集和标签
    const collections = await unifiedStorageService.getCollections(token ?? undefined);
    const tags = await unifiedStorageService.getTags(token ?? undefined);
    
    // 计算时间范围过滤的开始时间
    const getStartTime = (range: BackupTimeRange): Date | null => {
      const now = new Date();
      switch (range) {
        case 'week':
          return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case 'month':
          return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case 'quarter':
          return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        case 'halfyear':
          return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        default:
          return null;
      }
    };
    
    const startTime = getStartTime(timeRange);
    
    // 过滤票据的时间范围
    const filterByTime = <T extends { createdAt: string }>(items: T[]): T[] => {
      if (!startTime) return items;
      return items.filter(item => new Date(item.createdAt) >= startTime);
    };
    
    if (source === 'local' || source === 'all') {
      // 获取本地票据
      const index = await localTicketService.getTicketIndex();
      for (const item of index.tickets) {
        const ticket = await localTicketService.getTicket(item.id);
        if (ticket) {
          tickets.push(ticket);
        }
      }
    }
    
    if ((source === 'cloud' || source === 'all') && token) {
      // 获取云端独有票据
      try {
        const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        
        if (data.success && data.tickets) {
          // 如果是"仅云端"模式，只取云端票据
          // 如果是"全部"模式，过滤掉已在本地同步的
          const localCloudIds = new Set(
            tickets.filter(t => t.cloudId).map(t => t.cloudId)
          );
          
          cloudTickets = data.tickets.filter((t: CloudTicket) => {
            // 排除已在本地存在的
            return !localCloudIds.has(t.id) && !tickets.some(local => local.id === t.id);
          });
        }
      } catch (error) {
        console.error('获取云端票据失败:', error);
        if (source === 'cloud') {
          throw new Error('获取云端数据失败，请检查网络连接');
        }
      }
    }
    
    // 应用时间范围过滤
    const filteredTickets = filterByTime(tickets);
    const filteredCloudTickets = cloudTickets ? filterByTime(cloudTickets) : undefined;
    
    return { tickets: filteredTickets, cloudTickets: filteredCloudTickets, collections, tags };
  };

  /**
   * Blob 转 Base64
   */
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  /**
   * 导入备份
   */
  const handleImport = async () => {
    if (importing) return;

    try {
      // 1. 选择文件
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      
      // 检查文件扩展名
      if (!file.name?.endsWith(BACKUP_FILE_EXTENSION) && !file.name?.endsWith('.zip')) {
        Toast.show({ 
          type: 'error', 
          text1: '文件格式错误', 
          text2: '请选择 .ticketbackup 或 .zip 文件' 
        });
        return;
      }

      setImporting(true);
      Toast.show({ type: 'info', text1: '正在读取备份文件...', position: 'top' });

      // 2. 读取 zip 文件
      const base64Content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: EncodingType.Base64,
      });
      
      const zip = await JSZip.loadAsync(base64Content, { base64: true });

      // 3. 读取 manifest
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        throw new Error('无效的备份文件：缺少 manifest.json');
      }
      
      const manifestContent = await manifestFile.async('string');
      const manifest: BackupManifest = JSON.parse(manifestContent);

      // 检查版本兼容性
      if (manifest.version > BACKUP_VERSION) {
        throw new Error(`备份文件版本(${manifest.version})高于当前支持版本(${BACKUP_VERSION})，请更新应用`);
      }

      // 4. 读取数据
      const dataFile = zip.file('data.json');
      if (!dataFile) {
        throw new Error('无效的备份文件：缺少 data.json');
      }
      
      const dataContent = await dataFile.async('string');
      const backupData: BackupData = JSON.parse(dataContent);

      const totalTickets = backupData.tickets.length + (backupData.cloudTickets?.length || 0);

      // 5. 确认导入
      const hasCloudData = backupData.cloudTickets && backupData.cloudTickets.length > 0;
      const confirmMessage = hasCloudData
        ? `检测到 ${backupData.tickets.length} 张本地票据、${backupData.cloudTickets!.length} 张云端票据和 ${manifest.imageCount} 张图片。\n\n将进行增量恢复：新增缺失数据，更新较旧数据，保留现有数据。是否继续？`
        : `检测到 ${backupData.tickets.length} 张票据和 ${manifest.imageCount} 张图片。\n\n将进行增量恢复：新增缺失数据，更新较旧数据，保留现有数据。是否继续？`;

      Alert.alert(
        '增量恢复确认',
        confirmMessage,
        [
          { text: '取消', style: 'cancel', onPress: () => setImporting(false) },
          { 
            text: '确认恢复', 
            style: 'default',
            onPress: () => performRestore(backupData, zip, manifest) 
          },
        ]
      );
    } catch (error) {
      console.error('导入备份失败:', error);
      Toast.show({ 
        type: 'error', 
        text1: '导入失败', 
        text2: error instanceof Error ? error.message : '未知错误' 
      });
      setImporting(false);
    }
  };

  /**
   * 执行增量恢复操作
   */
  const performRestore = async (backupData: BackupData, zip: JSZip, manifest: BackupManifest) => {
    try {
      Toast.show({ type: 'info', text1: '正在分析数据...', position: 'top' });

      // 统计恢复结果
      let addedTickets = 0;      // 新增的票据
      let updatedTickets = 0;    // 更新的票据
      let skippedTickets = 0;    // 跳过的票据（相同或更新）
      let addedImages = 0;       // 新增的图片
      let addedCollections = 0;  // 新增的合集
      let addedTags = 0;         // 新增的标签

      // 1. 获取现有数据
      const existingIndex = await localTicketService.getTicketIndex();
      const existingTicketIds = new Set(existingIndex.tickets.map(t => t.id));
      const existingTicketMap = new Map<string, { updatedAt: string }>();
      
      // 构建现有票据的更新时间映射
      for (const item of existingIndex.tickets) {
        existingTicketMap.set(item.id, { updatedAt: item.updatedAt || item.createdAt });
      }

      // 2. 获取现有合集和标签
      const existingCollections = await unifiedStorageService.getCollections(token ?? undefined);
      const existingTags = await unifiedStorageService.getTags(token ?? undefined);
      const existingCollectionNames = new Set(existingCollections.map(c => c.name));
      const existingTagNames = new Set(existingTags.map(t => t.name));

      // 3. 增量恢复合集
      for (const collection of backupData.collections) {
        if (!existingCollectionNames.has(collection.name)) {
          await localTicketService.createCollection(collection.name);
          addedCollections++;
        }
      }

      // 4. 增量恢复标签（通过更新计数）
      for (const tag of backupData.tags) {
        if (!existingTagNames.has(tag.name)) {
          // 标签会通过票据自动创建，这里只需要确保标签计数正确
          addedTags++;
        }
      }

      // 5. 增量恢复本地票据
      for (const ticket of backupData.tickets) {
        const backupUpdatedAt = new Date(ticket.updatedAt || ticket.createdAt).getTime();
        const existing = existingTicketMap.get(ticket.id);

        if (!existing) {
          // 情况1：原有数据缺失，新增票据
          await restoreTicket(ticket, zip, 'local');
          addedTickets++;
          addedImages += ticket.images.length;
        } else {
          const existingUpdatedAt = new Date(existing.updatedAt).getTime();
          
          if (backupUpdatedAt > existingUpdatedAt) {
            // 情况2：备份数据较新，更新票据
            await restoreTicket(ticket, zip, 'local');
            updatedTickets++;
            addedImages += ticket.images.length;
          } else {
            // 情况3：原有数据相同或更新，跳过
            skippedTickets++;
          }
        }
      }

      // 6. 增量恢复云端票据（转换为本地票据）
      if (backupData.cloudTickets && backupData.cloudTickets.length > 0) {
        for (const cloudTicket of backupData.cloudTickets) {
          const backupUpdatedAt = new Date(cloudTicket.updatedAt || cloudTicket.createdAt).getTime();
          const existing = existingTicketMap.get(cloudTicket.id);

          if (!existing) {
            // 情况1：原有数据缺失，新增票据
            await restoreCloudTicketAsLocal(cloudTicket, zip);
            addedTickets++;
            addedImages += cloudTicket.images.length;
          } else {
            const existingUpdatedAt = new Date(existing.updatedAt).getTime();
            
            if (backupUpdatedAt > existingUpdatedAt) {
              // 情况2：备份数据较新，更新票据
              await restoreCloudTicketAsLocal(cloudTicket, zip);
              updatedTickets++;
              addedImages += cloudTicket.images.length;
            } else {
              // 情况3：原有数据相同或更新，跳过
              skippedTickets++;
            }
          }
        }
      }

      // 7. 重新加载服务
      unifiedStorageService.initialize();

      // 8. 更新统计
      await loadStats();

      // 9. 显示结果
      const resultDetails = [];
      if (addedTickets > 0) resultDetails.push(`新增 ${addedTickets} 张票据`);
      if (updatedTickets > 0) resultDetails.push(`更新 ${updatedTickets} 张票据`);
      if (skippedTickets > 0) resultDetails.push(`跳过 ${skippedTickets} 张票据`);
      if (addedCollections > 0) resultDetails.push(`新增 ${addedCollections} 个合集`);
      if (addedImages > 0) resultDetails.push(`${addedImages} 张图片`);

      setResultData({
        success: true,
        title: '增量恢复完成',
        message: resultDetails.length > 0 ? resultDetails.join('，') : '没有需要恢复的数据',
        details: '原有数据已保留，仅补充和更新了差异部分',
      });
      setShowResult(true);
    } catch (error) {
      console.error('恢复数据失败:', error);
      Toast.show({ 
        type: 'error', 
        text1: '恢复失败', 
        text2: error instanceof Error ? error.message : '未知错误' 
      });
    } finally {
      setImporting(false);
    }
  };

  /**
   * 恢复单个本地票据
   */
  const restoreTicket = async (ticket: LocalTicket, zip: JSZip, source: 'local' | 'cloud') => {
    const ticketDir = `${localTicketService.getBaseDir()}/tickets/${ticket.id}`;
    const imagesDir = `${ticketDir}/images`;
    await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });

    // 恢复图片
    const folderPrefix = `images/${source}/${ticket.id}/`;
    for (let idx = 0; idx < ticket.images.length; idx++) {
      const expectedFileName = `${idx}.jpg`;
      const expectedPath = `${folderPrefix}${expectedFileName}`;
      const imageFile = zip.file(expectedPath);
      if (imageFile) {
        try {
          const base64Data = await imageFile.async('base64');
          const localPath = `${imagesDir}/${expectedFileName}`;
          await FileSystem.writeAsStringAsync(localPath, base64Data, {
            encoding: EncodingType.Base64,
          });
        } catch (imgError) {
          console.warn(`恢复图片失败: ${expectedPath}`, imgError);
        }
      }
    }

    // 保存票据元数据
    const metaPath = `${ticketDir}/meta.json`;
    const ticketData = {
      ...ticket,
      images: ticket.images.map((img, idx) => ({
        ...img,
        id: img.id || `img_${idx}`,
        fileName: `${idx}.jpg`,
        localPath: `images/${idx}.jpg`,
      })),
      isCloudSynced: false,
      cloudId: undefined,
      localPath: ticketDir,
    };
    await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(ticketData, null, 2));

    // 更新索引
    await localTicketService.addToIndexAfterRestore({
      id: ticket.id,
      title: ticket.title,
      ticketDate: ticket.ticketDate || null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt || ticket.createdAt,
      isCloudSynced: false,
      thumbnailPath: ticket.images[0] ? `images/0.jpg` : undefined,
      imageCount: ticket.images.length,
    });
  };

  /**
   * 将云端票据恢复为本地票据
   */
  const restoreCloudTicketAsLocal = async (cloudTicket: CloudTicket, zip: JSZip) => {
    const ticketDir = `${localTicketService.getBaseDir()}/tickets/${cloudTicket.id}`;
    const imagesDir = `${ticketDir}/images`;
    await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });

    // 恢复图片
    const folderPrefix = `images/cloud/${cloudTicket.id}/`;
    for (let idx = 0; idx < cloudTicket.images.length; idx++) {
      const expectedFileName = `${idx}.jpg`;
      const expectedPath = `${folderPrefix}${expectedFileName}`;
      const imageFile = zip.file(expectedPath);
      if (imageFile) {
        try {
          const base64Data = await imageFile.async('base64');
          const localPath = `${imagesDir}/${expectedFileName}`;
          await FileSystem.writeAsStringAsync(localPath, base64Data, {
            encoding: EncodingType.Base64,
          });
        } catch (imgError) {
          console.warn(`恢复云端图片失败: ${expectedPath}`, imgError);
        }
      }
    }

    // 转换云端票据为本地格式
    const localTicket: LocalTicket = {
      id: cloudTicket.id,
      title: cloudTicket.title,
      summary: cloudTicket.summary,
      ocrText: cloudTicket.ocrText || undefined,
      collectionId: cloudTicket.collectionId || undefined,
      location: cloudTicket.location || undefined,
      notes: cloudTicket.notes || undefined,
      ticketDate: cloudTicket.ticketDate || undefined,
      expiryDate: cloudTicket.expiryDate || undefined,
      isPrivate: cloudTicket.isPrivate,
      tags: cloudTicket.tags.map(t => t.name),
      images: cloudTicket.images.map((img, idx) => ({
        id: img.id,
        fileName: `${idx}.jpg`,
        localPath: `images/${idx}.jpg`,
        sortOrder: img.sortOrder,
        cloudUrl: img.url,
        cloudThumbnailUrl: img.thumbnailUrl,
      })),
      isCloudSynced: false,
      cloudId: cloudTicket.id,
      createdAt: cloudTicket.createdAt,
      updatedAt: cloudTicket.updatedAt || cloudTicket.createdAt,
      localPath: ticketDir,
    };

    // 保存票据元数据
    const metaPath = `${ticketDir}/meta.json`;
    await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(localTicket, null, 2));

    // 更新索引
    await localTicketService.addToIndexAfterRestore({
      id: cloudTicket.id,
      title: cloudTicket.title,
      ticketDate: cloudTicket.ticketDate || null,
      createdAt: cloudTicket.createdAt,
      updatedAt: cloudTicket.updatedAt || cloudTicket.createdAt,
      isCloudSynced: false,
      thumbnailPath: cloudTicket.images[0] ? `images/0.jpg` : undefined,
      imageCount: cloudTicket.images.length,
    });
  };

  // 计算总数据量
  const totalTickets = stats.ticketCount + stats.cloudTicketCount;
  const totalImages = stats.imageCount + stats.cloudImageCount;

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <AppHeader title="数据备份" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader title="数据备份" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 功能说明 */}
        <View style={styles.section}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionTitle}>
            数据备份
          </ThemedText>
          <View style={[styles.card, { paddingVertical: Spacing.md }]}>
            <ThemedText variant="small" color={theme.textMuted} style={{ lineHeight: 20 }}>
              将票据数据和图片打包导出为备份文件，可保存到手机或云盘中。支持备份本地数据和云端数据，需要时选择备份文件即可恢复。
            </ThemedText>
          </View>
        </View>

        {/* 数据统计 */}
        <View style={styles.section}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionTitle}>
            当前数据
          </ThemedText>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <ThemedText variant="body" color={theme.textSecondary}>
                本地票据
              </ThemedText>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                {stats.ticketCount} 张 ({stats.imageCount} 张图片)
              </ThemedText>
            </View>
            {stats.cloudTicketCount > 0 && (
              <View style={styles.infoRow}>
                <ThemedText variant="body" color={theme.textSecondary}>
                  云端票据
                </ThemedText>
                <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                  {stats.cloudTicketCount} 张 ({stats.cloudImageCount} 张图片)
                </ThemedText>
              </View>
            )}
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                合计
              </ThemedText>
              <ThemedText variant="bodyMedium" color={theme.primary}>
                {totalTickets} 张票据 ({totalImages} 张图片)
              </ThemedText>
            </View>
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionButton, exporting && styles.actionButtonDisabled]}
            onPress={handleExportPress}
            disabled={exporting || totalTickets === 0}
          >
            {exporting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                <ThemedText variant="bodyMedium" style={[styles.actionButtonText, { marginLeft: Spacing.sm }]}>
                  {progress.stage || '备份中...'}
                </ThemedText>
              </View>
            ) : (
              <>
                <FontAwesome6 name="file-export" size={18} color={theme.buttonPrimaryText} />
                <ThemedText variant="bodyMedium" style={styles.actionButtonText}>
                  立即备份
                </ThemedText>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton, importing && styles.actionButtonDisabled]}
            onPress={handleImport}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color={theme.textPrimary} />
            ) : (
              <>
                <FontAwesome6 name="file-import" size={18} color={theme.textPrimary} />
                <ThemedText
                  variant="bodyMedium"
                  style={[styles.actionButtonText, styles.secondaryButtonText]}
                >
                  恢复备份
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 注意事项 */}
        <View style={styles.section}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionTitle}>
            注意事项
          </ThemedText>
          <View style={[styles.card, styles.warningCard]}>
            <View style={styles.warningItem}>
              <FontAwesome6 name="circle-info" size={14} color={theme.textMuted} />
              <ThemedText variant="small" color={theme.textMuted} style={styles.warningText}>
                恢复备份将覆盖现有本地数据
              </ThemedText>
            </View>
            <View style={styles.warningItem}>
              <FontAwesome6 name="circle-info" size={14} color={theme.textMuted} />
              <ThemedText variant="small" color={theme.textMuted} style={styles.warningText}>
                备份云端图片需要网络连接
              </ThemedText>
            </View>
            <View style={styles.warningItem}>
              <FontAwesome6 name="circle-info" size={14} color={theme.textMuted} />
              <ThemedText variant="small" color={theme.textMuted} style={styles.warningText}>
                数据较多时备份时间会较长，请耐心等待
              </ThemedText>
            </View>
            <View style={[styles.warningItem, { borderBottomWidth: 0 }]}>
              <FontAwesome6 name="circle-info" size={14} color={theme.textMuted} />
              <ThemedText variant="small" color={theme.textMuted} style={styles.warningText}>
                建议定期备份并保存到多个位置
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Web端提示 */}
        {Platform.OS === 'web' && (
          <View style={[styles.card, { backgroundColor: theme.primary + '10' }]}>
            <ThemedText variant="small" color={theme.textSecondary}>
              Web端备份文件将下载到浏览器默认下载目录
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* 备份范围选择弹窗 */}
      <Modal
        visible={showScopeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScopeModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowScopeModal(false)}
        >
          <Pressable
            style={{
              width: '85%',
              backgroundColor: theme.backgroundDefault,
              borderRadius: BorderRadius.xl,
              overflow: 'hidden',
              maxHeight: '80%',
            }}
            onPress={() => {}}
          >
            {/* 弹窗标题 */}
            <View style={{
              paddingVertical: Spacing.lg,
              paddingHorizontal: Spacing.xl,
              borderBottomWidth: 1,
              borderBottomColor: theme.borderLight,
            }}>
              <ThemedText variant="h4" color={theme.textPrimary} style={{ textAlign: 'center' }}>
                选择备份范围
              </ThemedText>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <View style={{ padding: Spacing.lg }}>
                {/* 数据来源选择 */}
                <ThemedText variant="smallMedium" color={theme.textSecondary} style={{ marginBottom: Spacing.sm }}>
                  数据来源
                </ThemedText>
                
                {/* 本地数据 */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: Spacing.md,
                    borderRadius: BorderRadius.lg,
                    backgroundColor: selectedSource === 'local' ? theme.primary + '10' : theme.backgroundTertiary,
                    marginBottom: Spacing.sm,
                    borderWidth: selectedSource === 'local' ? 1.5 : 0,
                    borderColor: selectedSource === 'local' ? theme.primary : 'transparent',
                  }}
                  onPress={() => setSelectedSource('local')}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: BorderRadius.md,
                    backgroundColor: theme.primary + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: Spacing.md,
                  }}>
                    <FontAwesome6 name="mobile-screen" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                      仅本地数据
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted}>
                      {stats.ticketCount} 张票据，{stats.imageCount} 张图片
                    </ThemedText>
                  </View>
                  {selectedSource === 'local' && (
                    <FontAwesome6 name="circle-check" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>

                {/* 云端数据 */}
                {stats.cloudTicketCount > 0 && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: Spacing.md,
                      borderRadius: BorderRadius.lg,
                      backgroundColor: selectedSource === 'cloud' ? theme.accent + '10' : theme.backgroundTertiary,
                      marginBottom: Spacing.sm,
                      borderWidth: selectedSource === 'cloud' ? 1.5 : 0,
                      borderColor: selectedSource === 'cloud' ? theme.accent : 'transparent',
                    }}
                    onPress={() => setSelectedSource('cloud')}
                  >
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: BorderRadius.md,
                      backgroundColor: theme.accent + '20',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: Spacing.md,
                    }}>
                      <FontAwesome6 name="cloud" size={18} color={theme.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                        仅云端数据
                      </ThemedText>
                      <ThemedText variant="small" color={theme.textMuted}>
                        {stats.cloudTicketCount} 张票据，{stats.cloudImageCount} 张图片
                      </ThemedText>
                    </View>
                    {selectedSource === 'cloud' && (
                      <FontAwesome6 name="circle-check" size={20} color={theme.accent} />
                    )}
                  </TouchableOpacity>
                )}

                {/* 全部数据 */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: Spacing.md,
                    borderRadius: BorderRadius.lg,
                    backgroundColor: selectedSource === 'all' ? theme.primary + '10' : theme.backgroundTertiary,
                    marginBottom: Spacing.lg,
                    borderWidth: selectedSource === 'all' ? 1.5 : 0,
                    borderColor: selectedSource === 'all' ? theme.primary : 'transparent',
                  }}
                  onPress={() => setSelectedSource('all')}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: BorderRadius.md,
                    backgroundColor: theme.primary + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: Spacing.md,
                  }}>
                    <FontAwesome6 name="layer-group" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                      全部数据
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted}>
                      {totalTickets} 张票据，{totalImages} 张图片
                    </ThemedText>
                  </View>
                  {selectedSource === 'all' && (
                    <FontAwesome6 name="circle-check" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>

                {/* 时间范围选择 */}
                <ThemedText variant="smallMedium" color={theme.textSecondary} style={{ marginBottom: Spacing.sm }}>
                  时间范围
                </ThemedText>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={{
                        paddingHorizontal: Spacing.md,
                        paddingVertical: Spacing.sm,
                        borderRadius: BorderRadius.lg,
                        backgroundColor: selectedTimeRange === option.key 
                          ? theme.primary 
                          : theme.backgroundTertiary,
                        borderWidth: selectedTimeRange === option.key ? 0 : 1,
                        borderColor: theme.border,
                      }}
                      onPress={() => setSelectedTimeRange(option.key)}
                    >
                      <ThemedText 
                        variant="smallMedium" 
                        color={selectedTimeRange === option.key 
                          ? theme.buttonPrimaryText 
                          : theme.textSecondary}
                      >
                        {option.name}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* 提示信息 */}
            <View style={{
              paddingHorizontal: Spacing.lg,
              paddingBottom: Spacing.md,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: theme.primary + '10',
                padding: Spacing.md,
                borderRadius: BorderRadius.md,
              }}>
                <FontAwesome6 name="lightbulb" size={14} color={theme.primary} style={{ marginRight: Spacing.sm, marginTop: 2 }} />
                <ThemedText variant="small" color={theme.textSecondary} style={{ flex: 1 }}>
                  {selectedTimeRange !== 'all' 
                    ? `仅备份${TIME_RANGE_OPTIONS.find(o => o.key === selectedTimeRange)?.name}内创建的票据`
                    : totalImages > 50 
                      ? '图片数量较多，备份可能需要较长时间'
                      : '选择"全部"可确保所有票据完整备份'}
                </ThemedText>
              </View>
            </View>

            {/* 操作按钮 */}
            <View style={{ 
              flexDirection: 'row', 
              borderTopWidth: 1, 
              borderTopColor: theme.borderLight 
            }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: Spacing.md,
                  alignItems: 'center',
                  borderRightWidth: 1,
                  borderRightColor: theme.borderLight,
                }}
                onPress={() => setShowScopeModal(false)}
              >
                <ThemedText variant="body" color={theme.textMuted}>
                  取消
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: Spacing.md,
                  alignItems: 'center',
                  backgroundColor: theme.primary,
                }}
                onPress={() => handleExportWithScope(selectedSource, selectedTimeRange)}
              >
                <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                  开始备份
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 结果弹窗 */}
      <Modal
        visible={showResult}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResult(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setShowResult(false)}
        >
          <View style={{
            width: '85%',
            backgroundColor: theme.backgroundDefault,
            borderRadius: BorderRadius.xl,
            overflow: 'hidden',
          }}>
            {/* 弹窗标题 */}
            <View style={{
              paddingVertical: Spacing.lg,
              paddingHorizontal: Spacing.xl,
              borderBottomWidth: 1,
              borderBottomColor: theme.borderLight,
              alignItems: 'center',
            }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: resultData?.success ? theme.success + '20' : theme.error + '20',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: Spacing.sm,
              }}>
                <FontAwesome6 
                  name={resultData?.success ? 'check' : 'xmark'} 
                  size={24} 
                  color={resultData?.success ? theme.success : theme.error} 
                />
              </View>
              <ThemedText variant="h4" color={theme.textPrimary}>
                {resultData?.title}
              </ThemedText>
            </View>

            {/* 结果详情 */}
            <View style={{ padding: Spacing.lg }}>
              <ThemedText variant="body" color={theme.textPrimary} style={{ textAlign: 'center' }}>
                {resultData?.message}
              </ThemedText>
              {resultData?.details && (
                <ThemedText variant="small" color={theme.textMuted} style={{ textAlign: 'center', marginTop: Spacing.sm }}>
                  {resultData.details}
                </ThemedText>
              )}
            </View>

            {/* 确认按钮 */}
            <TouchableOpacity
              style={{
                paddingVertical: Spacing.lg,
                alignItems: 'center',
                backgroundColor: theme.primary,
              }}
              onPress={() => setShowResult(false)}
            >
              <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                我知道了
              </ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
