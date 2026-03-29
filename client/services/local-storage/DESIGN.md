# 本地存储架构设计

## 一、设计原则

1. **本地优先**：默认所有数据存储在本地，云端存储为可选功能
2. **结构化存储**：使用文件夹+JSON的方式，便于用户备份和迁移
3. **数据兼容**：本地数据结构与云端数据结构保持一致，便于同步
4. **增量同步**：云端存储启用后，支持增量同步，避免重复上传

## 二、目录结构设计

```
TicketManager/                          # 根目录（应用专属文档目录）
├── tickets/                            # 票据数据目录
│   ├── index.json                      # 票据索引（快速查询用）
│   ├── {ticket_id_1}/                  # 单个票据目录
│   │   ├── meta.json                   # 票据元数据
│   │   └── images/                     # 票据图片
│   │       ├── original_0.jpg          # 原图
│   │       ├── original_1.jpg
│   │       └── thumbnail_0.jpg         # 缩略图
│   ├── {ticket_id_2}/
│   │   ├── meta.json
│   │   └── images/
│   │       └── ...
│   └── ...
├── collections.json                    # 合集数据
├── tags.json                           # 标签数据
├── settings.json                       # 用户设置
└── sync_status.json                    # 同步状态记录
```

## 三、数据结构定义

### 3.1 票据索引 (tickets/index.json)

```typescript
interface TicketIndex {
  tickets: TicketIndexItem[];
  lastUpdated: string; // ISO时间戳
  version: number;     // 数据版本号
}

interface TicketIndexItem {
  id: string;           // 票据ID
  title: string;
  ticketDate: string | null;
  createdAt: string;
  updatedAt: string;
  isCloudSynced: boolean;  // 是否已同步到云端
  cloudId?: string;        // 云端票据ID（同步后更新）
  thumbnailPath?: string;  // 本地缩略图相对路径
}
```

### 3.2 票据元数据 (tickets/{id}/meta.json)

```typescript
interface LocalTicket {
  id: string;
  title: string;
  summary?: string;
  ocrText?: string;
  collectionId?: string;
  location?: string;
  ticketDate?: string;     // YYYY-MM-DD
  expiryDate?: string;
  notes?: string;
  isPrivate: boolean;
  createdAt: string;       // ISO时间戳
  updatedAt: string;
  
  // 图片信息（本地路径）
  images: LocalImage[];
  
  // 标签
  tags: string[];          // 标签名称数组
  
  // 合集
  collection?: string;     // 合集名称
  
  // 同步状态
  isCloudSynced: boolean;
  cloudId?: string;
  lastSyncAt?: string;
}

interface LocalImage {
  id: string;
  localPath: string;       // 相对于票据目录的路径
  thumbnailPath?: string;
  sortOrder: number;
  cloudUrl?: string;       // 同步后的云端URL
}
```

### 3.3 合集数据 (collections.json)

```typescript
interface LocalCollections {
  collections: LocalCollection[];
  lastUpdated: string;
}

interface LocalCollection {
  id: string;
  name: string;
  createdAt: string;
  isCloudSynced: boolean;
  cloudId?: string;
}
```

### 3.4 标签数据 (tags.json)

```typescript
interface LocalTags {
  tags: LocalTag[];
  lastUpdated: string;
}

interface LocalTag {
  id: string;
  name: string;
  count: number;           // 使用次数
  isCloudSynced: boolean;
  cloudId?: string;
}
```

### 3.5 同步状态 (sync_status.json)

```typescript
interface SyncStatus {
  lastSyncAt?: string;
  pendingUploads: string[];    // 待上传的票据ID列表
  pendingUpdates: string[];    // 待更新的票据ID列表
  pendingDeletes: string[];    // 待删除的票据ID列表（云端）
}
```

## 四、存储模式

### 4.1 存储模式类型

```typescript
type StorageMode = 'local-only' | 'cloud-first' | 'hybrid';

// local-only: 仅本地存储，不使用云端
// cloud-first: 云端优先，但本地保留副本
// hybrid: 本地优先，云端作为备份（默认）
```

### 4.2 模式切换逻辑

```
初始状态: hybrid（本地优先，云端备份可选）

用户操作:
1. 启用云端备份 → 从hybrid切换到cloud-first，开始同步本地数据
2. 禁用云端备份 → 从cloud-first切换到local-only，保留本地数据
3. 关闭云端备份同时保留数据 → 从hybrid切换到local-only
```

## 五、核心服务设计

### 5.1 LocalTicketService（本地票据服务）

职责：
- 管理本地文件系统中的票据数据
- 提供CRUD接口
- 维护索引文件

### 5.2 UnifiedStorageService（统一存储服务）

职责：
- 根据用户设置选择存储后端
- 处理本地与云端的同步逻辑
- 提供统一的数据访问接口

### 5.3 SyncService（同步服务）

职责：
- 检测本地与云端数据差异
- 执行增量同步
- 处理冲突

## 六、同步策略

### 6.1 新建票据流程

```
1. 用户创建票据
2. 保存到本地（Always）
3. 检查云端备份设置
   - 已启用 → 上传到云端，记录cloudId
   - 未启用 → 仅保存本地
4. 更新索引
```

### 6.2 读取票据列表流程

```
1. 从本地索引读取票据列表
2. 如果启用云端备份，合并云端数据
3. 去重（本地有cloudId的票据与云端票据合并）
4. 返回合并后的列表
```

### 6.3 同步触发时机

- 用户手动触发同步
- 应用启动时（如果启用云端备份）
- 网络恢复时
- 创建/更新票据后

## 七、兼容性考虑

### 7.1 与现有云端数据结构的兼容

本地数据字段映射到云端：
- `LocalTicket.id` → `Ticket.id` (UUID)
- `LocalTicket.images[].localPath` → `Image.url` (云端存储时转换)
- `LocalTicket.tags` → `TicketTag[]` (云端关联表)

### 7.2 数据迁移

首次启用云端备份时：
1. 扫描本地所有票据
2. 上传未同步的票据
3. 记录云端返回的ID
4. 更新本地索引

## 八、错误处理

- 本地存储失败：提示用户检查存储空间
- 云端同步失败：保存到待同步队列，稍后重试
- 冲突处理：本地优先（用户可手动选择）
