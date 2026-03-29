/**
 * 本地票据存储服务
 * 负责管理本地文件系统中的票据数据
 */

import { Platform } from 'react-native';
// 使用legacy模块进行文件操作
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

// documentDirectory 需要从 FileSystem 获取
const getBaseDirectory = (): string => {
  // Web平台暂不支持本地文件存储
  if (Platform.OS === 'web') {
    // 返回一个占位路径，Web平台会使用localStorage或IndexedDB
    console.warn('Web平台暂不支持本地文件存储，数据将仅保存在云端');
    return '/web-placeholder';
  }
  
  // @ts-ignore - documentDirectory 存在于 legacy 模块中
  const docDir = FileSystem.documentDirectory;
  if (!docDir) {
    throw new Error('无法获取文档目录');
  }
  // 移除尾部斜杠，在拼接时统一添加
  return docDir.endsWith('/') ? docDir.slice(0, -1) : docDir;
};
import {
  TicketIndex,
  TicketIndexItem,
  LocalTicket,
  LocalImage,
  LocalCollectionsData,
  LocalCollection,
  LocalTagsData,
  LocalTag,
  LocalSettings,
  SyncStatus,
  DEFAULT_TICKET_INDEX,
  DEFAULT_COLLECTIONS_DATA,
  DEFAULT_TAGS_DATA,
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_SYNC_STATUS,
} from './types';

// 存储目录常量
const BASE_DIR = 'TicketManager';
const TICKETS_DIR = 'tickets';
const IMAGES_DIR = 'images';

// 文件名常量
const INDEX_FILE = 'index.json';
const META_FILE = 'meta.json';
const COLLECTIONS_FILE = 'collections.json';
const TAGS_FILE = 'tags.json';
const SETTINGS_FILE = 'settings.json';
const SYNC_STATUS_FILE = 'sync_status.json';

/**
 * 本地票据存储服务类
 */
export class LocalTicketService {
  private baseDir: string;
  private initialized: boolean = false;

  constructor() {
    // 使用应用的文档目录，确保路径正确拼接
    // getBaseDirectory() 返回不带尾部斜杠的路径，如 file:///data/.../files
    // BASE_DIR 是 TicketManager，所以需要添加斜杠
    this.baseDir = `${getBaseDirectory()}/${BASE_DIR}`;
  }

  /**
   * 初始化存储目录结构
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Web平台跳过本地存储初始化
    if (Platform.OS === 'web') {
      console.warn('Web平台跳过本地存储初始化');
      this.initialized = true;
      return;
    }

    try {
      // 创建基础目录
      const baseDirInfo = await FileSystem.getInfoAsync(this.baseDir);
      if (!baseDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.baseDir, { intermediates: true });
      }

      // 创建票据目录
      const ticketsDir = `${this.baseDir}/${TICKETS_DIR}`;
      const ticketsDirInfo = await FileSystem.getInfoAsync(ticketsDir);
      if (!ticketsDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(ticketsDir, { intermediates: true });
      }

      // 初始化索引文件
      await this.initIndexFile();

      // 初始化合集文件
      await this.initCollectionsFile();

      // 初始化标签文件
      await this.initTagsFile();

      // 初始化设置文件
      await this.initSettingsFile();

      // 初始化同步状态文件
      await this.initSyncStatusFile();

      this.initialized = true;
    } catch (error) {
      console.error('[LocalStorage] 初始化失败:', error);
      throw error;
    }
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
   * 获取基础目录路径
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  // ==================== 文件操作辅助方法 ====================

  /**
   * 读取JSON文件
   */
  private async readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return defaultValue;
      }
      const content = await FileSystem.readAsStringAsync(filePath);
      return JSON.parse(content);
    } catch (error) {
      console.error(`[LocalStorage] 读取文件失败 ${filePath}:`, error);
      return defaultValue;
    }
  }

  /**
   * 写入JSON文件
   */
  private async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    try {
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`[LocalStorage] 写入文件失败 ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 初始化索引文件
   */
  private async initIndexFile(): Promise<void> {
    const indexPath = `${this.baseDir}/${TICKETS_DIR}/${INDEX_FILE}`;
    const fileInfo = await FileSystem.getInfoAsync(indexPath);
    if (!fileInfo.exists) {
      await this.writeJsonFile(indexPath, DEFAULT_TICKET_INDEX);
    }
  }

  /**
   * 初始化合集文件
   */
  private async initCollectionsFile(): Promise<void> {
    const collectionsPath = `${this.baseDir}/${COLLECTIONS_FILE}`;
    const fileInfo = await FileSystem.getInfoAsync(collectionsPath);
    if (!fileInfo.exists) {
      await this.writeJsonFile(collectionsPath, DEFAULT_COLLECTIONS_DATA);
    }
  }

  /**
   * 初始化标签文件
   */
  private async initTagsFile(): Promise<void> {
    const tagsPath = `${this.baseDir}/${TAGS_FILE}`;
    const fileInfo = await FileSystem.getInfoAsync(tagsPath);
    if (!fileInfo.exists) {
      await this.writeJsonFile(tagsPath, DEFAULT_TAGS_DATA);
    }
  }

  /**
   * 初始化设置文件
   */
  private async initSettingsFile(): Promise<void> {
    const settingsPath = `${this.baseDir}/${SETTINGS_FILE}`;
    const fileInfo = await FileSystem.getInfoAsync(settingsPath);
    if (!fileInfo.exists) {
      await this.writeJsonFile(settingsPath, DEFAULT_LOCAL_SETTINGS);
    }
  }

  /**
   * 初始化同步状态文件
   */
  private async initSyncStatusFile(): Promise<void> {
    const syncStatusPath = `${this.baseDir}/${SYNC_STATUS_FILE}`;
    const fileInfo = await FileSystem.getInfoAsync(syncStatusPath);
    if (!fileInfo.exists) {
      await this.writeJsonFile(syncStatusPath, DEFAULT_SYNC_STATUS);
    }
  }

  // ==================== 票据索引操作 ====================

  /**
   * 获取票据索引
   */
  async getTicketIndex(): Promise<TicketIndex> {
    await this.ensureInitialized();
    const indexPath = `${this.baseDir}/${TICKETS_DIR}/${INDEX_FILE}`;
    return this.readJsonFile<TicketIndex>(indexPath, DEFAULT_TICKET_INDEX);
  }

  /**
   * 更新票据索引
   */
  async updateTicketIndex(index: TicketIndex): Promise<void> {
    const indexPath = `${this.baseDir}/${TICKETS_DIR}/${INDEX_FILE}`;
    index.lastUpdated = new Date().toISOString();
    await this.writeJsonFile(indexPath, index);
  }

  /**
   * 增量恢复时添加/更新票据索引项
   * 用于备份恢复，不会覆盖较新的本地数据
   */
  async addToIndexAfterRestore(item: TicketIndexItem): Promise<void> {
    const index = await this.getTicketIndex();
    
    // 检查是否已存在
    const existingIndex = index.tickets.findIndex(t => t.id === item.id);
    
    if (existingIndex >= 0) {
      // 已存在，比较更新时间
      const existing = index.tickets[existingIndex];
      const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
      const newItemTime = new Date(item.updatedAt || item.createdAt).getTime();
      
      // 只有当新数据更新时才替换
      if (newItemTime > existingTime) {
        index.tickets[existingIndex] = item;
        await this.updateTicketIndex(index);
      }
    } else {
      // 不存在，添加到最前面
      index.tickets.unshift(item);
      await this.updateTicketIndex(index);
    }
  }

  /**
   * 添加票据到索引
   */
  private async addToIndex(ticket: LocalTicket): Promise<void> {
    const index = await this.getTicketIndex();
    
    // 缩略图路径：优先使用 thumbnailPath，否则使用 localPath
    const thumbnailPath = ticket.images[0]?.thumbnailPath || ticket.images[0]?.localPath;
    
    const indexItem: TicketIndexItem = {
      id: ticket.id,
      title: ticket.title,
      ticketDate: ticket.ticketDate || null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      isCloudSynced: ticket.isCloudSynced,
      isPrivate: ticket.isPrivate,
      cloudId: ticket.cloudId,
      thumbnailPath,
      imageCount: ticket.images.length,
    };

    // 检查是否已存在
    const existingIndex = index.tickets.findIndex(t => t.id === ticket.id);
    if (existingIndex >= 0) {
      index.tickets[existingIndex] = indexItem;
    } else {
      index.tickets.unshift(indexItem); // 新票据放在最前面
    }

    await this.updateTicketIndex(index);
  }

  /**
   * 从索引中移除票据
   */
  private async removeFromIndex(ticketId: string): Promise<void> {
    const index = await this.getTicketIndex();
    index.tickets = index.tickets.filter(t => t.id !== ticketId);
    await this.updateTicketIndex(index);
  }

  // ==================== 票据CRUD操作 ====================

  /**
   * 创建票据
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
    imageUris: string[]
  ): Promise<LocalTicket> {
    await this.ensureInitialized();

    const ticketId = Crypto.randomUUID();
    const now = new Date().toISOString();

    // 创建票据目录
    const ticketDir = `${this.baseDir}/${TICKETS_DIR}/${ticketId}`;
    const imagesDir = `${ticketDir}/${IMAGES_DIR}`;
    await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });

    // 复制图片到票据目录
    const images: LocalImage[] = [];
    for (let i = 0; i < imageUris.length; i++) {
      const imageUri = imageUris[i];
      const ext = this.getFileExtension(imageUri) || 'jpg';
      const fileName = `original_${i}.${ext}`;
      const localPath = `${IMAGES_DIR}/${fileName}`;
      const destPath = `${ticketDir}/${localPath}`;
      
      try {
        // 复制图片文件
        await FileSystem.copyAsync({ from: imageUri, to: destPath });
        
        // 验证复制结果
        const destInfo = await FileSystem.getInfoAsync(destPath);
        if (!destInfo.exists) {
          console.error(`[LocalStorage] 图片复制失败: ${imageUri} -> ${destPath}`);
          continue; // 跳过复制失败的图片
        }
        
        images.push({
          id: Crypto.randomUUID(),
          fileName,
          localPath,  // 相对路径: images/original_0.jpg
          sortOrder: i,
        });
      } catch (copyError) {
        console.error(`[LocalStorage] 复制图片异常: ${imageUri}`, copyError);
        // 跳过复制失败的图片
      }
    }

    // 创建票据数据
    const ticket: LocalTicket = {
      id: ticketId,
      title: data.title,
      summary: data.summary,
      ocrText: data.ocrText,
      collectionId: data.collectionId,
      collectionName: data.collectionName,
      location: data.location,
      ticketDate: data.ticketDate,
      expiryDate: data.expiryDate,
      notes: data.notes,
      isPrivate: data.isPrivate || false,
      createdAt: now,
      updatedAt: now,
      images,
      tags: data.tags || [],
      isCloudSynced: false,
      localPath: ticketDir,
    };

    // 保存票据元数据
    const metaPath = `${ticketDir}/${META_FILE}`;
    await this.writeJsonFile(metaPath, ticket);

    // 更新索引（使用第一张图片作为缩略图）
    const indexItem: TicketIndexItem = {
      id: ticket.id,
      title: ticket.title,
      ticketDate: ticket.ticketDate || null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      isCloudSynced: ticket.isCloudSynced,
      isPrivate: ticket.isPrivate,
      cloudId: ticket.cloudId,
      thumbnailPath: ticket.images[0]?.localPath,  // 使用相对路径
      imageCount: ticket.images.length,
    };
    
    const index = await this.getTicketIndex();
    index.tickets.unshift(indexItem);
    await this.updateTicketIndex(index);

    // 更新标签计数
    if (ticket.tags.length > 0) {
      await this.incrementTagCounts(ticket.tags);
    }

    return ticket;
  }

  /**
   * 获取票据详情
   */
  async getTicket(ticketId: string): Promise<LocalTicket | null> {
    await this.ensureInitialized();
    
    const ticketDir = `${this.baseDir}/${TICKETS_DIR}/${ticketId}`;
    const metaPath = `${ticketDir}/${META_FILE}`;
    
    const fileInfo = await FileSystem.getInfoAsync(metaPath);
    if (!fileInfo.exists) {
      return null;
    }

    const ticket = await this.readJsonFile<LocalTicket>(metaPath, null as any);
    if (ticket) {
      ticket.localPath = ticketDir;
    }
    return ticket;
  }

   /**
    * 获取票据列表
    */
  async getTickets(options?: {
    sortBy?: 'newest' | 'oldest';
    tagFilter?: string;
    collectionFilter?: string;
  }): Promise<TicketIndexItem[]> {
    await this.ensureInitialized();
    
    const index = await this.getTicketIndex();
    let tickets = [...index.tickets];

    // 需要过滤或修复数据时，批量读取票据数据
    const needTagFilter = options?.tagFilter;
    const needCollectionFilter = options?.collectionFilter;
    const needFixIsPrivate = tickets.some(t => t.isPrivate === undefined);
    
    // 如果需要任何过滤或修复，先批量加载票据数据
    const ticketCache = new Map<string, LocalTicket | null>();
    if (needTagFilter || needCollectionFilter || needFixIsPrivate) {
      for (const item of tickets) {
        if (needTagFilter || needCollectionFilter || item.isPrivate === undefined) {
          ticketCache.set(item.id, await this.getTicket(item.id));
        }
      }
    }

    // 标签过滤（使用缓存）
    if (needTagFilter) {
      const tagFilter = options.tagFilter!;
      const filteredIds: string[] = [];
      for (const item of tickets) {
        const ticket = ticketCache.get(item.id);
        if (ticket && ticket.tags.includes(tagFilter)) {
          filteredIds.push(item.id);
        }
      }
      tickets = tickets.filter(t => filteredIds.includes(t.id));
    }

    // 合集过滤（使用缓存）
    if (needCollectionFilter) {
      const collectionFilter = options.collectionFilter!;
      const filteredIds: string[] = [];
      for (const item of tickets) {
        const ticket = ticketCache.get(item.id);
        if (ticket && ticket.collectionId === collectionFilter) {
          filteredIds.push(item.id);
        }
      }
      tickets = tickets.filter(t => filteredIds.includes(t.id));
    }

    // 排序
    if (options?.sortBy === 'oldest') {
      tickets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // 修复：如果索引项缺少 isPrivate 字段（使用缓存）
    const needsUpdate = [];
    for (let i = 0; i < tickets.length; i++) {
      if (tickets[i].isPrivate === undefined) {
        const ticket = ticketCache.get(tickets[i].id);
        if (ticket) {
          tickets[i] = {
            ...tickets[i],
            isPrivate: ticket.isPrivate,
          };
          needsUpdate.push(ticket);
        }
      }
    }
    
    // 批量更新索引文件（避免多次写入）
    if (needsUpdate.length > 0) {
      for (const ticket of needsUpdate) {
        await this.addToIndex(ticket);
        console.log('[LocalStorage] 已修复票据索引的 isPrivate 字段:', ticket.id, ticket.isPrivate);
      }
    }

    return tickets;
  }

  /**
   * 更新票据
   */
  async updateTicket(
    ticketId: string,
    data: Partial<Omit<LocalTicket, 'id' | 'createdAt' | 'images'>>
  ): Promise<LocalTicket | null> {
    await this.ensureInitialized();
    
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return null;
    }

    // 更新数据
    const updatedTicket: LocalTicket = {
      ...ticket,
      ...data,
      id: ticket.id,
      createdAt: ticket.createdAt,
      images: ticket.images,
      updatedAt: new Date().toISOString(),
      isCloudSynced: false, // 更新后标记为未同步
    };

    // 保存
    const metaPath = `${this.baseDir}/${TICKETS_DIR}/${ticketId}/${META_FILE}`;
    await this.writeJsonFile(metaPath, updatedTicket);

    // 更新索引
    await this.addToIndex(updatedTicket);

    console.log('[LocalStorage] 更新票据成功:', ticketId);
    return updatedTicket;
  }

  /**
   * 删除票据
   */
  async deleteTicket(ticketId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return false;
    }

    // 删除票据目录
    const ticketDir = `${this.baseDir}/${TICKETS_DIR}/${ticketId}`;
    const fileInfo = await FileSystem.getInfoAsync(ticketDir);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(ticketDir, { idempotent: true });
    }

    // 从索引中移除
    await this.removeFromIndex(ticketId);

    // 更新标签计数
    if (ticket.tags.length > 0) {
      await this.decrementTagCounts(ticket.tags);
    }

    console.log('[LocalStorage] 删除票据成功:', ticketId);
    return true;
  }

  /**
   * 获取票据图片的完整URI
   */
  getTicketImageUri(ticketId: string, imagePath: string): string {
    // imagePath 格式: images/original_0.jpg
    // 完整路径: baseDir/tickets/ticketId/images/original_0.jpg
    const fullPath = `${this.baseDir}/${TICKETS_DIR}/${ticketId}/${imagePath}`;
    return fullPath;
  }

  /**
   * 检查票据图片是否存在
   */
  async checkImageExists(ticketId: string, imagePath: string): Promise<boolean> {
    const fullPath = `${this.baseDir}/${TICKETS_DIR}/${ticketId}/${imagePath}`;
    try {
      const info = await FileSystem.getInfoAsync(fullPath);
      if (!info.exists) {
        console.log(`[LocalStorage] 图片不存在: ${fullPath}`);
      }
      return info.exists;
    } catch (error) {
      console.error('[LocalStorage] checkImageExists error:', error, 'path:', fullPath);
      return false;
    }
  }

  /**
   * 添加图片到票据
   */
  async addImageToTicket(ticketId: string, imageUri: string): Promise<LocalImage | null> {
    await this.ensureInitialized();
    
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return null;
    }

    const imagesDir = `${this.baseDir}/${TICKETS_DIR}/${ticketId}/${IMAGES_DIR}`;
    const ext = this.getFileExtension(imageUri) || 'jpg';
    const fileName = `original_${ticket.images.length}.${ext}`;
    const destPath = `${imagesDir}/${fileName}`;

    // 复制图片
    await FileSystem.copyAsync({ from: imageUri, to: destPath });

    const newImage: LocalImage = {
      id: Crypto.randomUUID(),
      fileName,
      localPath: `${IMAGES_DIR}/${fileName}`,
      sortOrder: ticket.images.length,
    };

    ticket.images.push(newImage);
    ticket.updatedAt = new Date().toISOString();
    ticket.isCloudSynced = false;

    // 保存
    const metaPath = `${this.baseDir}/${TICKETS_DIR}/${ticketId}/${META_FILE}`;
    await this.writeJsonFile(metaPath, ticket);

    // 更新索引
    await this.addToIndex(ticket);

    return newImage;
  }

  /**
   * 从票据中删除图片
   */
  async removeImageFromTicket(ticketId: string, imageId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return false;
    }

    const imageIndex = ticket.images.findIndex(img => img.id === imageId);
    if (imageIndex < 0) {
      return false;
    }

    const image = ticket.images[imageIndex];
    
    // 删除图片文件
    const imagePath = `${this.baseDir}/${TICKETS_DIR}/${ticketId}/${image.localPath}`;
    const fileInfo = await FileSystem.getInfoAsync(imagePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(imagePath, { idempotent: true });
    }

    // 删除缩略图（如果有）
    if (image.thumbnailPath) {
      const thumbPath = `${this.baseDir}/${TICKETS_DIR}/${ticketId}/${image.thumbnailPath}`;
      const thumbInfo = await FileSystem.getInfoAsync(thumbPath);
      if (thumbInfo.exists) {
        await FileSystem.deleteAsync(thumbPath, { idempotent: true });
      }
    }

    // 更新票据
    ticket.images.splice(imageIndex, 1);
    ticket.images.forEach((img, idx) => { img.sortOrder = idx; });
    ticket.updatedAt = new Date().toISOString();
    ticket.isCloudSynced = false;

    // 保存
    const metaPath = `${this.baseDir}/${TICKETS_DIR}/${ticketId}/${META_FILE}`;
    await this.writeJsonFile(metaPath, ticket);

    // 更新索引
    await this.addToIndex(ticket);

    return true;
  }

  // ==================== 合集操作 ====================

  /**
   * 获取所有合集
   */
  async getCollections(): Promise<LocalCollection[]> {
    await this.ensureInitialized();
    const collectionsPath = `${this.baseDir}/${COLLECTIONS_FILE}`;
    const data = await this.readJsonFile<LocalCollectionsData>(collectionsPath, DEFAULT_COLLECTIONS_DATA);
    return data.collections;
  }

  /**
   * 创建合集
   */
  async createCollection(name: string): Promise<LocalCollection> {
    await this.ensureInitialized();
    
    const collectionsPath = `${this.baseDir}/${COLLECTIONS_FILE}`;
    const data = await this.readJsonFile<LocalCollectionsData>(collectionsPath, DEFAULT_COLLECTIONS_DATA);

    const collection: LocalCollection = {
      id: Crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      isCloudSynced: false,
    };

    data.collections.push(collection);
    data.lastUpdated = new Date().toISOString();
    await this.writeJsonFile(collectionsPath, data);

    return collection;
  }

  /**
   * 更新合集
   */
  async updateCollection(collectionId: string, name: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const collectionsPath = `${this.baseDir}/${COLLECTIONS_FILE}`;
    const data = await this.readJsonFile<LocalCollectionsData>(collectionsPath, DEFAULT_COLLECTIONS_DATA);

    const collection = data.collections.find(c => c.id === collectionId);
    if (!collection) {
      return false;
    }

    collection.name = name;
    collection.isCloudSynced = false;
    data.lastUpdated = new Date().toISOString();
    await this.writeJsonFile(collectionsPath, data);

    return true;
  }

  /**
   * 删除合集
   */
  async deleteCollection(collectionId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const collectionsPath = `${this.baseDir}/${COLLECTIONS_FILE}`;
    const data = await this.readJsonFile<LocalCollectionsData>(collectionsPath, DEFAULT_COLLECTIONS_DATA);

    const index = data.collections.findIndex(c => c.id === collectionId);
    if (index < 0) {
      return false;
    }

    data.collections.splice(index, 1);
    data.lastUpdated = new Date().toISOString();
    await this.writeJsonFile(collectionsPath, data);

    return true;
  }

  // ==================== 标签操作 ====================

  /**
   * 获取所有标签
   */
  async getTags(): Promise<LocalTag[]> {
    await this.ensureInitialized();
    const tagsPath = `${this.baseDir}/${TAGS_FILE}`;
    const data = await this.readJsonFile<LocalTagsData>(tagsPath, DEFAULT_TAGS_DATA);
    return data.tags;
  }

  /**
   * 增加标签计数
   */
  private async incrementTagCounts(tagNames: string[]): Promise<void> {
    const tagsPath = `${this.baseDir}/${TAGS_FILE}`;
    const data = await this.readJsonFile<LocalTagsData>(tagsPath, DEFAULT_TAGS_DATA);

    for (const name of tagNames) {
      const existingTag = data.tags.find(t => t.name === name);
      if (existingTag) {
        existingTag.count += 1;
      } else {
        data.tags.push({
          id: Crypto.randomUUID(),
          name,
          count: 1,
          isCloudSynced: false,
        });
      }
    }

    data.lastUpdated = new Date().toISOString();
    await this.writeJsonFile(tagsPath, data);
  }

  /**
   * 减少标签计数
   */
  private async decrementTagCounts(tagNames: string[]): Promise<void> {
    const tagsPath = `${this.baseDir}/${TAGS_FILE}`;
    const data = await this.readJsonFile<LocalTagsData>(tagsPath, DEFAULT_TAGS_DATA);

    for (const name of tagNames) {
      const existingTag = data.tags.find(t => t.name === name);
      if (existingTag) {
        existingTag.count = Math.max(0, existingTag.count - 1);
      }
    }

    // 移除计数为0的标签
    data.tags = data.tags.filter(t => t.count > 0);
    data.lastUpdated = new Date().toISOString();
    await this.writeJsonFile(tagsPath, data);
  }

  // ==================== 设置操作 ====================

  /**
   * 获取设置
   */
  async getSettings(): Promise<LocalSettings> {
    await this.ensureInitialized();
    const settingsPath = `${this.baseDir}/${SETTINGS_FILE}`;
    const settings = await this.readJsonFile<LocalSettings>(settingsPath, DEFAULT_LOCAL_SETTINGS);
    
    // 迁移旧的存储模式到新格式（兼容旧版本的数据）
    const storageMode = (settings as any).storageMode;
    if (storageMode === 'cloud-first' || storageMode === 'hybrid') {
      settings.storageMode = 'cloud';
      await this.writeJsonFile(settingsPath, settings);
      console.log('[LocalStorage] 已迁移存储模式为: cloud');
    }
    
    return settings;
  }

  /**
   * 更新设置
   */
  async updateSettings(settings: Partial<LocalSettings>): Promise<LocalSettings> {
    await this.ensureInitialized();
    
    const settingsPath = `${this.baseDir}/${SETTINGS_FILE}`;
    const currentSettings = await this.getSettings();
    
    const updatedSettings: LocalSettings = {
      ...currentSettings,
      ...settings,
      lastUpdated: new Date().toISOString(),
    };

    await this.writeJsonFile(settingsPath, updatedSettings);
    return updatedSettings;
  }

  // ==================== 同步状态操作 ====================

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<SyncStatus> {
    await this.ensureInitialized();
    const syncStatusPath = `${this.baseDir}/${SYNC_STATUS_FILE}`;
    return this.readJsonFile<SyncStatus>(syncStatusPath, DEFAULT_SYNC_STATUS);
  }

  /**
   * 添加待上传票据
   */
  async addToPendingUpload(ticketId: string): Promise<void> {
    const syncStatusPath = `${this.baseDir}/${SYNC_STATUS_FILE}`;
    const status = await this.getSyncStatus();
    
    if (!status.pendingUploads.includes(ticketId)) {
      status.pendingUploads.push(ticketId);
      await this.writeJsonFile(syncStatusPath, status);
    }
  }

  /**
   * 从待上传列表移除
   */
  async removeFromPendingUpload(ticketId: string): Promise<void> {
    const syncStatusPath = `${this.baseDir}/${SYNC_STATUS_FILE}`;
    const status = await this.getSyncStatus();
    
    status.pendingUploads = status.pendingUploads.filter(id => id !== ticketId);
    status.lastSyncAt = new Date().toISOString();
    await this.writeJsonFile(syncStatusPath, status);
  }

  /**
   * 标记票据已同步
   */
  async markTicketSynced(ticketId: string, cloudId: string, cloudThumbnailUrl?: string): Promise<void> {
    await this.ensureInitialized();
    
    // 更新票据
    const ticket = await this.getTicket(ticketId);
    if (ticket) {
      ticket.isCloudSynced = true;
      ticket.cloudId = cloudId;
      ticket.lastSyncAt = new Date().toISOString();
      
      // 更新图片的云端URL
      if (cloudThumbnailUrl && ticket.images.length > 0) {
        ticket.images[0].cloudUrl = cloudThumbnailUrl;
        ticket.images[0].cloudThumbnailUrl = cloudThumbnailUrl;
      }
      
      const metaPath = `${this.baseDir}/${TICKETS_DIR}/${ticketId}/${META_FILE}`;
      await this.writeJsonFile(metaPath, ticket);
      
      // 更新索引（使用云端缩略图URL）
      const index = await this.getTicketIndex();
      const indexItem = index.tickets.find(t => t.id === ticketId);
      if (indexItem && cloudThumbnailUrl) {
        indexItem.thumbnailPath = cloudThumbnailUrl;
        indexItem.isCloudSynced = true;
        indexItem.cloudId = cloudId;
      }
      await this.updateTicketIndex(index);
    }

    // 从待上传列表移除
    await this.removeFromPendingUpload(ticketId);
  }

  // ==================== 搜索功能 ====================

  /**
   * 搜索票据
   */
  async searchTickets(keyword: string): Promise<TicketIndexItem[]> {
    await this.ensureInitialized();
    
    const index = await this.getTicketIndex();
    const results: TicketIndexItem[] = [];

    for (const item of index.tickets) {
      // 检查标题
      if (item.title.toLowerCase().includes(keyword.toLowerCase())) {
        results.push(item);
        continue;
      }

      // 检查完整票据数据
      const ticket = await this.getTicket(item.id);
      if (ticket) {
        const searchFields = [
          ticket.summary,
          ticket.notes,
          ticket.location,
          ticket.ocrText,
          ...ticket.tags,
        ].filter(Boolean);

        if (searchFields.some(field => 
          field!.toLowerCase().includes(keyword.toLowerCase())
        )) {
          results.push(item);
        }
      }
    }

    return results;
  }

  // ==================== 工具方法 ====================

  /**
   * 获取文件扩展名
   */
  private getFileExtension(uri: string): string | null {
    const match = uri.match(/\.(\w+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<{
    ticketCount: number;
    totalImages: number;
    estimatedSize: number;
  }> {
    await this.ensureInitialized();
    
    const index = await this.getTicketIndex();
    let totalImages = 0;

    for (const item of index.tickets) {
      const ticket = await this.getTicket(item.id);
      if (ticket) {
        totalImages += ticket.images.length;
      }
    }

    return {
      ticketCount: index.tickets.length,
      totalImages,
      estimatedSize: 0, // TODO: 计算实际大小
    };
  }

  /**
   * 导出所有数据（用于备份）
   */
  async exportAllData(): Promise<string> {
    await this.ensureInitialized();
    
    const tickets = await this.getTickets();
    const collections = await this.getCollections();
    const tags = await this.getTags();
    const settings = await this.getSettings();

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tickets: [],
      collections,
      tags,
      settings,
    };

    // 导出完整票据数据
    for (const item of tickets) {
      const ticket = await this.getTicket(item.id);
      if (ticket) {
        (exportData.tickets as any[]).push(ticket);
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 清空所有本地数据
   */
  async clearAllData(): Promise<void> {
    await this.ensureInitialized();
    
    // 删除整个基础目录
    const fileInfo = await FileSystem.getInfoAsync(this.baseDir);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(this.baseDir, { idempotent: true });
    }
    
    // 重新初始化
    this.initialized = false;
    await this.initialize();
    
    console.log('[LocalStorage] 已清空所有数据');
  }
}

// 导出单例
export const localTicketService = new LocalTicketService();
