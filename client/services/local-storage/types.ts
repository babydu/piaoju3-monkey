/**
 * 本地存储类型定义
 */

// 票据索引项
export interface TicketIndexItem {
  id: string;
  title: string;
  ticketDate: string | null;
  createdAt: string;
  updatedAt: string;
  isCloudSynced: boolean;
  isPrivate?: boolean;
  cloudId?: string;
  thumbnailPath?: string;
  imageCount: number;
}

// 票据索引
export interface TicketIndex {
  tickets: TicketIndexItem[];
  lastUpdated: string;
  version: number;
}

// 本地图片
export interface LocalImage {
  id: string;
  fileName: string;          // 文件名
  localPath: string;         // 相对于票据目录的路径
  thumbnailPath?: string;    // 缩略图相对路径
  sortOrder: number;
  cloudUrl?: string;         // 同步后的云端URL
  cloudThumbnailUrl?: string;
}

// 本地票据
export interface LocalTicket {
  id: string;
  title: string;
  summary?: string;
  ocrText?: string;
  collectionId?: string;
  collectionName?: string;   // 合集名称（便于显示）
  location?: string;
  ticketDate?: string;       // YYYY-MM-DD
  expiryDate?: string;
  notes?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  
  // 图片信息
  images: LocalImage[];
  
  // 标签
  tags: string[];
  tagIds?: string[];         // 同步后的云端标签ID
  
  // 同步状态
  isCloudSynced: boolean;
  cloudId?: string;
  lastSyncAt?: string;
  
  // 本地特有
  localPath?: string;        // 票据目录路径
}

// 本地合集
export interface LocalCollection {
  id: string;
  name: string;
  createdAt: string;
  isCloudSynced: boolean;
  cloudId?: string;
}

// 合集数据
export interface LocalCollectionsData {
  collections: LocalCollection[];
  lastUpdated: string;
  version: number;
}

// 本地标签
export interface LocalTag {
  id: string;
  name: string;
  count: number;
  isCloudSynced: boolean;
  cloudId?: string;
}

// 标签数据
export interface LocalTagsData {
  tags: LocalTag[];
  lastUpdated: string;
  version: number;
}

// 同步状态
export interface SyncStatus {
  lastSyncAt?: string;
  pendingUploads: string[];
  pendingUpdates: string[];
  pendingDeletes: string[];
  version: number;
}

// 用户设置
export interface LocalSettings {
  storageMode: 'local-only' | 'cloud';  // local-only: 仅本地, cloud: 本地+云端
  cloudBackup: boolean;
  aiServiceEnabled: boolean;
  cloudOcrEnabled: boolean;
  allowPrivateCloudStorage: boolean;
  ocrMode: 'local' | 'cloud' | 'cloud-first';
  theme?: string;
  lastUpdated: string;
  version: number;
}

// 默认设置
export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  storageMode: 'local-only',
  cloudBackup: false,
  aiServiceEnabled: true,
  cloudOcrEnabled: false,
  allowPrivateCloudStorage: false,
  ocrMode: 'local',
  lastUpdated: new Date().toISOString(),
  version: 1,
};

// 默认票据索引
export const DEFAULT_TICKET_INDEX: TicketIndex = {
  tickets: [],
  lastUpdated: new Date().toISOString(),
  version: 1,
};

// 默认合集数据
export const DEFAULT_COLLECTIONS_DATA: LocalCollectionsData = {
  collections: [],
  lastUpdated: new Date().toISOString(),
  version: 1,
};

// 默认标签数据
export const DEFAULT_TAGS_DATA: LocalTagsData = {
  tags: [],
  lastUpdated: new Date().toISOString(),
  version: 1,
};

// 默认同步状态
export const DEFAULT_SYNC_STATUS: SyncStatus = {
  pendingUploads: [],
  pendingUpdates: [],
  pendingDeletes: [],
  version: 1,
};
