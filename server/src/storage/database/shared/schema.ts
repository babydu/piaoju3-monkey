import { pgTable, serial, timestamp, varchar, text, boolean, integer, jsonb, index, numeric, bigint } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// 会员套餐类型
export type MemberLevel = 'free' | 'pro' | 'trial'
export type SubscriptionType = 'monthly' | 'yearly' | 'lifetime'

// 用户表
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    memberLevel: varchar("member_level", { length: 20 }).default("free").notNull(), // free | pro | trial
    memberExpiredAt: timestamp("member_expired_at", { withTimezone: true }), // 会员过期时间
    storageUsed: bigint("storage_used", { mode: "number" }).default(0).notNull(), // 已用存储量（字节）
    storageLimit: bigint("storage_limit", { mode: "number" }).default(1073741824).notNull(), // 存储限制（字节，默认1GB）
    ticketCount: integer("ticket_count").default(0).notNull(), // 已创建票据数量
    ticketLimit: integer("ticket_limit").default(100).notNull(), // 票据数量限制
    ocrCount: integer("ocr_count").default(0).notNull(), // 本月OCR使用次数
    ocrLimit: integer("ocr_limit").default(50).notNull(), // 每月OCR限制
    ocrResetAt: timestamp("ocr_reset_at", { withTimezone: true }), // OCR计数重置时间
    trialUsed: boolean("trial_used").default(false).notNull(), // 是否已使用试用
    privacyPassword: varchar("privacy_password", { length: 255 }), // 隐私箱密码（加密存储）
    passwordHint: varchar("password_hint", { length: 100 }), // 密码提示语
    biometricEnabled: boolean("biometric_enabled").default(false).notNull(), // 是否启用生物识别
    preferences: jsonb("preferences").$type<{
      ocrMode?: "local" | "cloud" | "cloud-first"
      cloudBackup?: boolean
      cloudOcrEnabled?: boolean
      allowPrivateCloudStorage?: boolean
      aiServiceEnabled?: boolean
      theme?: string
      cloudProvider?: string
    }>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_phone_idx").on(table.phone),
    index("users_member_level_idx").on(table.memberLevel),
  ]
);

// 合集表
export const collections = pgTable(
  "collections",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("collections_user_id_idx").on(table.userId),
  ]
);

// 标签表
export const tags = pgTable(
  "tags",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 50 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tags_user_id_idx").on(table.userId),
    index("tags_name_idx").on(table.name),
  ]
);

// 票据表
export const tickets = pgTable(
  "tickets",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 200 }),
    summary: text("summary"), // AI生成的票据简介
    ocrText: text("ocr_text"),
    collectionId: varchar("collection_id", { length: 36 }).references(() => collections.id, { onDelete: "set null" }),
    location: varchar("location", { length: 200 }),
    ticketDate: varchar("ticket_date", { length: 20 }), // 票据日期
    expiryDate: varchar("expiry_date", { length: 20 }), // 到期日期
    notes: text("notes"),
    expirationReminder: timestamp("expiration_reminder", { withTimezone: true }),
    isPrivate: boolean("is_private").default(false).notNull(),
    deviceId: varchar("device_id", { length: 100 }), // 创建设备ID（用于本地存储模式）
    isCloudSynced: boolean("is_cloud_synced").default(true).notNull(), // 是否已同步到云端
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("tickets_user_id_idx").on(table.userId),
    index("tickets_collection_id_idx").on(table.collectionId),
    index("tickets_created_at_idx").on(table.createdAt),
    index("tickets_ticket_date_idx").on(table.ticketDate),
    index("tickets_device_id_idx").on(table.deviceId),
  ]
);

// 票据标签关联表
export const ticketTags = pgTable(
  "ticket_tags",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ticketId: varchar("ticket_id", { length: 36 }).notNull().references(() => tickets.id, { onDelete: "cascade" }),
    tagId: varchar("tag_id", { length: 36 }).notNull().references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ticket_tags_ticket_id_idx").on(table.ticketId),
    index("ticket_tags_tag_id_idx").on(table.tagId),
  ]
);

// 图片表
export const images = pgTable(
  "images",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ticketId: varchar("ticket_id", { length: 36 }).notNull().references(() => tickets.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("images_ticket_id_idx").on(table.ticketId),
  ]
);

// 回收站表
export const recycleBin = pgTable(
  "recycle_bin",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ticketId: varchar("ticket_id", { length: 36 }).notNull().references(() => tickets.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("recycle_bin_user_id_idx").on(table.userId),
    index("recycle_bin_deleted_at_idx").on(table.deletedAt),
  ]
);

// 会员订阅记录表
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(), // monthly | yearly | lifetime
    status: varchar("status", { length: 20 }).default("active").notNull(), // active | expired | cancelled
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_status_idx").on(table.status),
  ]
);

// 云存储配置表
export const cloudStorageConfigs = pgTable(
  "cloud_storage_configs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // webdav | onedrive | dropbox | s3
    config: jsonb("config").$type<{
      server?: string
      username?: string
      password?: string // 加密存储
      accessToken?: string // 加密存储
      refreshToken?: string
      bucketName?: string
      region?: string
    }>().notNull(),
    isEnabled: boolean("is_enabled").default(false).notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("cloud_storage_user_id_idx").on(table.userId),
  ]
);

// OCR服务配置表（管理员配置）
export const ocrServiceConfigs = pgTable(
  "ocr_service_configs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 50 }).notNull(), // baidu | tencent | local
    displayName: varchar("display_name", { length: 100 }).notNull(),
    apiUrl: varchar("api_url", { length: 500 }),
    apiKey: varchar("api_key", { length: 255 }), // 加密存储
    apiSecret: varchar("api_secret", { length: 255 }), // 加密存储
    weight: integer("weight").default(0).notNull(), // 权重，用于负载均衡
    isEnabled: boolean("is_enabled").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    config: jsonb("config").$type<{
      dailyLimit?: number
      pricePerCall?: number
      supportedLanguages?: string[]
    }>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("ocr_service_name_idx").on(table.name),
  ]
);

// 主题皮肤表
export const themes = pgTable(
  "themes",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 50 }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    preview: text("preview"), // 预览图URL
    config: jsonb("config").$type<{
      primary: string
      background: string
      text: string
      card: string
      border: string
      accent?: string
    }>().notNull(),
    isPro: boolean("is_pro").default(false).notNull(), // 是否专业版专属
    isDefault: boolean("is_default").default(false).notNull(),
    downloadCount: integer("download_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("themes_name_idx").on(table.name),
  ]
);

// 使用统计表（月度统计）
export const usageStats = pgTable(
  "usage_stats",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
    ocrCount: integer("ocr_count").default(0).notNull(),
    ticketCount: integer("ticket_count").default(0).notNull(),
    storageBytes: integer("storage_bytes").default(0).notNull(),
    exportCount: integer("export_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("usage_stats_user_id_idx").on(table.userId),
    index("usage_stats_month_idx").on(table.month),
  ]
);

// 系统健康检查表
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// Zod schemas for validation
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// 用户相关
export const insertUserSchema = createCoercedInsertSchema(users).pick({
  phone: true,
});

export const updateUserSchema = createCoercedInsertSchema(users)
  .pick({
    memberLevel: true,
    storageUsed: true,
    preferences: true,
    privacyPassword: true,
    biometricEnabled: true,
    memberExpiredAt: true,
    ticketCount: true,
    ocrCount: true,
  })
  .partial();

// 标签相关
export const insertTagSchema = createCoercedInsertSchema(tags).pick({
  name: true,
  userId: true,
});

// 合集相关
export const insertCollectionSchema = createCoercedInsertSchema(collections).pick({
  name: true,
  userId: true,
});

// 票据相关
export const insertTicketSchema = createCoercedInsertSchema(tickets).pick({
  title: true,
  summary: true,
  ocrText: true,
  collectionId: true,
  location: true,
  notes: true,
  expirationReminder: true,
  isPrivate: true,
  deviceId: true,
  isCloudSynced: true,
  userId: true,
});

export const updateTicketSchema = createCoercedInsertSchema(tickets)
  .pick({
    title: true,
    summary: true,
    ocrText: true,
    collectionId: true,
    location: true,
    notes: true,
    expirationReminder: true,
    isPrivate: true,
    deviceId: true,
    isCloudSynced: true,
  })
  .partial();

// 图片相关
export const insertImageSchema = createCoercedInsertSchema(images).pick({
  ticketId: true,
  url: true,
  thumbnailUrl: true,
  sortOrder: true,
});

// 回收站相关
export const insertRecycleBinSchema = createCoercedInsertSchema(recycleBin).pick({
  ticketId: true,
  userId: true,
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type UpdateTicket = z.infer<typeof updateTicketSchema>;

export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;

export type RecycleBin = typeof recycleBin.$inferSelect;
export type InsertRecycleBin = z.infer<typeof insertRecycleBinSchema>;

