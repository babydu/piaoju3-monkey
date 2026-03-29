/**
 * 统一存储服务
 * 整合本地存储和云端存储，根据用户设置选择存储后端
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { localTicketService } from './LocalTicketService';
import { createFormDataFile } from '@/utils';
import {
  TicketIndexItem,
  LocalTicket,
  LocalImage,
  LocalCollection,
  LocalTag,
  LocalSettings,
  DEFAULT_LOCAL_SETTINGS,
} from './types';

// 从 legacy 模块获取常量
// @ts-ignore - EncodingType 存在于 legacy 模块中
const EncodingType = FileSystem.EncodingType;

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

// Web平台存储Key
const WEB_SETTINGS_KEY = '@ticketmanager/settings';

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

/**
 * 统一存储服务类
 */
export class UnifiedStorageService {
  private initialized: boolean = false;
  private settings: LocalSettings = DEFAULT_LOCAL_SETTINGS;

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Web平台使用AsyncStorage存储设置
    if (Platform.OS === 'web') {
      try {
        const settingsStr = await AsyncStorage.getItem(WEB_SETTINGS_KEY);
        if (settingsStr) {
          this.settings = { ...DEFAULT_LOCAL_SETTINGS, ...JSON.parse(settingsStr) };
          
          // 迁移旧的存储模式到新格式（兼容旧版本的数据）
          const storageMode = (this.settings as any).storageMode;
          if (storageMode === 'cloud-first' || storageMode === 'hybrid') {
            this.settings.storageMode = 'cloud';
            await AsyncStorage.setItem(WEB_SETTINGS_KEY, JSON.stringify(this.settings));
            console.log('[UnifiedStorage] 已迁移存储模式为: cloud');
          }
        } else {
          // Web平台默认使用云端存储
          this.settings = { ...DEFAULT_LOCAL_SETTINGS, storageMode: 'cloud' };
          await AsyncStorage.setItem(WEB_SETTINGS_KEY, JSON.stringify(this.settings));
        }
      } catch (error) {
        console.error('Web平台加载设置失败:', error);
      }
      this.initialized = true;
      return;
    }

    // 移动端：初始化本地存储
    await localTicketService.initialize();

    // 加载设置
    this.settings = await localTicketService.getSettings();

    this.initialized = true;
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 获取当前存储设置
   */
  async getSettings(): Promise<LocalSettings> {
    await this.ensureInitialized();
    return this.settings;
  }

  /**
   * 更新存储设置
   */
  async updateSettings(newSettings: Partial<LocalSettings>): Promise<LocalSettings> {
    await this.ensureInitialized();
    
    // 更新内存中的设置
    this.settings = { ...this.settings, ...newSettings };
    
    // Web平台：使用AsyncStorage存储设置
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(WEB_SETTINGS_KEY, JSON.stringify(this.settings));
      return this.settings;
    }
    
    // 移动端：使用本地文件存储设置
    await localTicketService.updateSettings(newSettings);
    return this.settings;
  }

  /**
   * 判断是否启用云端备份
   * 只有在 'cloud' 模式下才上传云端
   */
  isCloudBackupEnabled(): boolean {
    return this.settings.storageMode === 'cloud';
  }

  /**
   * 判断是否允许私密票据云端存储
   */
  isPrivateCloudStorageAllowed(): boolean {
    return this.settings.allowPrivateCloudStorage === true;
  }

  /**
   * 判断票据是否应该同步到云端
   * @param isPrivate 票据是否为私密
   * @returns 是否应该同步到云端
   */
  shouldSyncToCloud(isPrivate: boolean): boolean {
    // 未启用云端备份，不同步
    if (!this.isCloudBackupEnabled()) {
      return false;
    }
    // 私密票据需要额外检查设置
    if (isPrivate && !this.isPrivateCloudStorageAllowed()) {
      return false;
    }
    return true;
  }

  /**
   * 判断是否仅使用云端存储（不保存本地）
   * 现在云端模式也是本地+云端，所以始终返回false
   */
  isCloudOnly(): boolean {
    return false;
  }

  /**
   * 判断是否需要保存本地
   * 两种模式都需要保存本地
   */
  shouldSaveLocal(): boolean {
    return true;
  }

  /**
   * 获取存储模式
   */
  getStorageMode(): 'local-only' | 'cloud' {
    return this.settings.storageMode;
  }

  // ==================== 票据操作 ====================

  /**
   * 创建票据
   * Web平台：直接上传云端
   * 移动端：优先保存到本地，如果启用云端备份则同时上传
   */
  async createTicket(
    data: {
      title: string;
      summary?: string;
      ocrText?: string;
      collectionId?: string;
      collectionName?: string;
      location?: string;
      ticketDate?: string;
      expiryDate?: string;
      notes?: string;
      isPrivate?: boolean;
      tags?: string[];
    },
    imageUris: string[],
    token?: string
  ): Promise<{ ticket: LocalTicket; cloudSynced: boolean }> {
    await this.ensureInitialized();
    
    // 重新加载设置，确保使用最新的存储模式
    if (Platform.OS !== 'web') {
      this.settings = await localTicketService.getSettings();
    }
    console.log('[UnifiedStorage] 创建票据，当前存储模式:', this.settings.storageMode);

    // Web平台：仅支持云端存储
    if (Platform.OS === 'web') {
      return this.createTicketWeb(data, imageUris, token);
    }

    // 移动端：先保存到本地
    const localTicket = await localTicketService.createTicket(data, imageUris);

    let cloudSynced = false;

    // 判断是否应该同步到云端（考虑私密票据设置）
    const shouldSync = this.shouldSyncToCloud(data.isPrivate || false);
    
    if (shouldSync && token) {
      console.log('[UnifiedStorage] 票据将同步到云端, isPrivate:', data.isPrivate);
      try {
        const cloudResult = await this.uploadTicketToCloud(localTicket, token);
        if (cloudResult.success && cloudResult.cloudId) {
          // 更新本地票据的云端信息（传入云端缩略图URL）
          const cloudThumbnailUrl = cloudResult.cloudUrls?.[0];
          await localTicketService.markTicketSynced(localTicket.id, cloudResult.cloudId, cloudThumbnailUrl);
          localTicket.isCloudSynced = true;
          localTicket.cloudId = cloudResult.cloudId;
          cloudSynced = true;
          console.log('[UnifiedStorage] 票据已同步到云端:', cloudResult.cloudId, '缩略图:', cloudThumbnailUrl);
        }
      } catch (error) {
        console.error('[UnifiedStorage] 上传到云端失败:', error);
        // 添加到待上传队列
        await localTicketService.addToPendingUpload(localTicket.id);
      }
    } else if (data.isPrivate && !this.isPrivateCloudStorageAllowed()) {
      console.log('[UnifiedStorage] 私密票据仅保存在本地，不同步到云端');
    }

    return { ticket: localTicket, cloudSynced };
  }

  /**
   * Web平台创建票据（直接上传云端）
   */
  private async createTicketWeb(
    data: {
      title: string;
      summary?: string;
      ocrText?: string;
      collectionId?: string;
      collectionName?: string;
      location?: string;
      ticketDate?: string;
      expiryDate?: string;
      notes?: string;
      isPrivate?: boolean;
      tags?: string[];
    },
    imageUris: string[],
    token?: string
  ): Promise<{ ticket: LocalTicket; cloudSynced: boolean }> {
    if (!token) {
      throw new Error('Web平台需要登录才能保存票据');
    }

    // 1. 上传图片
    const uploadedUrls: string[] = [];
    for (const imageUri of imageUris) {
      const formData = new FormData();
      const fileName = `ticket_${Date.now()}.jpg`;
      
      // Web平台使用原生FormData
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      formData.append('file', file);

      const uploadRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (uploadData.success && uploadData.url) {
        uploadedUrls.push(uploadData.url);
      }
    }

    // 2. 创建云端票据
    const ticketData = {
      title: data.title,
      summary: data.summary,
      ticketDate: data.ticketDate,
      expiryDate: data.expiryDate,
      location: data.location,
      notes: data.notes,
      ocrText: data.ocrText,
      tagNames: data.tags && data.tags.length > 0 ? data.tags : null,
      collectionId: data.collectionId,
      imageUrls: uploadedUrls,
      isPrivate: data.isPrivate || false,
    };

    const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(ticketData),
    });

    const result = await response.json();
    if (result.success && result.ticket) {
      // 将云端票据转换为本地格式返回
      const localTicket: LocalTicket = {
        id: result.ticket.id,
        title: result.ticket.title,
        summary: result.ticket.summary,
        ocrText: result.ticket.ocrText,
        collectionId: result.ticket.collectionId,
        collectionName: result.ticket.collection?.name,
        location: result.ticket.location,
        notes: result.ticket.notes,
        ticketDate: result.ticket.ticketDate,
        expiryDate: result.ticket.expiryDate,
        isPrivate: result.ticket.isPrivate,
        createdAt: result.ticket.createdAt,
        updatedAt: result.ticket.createdAt,
        images: result.ticket.images.map((img: any) => ({
          id: img.id,
          localPath: img.url,
          fileName: img.url.split('/').pop(),
          width: 0,
          height: 0,
          sortOrder: img.sortOrder,
        })),
        tags: result.ticket.tags.map((t: any) => t.name),
        isCloudSynced: true,
        cloudId: result.ticket.id,
      };
      return { ticket: localTicket, cloudSynced: true };
    }

    throw new Error(result.error || '创建票据失败');
  }

  /**
   * 上传票据到云端
   */
  private async uploadTicketToCloud(
    ticket: LocalTicket,
    token: string
  ): Promise<{ success: boolean; cloudId?: string; cloudUrls?: string[]; error?: string }> {
    try {
      console.log(`[UnifiedStorage] 开始上传票据: ${ticket.title}, 图片数量: ${ticket.images.length}`);
      console.log(`[UnifiedStorage] 票据ID: ${ticket.id}, cloudId: ${ticket.cloudId}, isCloudSynced: ${ticket.isCloudSynced}`);
      
      // 如果票据已经有云端ID，说明之前已经同步过了
      // 这种情况可能是 isCloudSynced 被错误地重置了
      if (ticket.cloudId) {
        console.log(`[UnifiedStorage] 票据已有云端ID: ${ticket.cloudId}，跳过重新上传，直接标记为已同步`);
        // 修复：直接返回成功，使用现有的云端ID
        const cloudUrls = ticket.images
          .filter(img => img.cloudUrl)
          .map(img => img.cloudUrl!);
        return { 
          success: true, 
          cloudId: ticket.cloudId, 
          cloudUrls: cloudUrls.length > 0 ? cloudUrls : undefined 
        };
      }
      
      // 1. 上传图片
      const uploadedUrls: string[] = [];
      const failedImages: string[] = [];
      
      for (let i = 0; i < ticket.images.length; i++) {
        const image = ticket.images[i];
        console.log(`[UnifiedStorage] 图片${i}:`, {
          id: image.id,
          fileName: image.fileName,
          localPath: image.localPath,
          cloudUrl: image.cloudUrl,
        });
        
        // 尝试多个可能的路径来找到图片文件
        let actualLocalPath: string | null = null;
        const possiblePaths = [
          image.localPath,
          `images/${image.localPath}`, // 如果 localPath 只是文件名
          `images/original_${i}.jpg`,  // 标准格式
          image.localPath?.replace(/^images\//, ''), // 去掉 images/ 前缀再试
        ].filter(Boolean) as string[];
        
        for (const testPath of possiblePaths) {
          const exists = await localTicketService.checkImageExists(ticket.id, testPath);
          if (exists) {
            actualLocalPath = testPath;
            console.log(`[UnifiedStorage] 找到图片: ${testPath}`);
            break;
          }
        }
        
        // 如果所有路径都找不到图片，尝试列出票据目录内容进行诊断
        if (!actualLocalPath) {
          const ticketDir = `${localTicketService.getBaseDir()}/tickets/${ticket.id}`;
          console.log(`[UnifiedStorage] 图片不存在，尝试列出票据目录内容: ${ticketDir}`);
          try {
            const dirInfo = await FileSystem.getInfoAsync(ticketDir);
            if (dirInfo.exists) {
              const imagesDir = `${ticketDir}/images`;
              const imagesDirInfo = await FileSystem.getInfoAsync(imagesDir);
              if (imagesDirInfo.exists) {
                const files = await FileSystem.readDirectoryAsync(imagesDir);
                console.log(`[UnifiedStorage] images目录内容:`, files);
              } else {
                console.log(`[UnifiedStorage] images目录不存在`);
              }
            } else {
              console.log(`[UnifiedStorage] 票据目录不存在`);
            }
          } catch (listError) {
            console.log(`[UnifiedStorage] 列出目录失败:`, listError);
          }
          
          // 如果图片有云端URL，直接使用云端URL上传
          if (image.cloudUrl) {
            console.log(`[UnifiedStorage] 尝试使用云端URL: ${image.cloudUrl}`);
            try {
              uploadedUrls.push(image.cloudUrl);
              continue; // 使用云端URL，跳过本地上传
            } catch (cloudError) {
              console.log(`[UnifiedStorage] 使用云端URL失败:`, cloudError);
            }
          }
          
          failedImages.push(`${image.fileName || `image_${i}`}: 文件不存在 (尝试路径: ${possiblePaths.join(', ')})`);
          continue;
        }
        
        const imageUri = localTicketService.getTicketImageUri(ticket.id, actualLocalPath);
        console.log(`[UnifiedStorage] 图片URI: ${imageUri}`);

        const formData = new FormData();
        
        // 使用 createFormDataFile 创建跨平台兼容的文件对象
        const file = await createFormDataFile(imageUri, image.fileName || `image_${i}.jpg`, 'image/jpeg');
        formData.append('file', file as any);

        // 添加重试机制
        let uploadSuccess = false;
        let lastError: string | null = null;
        
        for (let retry = 0; retry < 3 && !uploadSuccess; retry++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

            const uploadRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/upload`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!uploadRes.ok) {
              const errorText = await uploadRes.text();
              throw new Error(`HTTP ${uploadRes.status}: ${errorText}`);
            }

            const uploadData = await uploadRes.json();
            if (uploadData.success && uploadData.url) {
              uploadedUrls.push(uploadData.url);
              uploadSuccess = true;
            } else {
              lastError = uploadData.error || '图片上传失败';
              if (retry < 2) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // 递增延迟
              }
            }
          } catch (fetchError: any) {
            lastError = fetchError.message || String(fetchError);
            if (retry < 2) {
              console.log(`[UnifiedStorage] 图片上传重试 ${retry + 1}/3:`, lastError);
              await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
            }
          }
        }

        if (!uploadSuccess) {
          failedImages.push(`${image.fileName || `image_${i}`}: ${lastError}`);
        }
      }
      
      // 输出上传结果摘要
      if (failedImages.length > 0) {
        console.log(`[UnifiedStorage] 图片上传结果: 成功${uploadedUrls.length}张, 失败${failedImages.length}张`);
        failedImages.forEach(err => console.log(`  - ${err}`));
      }

      if (uploadedUrls.length === 0) {
        const errorDetail = failedImages.length > 0 
          ? `所有图片上传失败: ${failedImages.join('; ')}`
          : '票据没有图片';
        throw new Error(errorDetail);
      }

      // 2. 创建云端票据
      const ticketData = {
        title: ticket.title,
        summary: ticket.summary,
        ticketDate: ticket.ticketDate,
        expiryDate: ticket.expiryDate,
        location: ticket.location,
        notes: ticket.notes,
        ocrText: ticket.ocrText,
        tagNames: ticket.tags.length > 0 ? ticket.tags : null,
        collectionId: ticket.collectionId,
        imageUrls: uploadedUrls,
        isPrivate: ticket.isPrivate,
      };

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(ticketData),
      });

      const data = await response.json();
      if (data.success) {
        return { success: true, cloudId: data.ticket?.id, cloudUrls: uploadedUrls };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('[UnifiedStorage] 上传票据失败:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取票据列表
   * Web平台：仅从云端获取
   * 移动端：合并本地和云端数据
   */
  async getTickets(
    options?: {
      sortBy?: 'newest' | 'oldest';
      tagFilter?: string;
      collectionFilter?: string;
    },
    token?: string
  ): Promise<TicketIndexItem[]> {
    await this.ensureInitialized();

    // Web平台：仅从云端获取
    if (Platform.OS === 'web') {
      if (!token) {
        return [];
      }
      try {
        const cloudTickets = await this.fetchCloudTickets(token, options);
        return cloudTickets.map(t => this.cloudTicketToIndexItem(t));
      } catch (error) {
        console.error('[UnifiedStorage] 获取云端票据失败:', error);
        return [];
      }
    }

    // 移动端：获取本地票据
    const localTickets = await localTicketService.getTickets(options);

    // 如果启用云端备份，获取云端票据并合并
    if (this.isCloudBackupEnabled() && token) {
      try {
        const cloudTickets = await this.fetchCloudTickets(token, options);
        return this.mergeTickets(localTickets, cloudTickets);
      } catch (error) {
        console.error('[UnifiedStorage] 获取云端票据失败:', error);
        return localTickets;
      }
    }

    return localTickets;
  }

  /**
   * 从云端获取票据列表
   */
  private async fetchCloudTickets(
    token: string,
    options?: {
      sortBy?: 'newest' | 'oldest';
      tagFilter?: string;
      collectionFilter?: string;
    }
  ): Promise<CloudTicket[]> {
    try {
      let url = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets`;
      const params = new URLSearchParams();
      
      if (options?.tagFilter) params.append('tagId', options.tagFilter);
      if (options?.collectionFilter) params.append('collectionId', options.collectionFilter);
      params.append('sort', options?.sortBy === 'oldest' ? 'oldest' : 'newest');
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      return data.success ? data.tickets : [];
    } catch (error) {
      console.error('[UnifiedStorage] 获取云端票据失败:', error);
      return [];
    }
  }

  /**
   * 将云端票据转换为索引项
   */
  private cloudTicketToIndexItem(cloud: CloudTicket): TicketIndexItem {
    return {
      id: cloud.id,
      title: cloud.title,
      ticketDate: cloud.ticketDate,
      createdAt: cloud.createdAt,
      updatedAt: cloud.createdAt,
      isCloudSynced: true,
      isPrivate: cloud.isPrivate,
      cloudId: cloud.id,
      thumbnailPath: cloud.images[0]?.thumbnailUrl,
      imageCount: cloud.images.length,
    };
  }

  /**
   * 合并本地和云端票据
   */
  private mergeTickets(
    localTickets: TicketIndexItem[],
    cloudTickets: CloudTicket[]
  ): TicketIndexItem[] {
    const result: TicketIndexItem[] = [];
    const addedIds = new Set<string>();

    // 添加本地票据
    for (const local of localTickets) {
      // 如果本地票据已同步，检查云端是否存在
      if (local.isCloudSynced && local.cloudId) {
        const cloudExists = cloudTickets.some(c => c.id === local.cloudId);
        if (!cloudExists) {
          // 云端已被删除，保留本地（或者可以标记为待上传）
        }
      }
      
      result.push(local);
      addedIds.add(local.id);
    }

    // 添加云端票据（排除已同步的）
    for (const cloud of cloudTickets) {
      // 检查是否已存在对应的本地票据
      const localMatch = localTickets.find(l => l.cloudId === cloud.id);
      if (!localMatch && !addedIds.has(cloud.id)) {
        // 仅云端存在的票据
        result.push({
          id: cloud.id,
          title: cloud.title,
          ticketDate: cloud.ticketDate,
          createdAt: cloud.createdAt,
          updatedAt: cloud.createdAt,
          isCloudSynced: true,
          isPrivate: cloud.isPrivate,
          cloudId: cloud.id,
          thumbnailPath: cloud.images[0]?.thumbnailUrl,
          imageCount: cloud.images.length,
        });
        addedIds.add(cloud.id);
      }
    }

    // 排序
    result.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    return result;
  }

  /**
   * 获取票据详情
   */
  async getTicket(ticketId: string, token?: string): Promise<LocalTicket | CloudTicket | null> {
    await this.ensureInitialized();

    // 1. 尝试从本地获取
    const localTicket = await localTicketService.getTicket(ticketId);
    if (localTicket) {
      return localTicket;
    }

    // 2. 尝试从云端获取
    if (this.isCloudBackupEnabled() && token) {
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/${ticketId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          return data.ticket;
        }
      } catch (error) {
        console.error('[UnifiedStorage] 获取云端票据详情失败:', error);
      }
    }

    return null;
  }

  /**
   * 更新票据
   */
  async updateTicket(
    ticketId: string,
    data: Partial<Omit<LocalTicket, 'id' | 'createdAt' | 'images'>>,
    token?: string
  ): Promise<LocalTicket | null> {
    await this.ensureInitialized();

    // 1. 更新本地票据
    const localTicket = await localTicketService.updateTicket(ticketId, data);

    // 2. 如果启用云端且票据已同步，更新云端
    if (localTicket?.isCloudSynced && localTicket.cloudId && token) {
      try {
        await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/${localTicket.cloudId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: data.title,
            summary: data.summary,
            ticketDate: data.ticketDate,
            expiryDate: data.expiryDate,
            location: data.location,
            notes: data.notes,
            tagNames: data.tags,
            collectionId: data.collectionId,
            isPrivate: data.isPrivate,
          }),
        });
      } catch (error) {
        console.error('[UnifiedStorage] 更新云端票据失败:', error);
        // 添加到待更新队列
        await localTicketService.addToPendingUpload(ticketId);
      }
    }

    return localTicket;
  }

  /**
   * 删除票据
   */
  async deleteTicket(ticketId: string, token?: string): Promise<boolean> {
    await this.ensureInitialized();

    // 1. 获取票据信息
    const ticket = await localTicketService.getTicket(ticketId);
    
    // 2. 删除本地票据
    const localDeleted = await localTicketService.deleteTicket(ticketId);

    // 3. 如果票据已同步到云端，删除云端票据
    if (ticket?.isCloudSynced && ticket.cloudId && token) {
      try {
        await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/${ticket.cloudId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        console.error('[UnifiedStorage] 删除云端票据失败:', error);
      }
    }

    return localDeleted;
  }

  // ==================== 合集操作 ====================

  /**
   * 获取合集列表
   */
  async getCollections(token?: string): Promise<LocalCollection[]> {
    await this.ensureInitialized();

    // Web平台：仅从云端获取
    if (Platform.OS === 'web') {
      if (!token) {
        return [];
      }
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        
        if (data.success && data.collections) {
          return data.collections.map((c: any) => ({
            id: c.id,
            name: c.name,
            createdAt: c.createdAt,
            isCloudSynced: true,
            cloudId: c.id,
          }));
        }
        return [];
      } catch (error) {
        console.error('[UnifiedStorage] 获取云端合集失败:', error);
        return [];
      }
    }

    // 移动端：获取本地合集
    const localCollections = await localTicketService.getCollections();

    // 如果启用云端，合并云端合集
    if (this.isCloudBackupEnabled() && token) {
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        
        if (data.success && data.collections) {
          // 合并，去重
          const cloudCollections: LocalCollection[] = data.collections.map((c: any) => ({
            id: c.id,
            name: c.name,
            createdAt: c.createdAt,
            isCloudSynced: true,
            cloudId: c.id,
          }));

          // 本地已同步的不重复添加
          const merged = [...localCollections];
          for (const cloud of cloudCollections) {
            if (!merged.some(l => l.cloudId === cloud.id || l.id === cloud.id)) {
              merged.push(cloud);
            }
          }
          return merged;
        }
      } catch (error) {
        console.error('[UnifiedStorage] 获取云端合集失败:', error);
      }
    }

    return localCollections;
  }

  /**
   * 创建合集
   */
  async createCollection(name: string, token?: string): Promise<LocalCollection> {
    await this.ensureInitialized();

    // 1. 创建本地合集
    const localCollection = await localTicketService.createCollection(name);

    // 2. 如果启用云端，同步创建
    if (this.isCloudBackupEnabled() && token) {
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
        
        if (data.success && data.collection) {
          // 更新本地合集的云端ID
          await localTicketService.updateCollection(localCollection.id, name);
          localCollection.cloudId = data.collection.id;
          localCollection.isCloudSynced = true;
        }
      } catch (error) {
        console.error('[UnifiedStorage] 创建云端合集失败:', error);
      }
    }

    return localCollection;
  }

  // ==================== 标签操作 ====================

  /**
   * 获取标签列表
   */
  async getTags(token?: string): Promise<LocalTag[]> {
    await this.ensureInitialized();

    // Web平台：仅从云端获取
    if (Platform.OS === 'web') {
      if (!token) {
        return [];
      }
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tags`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        
        if (data.success && data.tags) {
          return data.tags.map((t: any) => ({
            id: t.id,
            name: t.name,
            count: 0,
            isCloudSynced: true,
            cloudId: t.id,
          }));
        }
        return [];
      } catch (error) {
        console.error('[UnifiedStorage] 获取云端标签失败:', error);
        return [];
      }
    }

    // 移动端：获取本地标签
    const localTags = await localTicketService.getTags();

    // 如果启用云端，合并云端标签
    if (this.isCloudBackupEnabled() && token) {
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tags`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        
        if (data.success && data.tags) {
          const cloudTags: LocalTag[] = data.tags.map((t: any) => ({
            id: t.id,
            name: t.name,
            count: 0, // 云端标签可能没有count
            isCloudSynced: true,
            cloudId: t.id,
          }));

          // 合并，本地标签优先（有正确的count）
          const merged = [...localTags];
          for (const cloud of cloudTags) {
            if (!merged.some(l => l.name === cloud.name)) {
              merged.push(cloud);
            }
          }
          return merged;
        }
      } catch (error) {
        console.error('[UnifiedStorage] 获取云端标签失败:', error);
      }
    }

    return localTags;
  }

  // ==================== 搜索 ====================

  /**
   * 搜索票据
   */
  async searchTickets(keyword: string, token?: string): Promise<TicketIndexItem[]> {
    await this.ensureInitialized();

    // 搜索本地票据
    const localResults = await localTicketService.searchTickets(keyword);

    // 如果启用云端，搜索云端票据
    if (this.isCloudBackupEnabled() && token) {
      try {
        const params = new URLSearchParams();
        params.append('keyword', keyword);
        
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/search?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        
        if (data.success && data.tickets) {
          const cloudResults: TicketIndexItem[] = data.tickets.map((t: CloudTicket) => ({
            id: t.id,
            title: t.title,
            ticketDate: t.ticketDate,
            createdAt: t.createdAt,
            updatedAt: t.createdAt,
            isCloudSynced: true,
            cloudId: t.id,
            thumbnailPath: t.images[0]?.thumbnailUrl,
            imageCount: t.images.length,
          }));

          return this.mergeTickets(localResults, data.tickets);
        }
      } catch (error) {
        console.error('[UnifiedStorage] 搜索云端票据失败:', error);
      }
    }

    return localResults;
  }

  // ==================== 同步操作 ====================

  /**
   * 同步所有待上传的票据到云端
   */
  async syncToCloud(token: string): Promise<{
    success: number;
    failed: number;
    errors: string[];
    skipped: number;
  }> {
    await this.ensureInitialized();

    const result = { success: 0, failed: 0, errors: [] as string[], skipped: 0 };
    
    // 获取所有本地票据
    const localTickets = await localTicketService.getTickets();
    
    // 过滤出未同步的票据
    const unsyncedTickets = localTickets.filter(t => !t.isCloudSynced);

    for (const item of unsyncedTickets) {
      const ticket = await localTicketService.getTicket(item.id);
      if (!ticket) continue;

      // 检查是否应该同步（考虑私密票据设置）
      if (!this.shouldSyncToCloud(ticket.isPrivate)) {
        result.skipped++;
        continue;
      }

      try {
        const cloudResult = await this.uploadTicketToCloud(ticket, token);
        if (cloudResult.success && cloudResult.cloudId) {
          const cloudThumbnailUrl = cloudResult.cloudUrls?.[0];
          await localTicketService.markTicketSynced(item.id, cloudResult.cloudId, cloudThumbnailUrl);
          result.success++;
        } else {
          result.failed++;
          result.errors.push(`票据"${ticket.title}"上传失败: ${cloudResult.error}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`票据"${ticket.title}"上传异常: ${error}`);
      }
    }

    return result;
  }

  /**
   * 从云端同步数据到本地（双向同步的下载部分）
   * 下载云端独有的票据到本地
   */
  async syncFromCloud(token: string): Promise<{
    downloaded: number;
    skipped: number;
    errors: string[];
  }> {
    await this.ensureInitialized();

    const result = { downloaded: 0, skipped: 0, errors: [] as string[] };
    
    // Web平台不需要同步到本地
    if (Platform.OS === 'web') {
      return result;
    }

    try {
      // 获取云端所有票据
      const cloudTickets = await this.fetchCloudTickets(token);

      // 获取本地已同步的云端票据ID集合
      const localTickets = await localTicketService.getTickets();
      const localCloudIds = new Set(
        localTickets.filter(t => t.cloudId).map(t => t.cloudId)
      );
      const localIds = new Set(localTickets.map(t => t.id));

      // 找出云端独有的票据
      const cloudOnlyTickets = cloudTickets.filter(t => 
        !localCloudIds.has(t.id) && !localIds.has(t.id)
      );

      for (const cloudTicket of cloudOnlyTickets) {
        try {
          // 下载云端票据到本地
          await this.downloadCloudTicketToLocal(cloudTicket, token);
          result.downloaded++;
        } catch (error) {
          result.errors.push(`票据"${cloudTicket.title}"下载失败: ${error}`);
        }
      }

      // 检查本地票据是否在云端被删除
      const cloudIds = new Set(cloudTickets.map(t => t.id));
      for (const local of localTickets) {
        if (local.cloudId && !cloudIds.has(local.cloudId)) {
          // 云端已删除，可以选择删除本地或保留
          // 这里选择保留本地数据，只清除同步标记
          result.skipped++;
        }
      }
    } catch (error) {
      result.errors.push(`同步失败: ${error}`);
    }

    return result;
  }

  /**
   * 双向同步：先上传本地数据，再下载云端数据
   */
  async bidirectionalSync(token: string): Promise<{
    uploaded: number;
    downloaded: number;
    uploadFailed: number;
    downloadErrors: string[];
  }> {
    await this.ensureInitialized();

    // 1. 上传本地未同步的票据
    const uploadResult = await this.syncToCloud(token);
    
    // 2. 下载云端独有的票据
    const downloadResult = await this.syncFromCloud(token);

    return {
      uploaded: uploadResult.success,
      uploadFailed: uploadResult.failed,
      downloaded: downloadResult.downloaded,
      downloadErrors: downloadResult.errors,
    };
  }

  /**
   * 下载云端票据到本地
   */
  private async downloadCloudTicketToLocal(cloudTicket: CloudTicket, token: string): Promise<void> {
    const ticketId = cloudTicket.id;
    const now = new Date().toISOString();

    // 创建票据目录
    const ticketDir = `${localTicketService.getBaseDir()}/tickets/${ticketId}`;
    const imagesDir = `${ticketDir}/images`;
    await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });

    // 下载图片
    const images: LocalImage[] = [];
    for (let i = 0; i < cloudTicket.images.length; i++) {
      const cloudImage = cloudTicket.images[i];
      const fileName = `original_${i}.jpg`;
      const localPath = `images/${fileName}`;
      const destPath = `${ticketDir}/${localPath}`;

      try {
        // 下载图片
        const response = await fetch(cloudImage.url);
        const blob = await response.blob();
        const base64 = await this.blobToBase64(blob);
        const base64Data = base64.split(',')[1] || base64;

        await FileSystem.writeAsStringAsync(destPath, base64Data, {
          encoding: EncodingType.Base64,
        });

        images.push({
          id: cloudImage.id,
          fileName,
          localPath,
          sortOrder: cloudImage.sortOrder,
          cloudUrl: cloudImage.url,
          cloudThumbnailUrl: cloudImage.thumbnailUrl,
        });
      } catch (error) {
        console.error(`下载图片失败: ${cloudImage.url}`, error);
      }
    }

    // 创建本地票据数据
    const localTicket: LocalTicket = {
      id: ticketId,
      title: cloudTicket.title,
      summary: cloudTicket.summary,
      ocrText: cloudTicket.ocrText || undefined,
      collectionId: cloudTicket.collectionId || undefined,
      collectionName: cloudTicket.collection?.name,
      location: cloudTicket.location || undefined,
      notes: cloudTicket.notes || undefined,
      ticketDate: cloudTicket.ticketDate || undefined,
      expiryDate: cloudTicket.expiryDate || undefined,
      isPrivate: cloudTicket.isPrivate,
      tags: cloudTicket.tags.map(t => t.name),
      images,
      isCloudSynced: true,
      cloudId: cloudTicket.id,
      createdAt: cloudTicket.createdAt,
      updatedAt: cloudTicket.updatedAt || cloudTicket.createdAt,
      localPath: ticketDir,
    };

    // 保存票据元数据
    const metaPath = `${ticketDir}/meta.json`;
    await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(localTicket, null, 2));

    // 更新索引
    const index = await localTicketService.getTicketIndex();
    const indexItem: TicketIndexItem = {
      id: localTicket.id,
      title: localTicket.title,
      ticketDate: localTicket.ticketDate || null,
      createdAt: localTicket.createdAt,
      updatedAt: localTicket.updatedAt,
      isCloudSynced: true,
      isPrivate: localTicket.isPrivate,
      cloudId: localTicket.cloudId,
      thumbnailPath: localTicket.images[0]?.localPath,
      imageCount: localTicket.images.length,
    };
    index.tickets.unshift(indexItem);
    await localTicketService.updateTicketIndex(index);
  }

  /**
   * Blob 转 Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 获取待同步票据数量（未同步到云端的本地票据）
   */
  async getPendingSyncCount(): Promise<number> {
    await this.ensureInitialized();
    const tickets = await localTicketService.getTickets();
    return tickets.filter(t => !t.isCloudSynced).length;
  }

  /**
   * 获取可同步票据数量（排除私密票据）
   */
  async getSyncableCount(): Promise<number> {
    await this.ensureInitialized();
    const tickets = await localTicketService.getTickets();
    let count = 0;
    for (const item of tickets) {
      if (item.isCloudSynced) continue;
      const ticket = await localTicketService.getTicket(item.id);
      if (ticket && this.shouldSyncToCloud(ticket.isPrivate)) {
        count++;
      }
    }
    return count;
  }

  // ==================== 图片路径获取 ====================

  /**
   * 获取票据图片URI
   */
  getTicketImageUri(ticketId: string, imagePath: string): string {
    return localTicketService.getTicketImageUri(ticketId, imagePath);
  }

  // ==================== 统计信息 ====================

  /**
   * 获取存储统计
   */
  async getStorageStats(): Promise<{
    ticketCount: number;
    totalImages: number;
    pendingSync: number;
  }> {
    await this.ensureInitialized();
    
    const localStats = await localTicketService.getStorageStats();
    const pendingSync = await this.getPendingSyncCount();

    return {
      ...localStats,
      pendingSync,
    };
  }
}

// 导出单例
export const unifiedStorageService = new UnifiedStorageService();
