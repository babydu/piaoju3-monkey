import express, { type Request, type Response } from "express";
import multer from "multer";
import { S3Storage } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "../storage/database/supabase-client.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 辅助函数：从URL中提取key
function extractKeyFromUrl(url: string): string | null {
  try {
    // 尝试从URL中提取key
    // URL格式: https://bucket.tos.cn-beijing.volces.com/path/to/file?sign=xxx
    // 或: https://coze-coding-project.tos.coze.site/coze_storage_xxx/path/to/file?sign=xxx
    const urlObj = new URL(url);
    // 移除查询参数
    const pathWithoutQuery = urlObj.pathname;
    // 移除开头的斜杠
    return pathWithoutQuery.startsWith('/') ? pathWithoutQuery.slice(1) : pathWithoutQuery;
  } catch {
    return null;
  }
}

// 辅助函数：为图片key生成签名URL
async function getSignedImageUrl(key: string): Promise<string> {
  try {
    // 如果已经是完整的URL，尝试提取key重新生成签名
    if (key.startsWith('http://') || key.startsWith('https://')) {
      const extractedKey = extractKeyFromUrl(key);
      if (extractedKey) {
        // 重新生成签名URL
        return await storage.generatePresignedUrl({
          key: extractedKey,
          expireTime: 2592000,
        });
      }
      // 无法提取key，返回原始URL
      return key;
    }
    // 生成签名URL，有效期30天
    return await storage.generatePresignedUrl({
      key,
      expireTime: 2592000,
    });
  } catch (error) {
    console.error('生成签名URL失败:', error);
    return key; // 失败时返回原始key
  }
}

// 辅助函数：批量处理图片URL
async function processImageUrls(images: any[]): Promise<any[]> {
  return Promise.all(
    images.map(async (img) => ({
      ...img,
      url: await getSignedImageUrl(img.url),
      thumbnailUrl: await getSignedImageUrl(img.thumbnail_url || img.url),
    }))
  );
}

/**
 * 上传图片（票据专用）
 * POST /api/v1/tickets/upload-image
 * Body: FormData { file: File }
 */
router.post("/upload-image", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "请选择图片" });
    }

    const { buffer, originalname, mimetype } = req.file;
    const fileName = `tickets/${userId}/${Date.now()}_${originalname}`;

    // 上传到对象存储
    const imageKey = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: mimetype,
    });

    res.json({
      success: true,
      url: imageKey,
      imageKey,
      thumbnailKey: imageKey,
    });
  } catch (error) {
    console.error("上传图片失败:", error);
    res.status(500).json({ error: "上传图片失败" });
  }
});

/**
 * 创建票据
 * POST /api/v1/tickets
 * Body: { 
 *   title, summary?, ocrText?, collectionId?, location?, ticketDate?, expiryDate?, notes?, isPrivate?, 
 *   tagIds?: string[], tagNames?: string[], 
 *   imageUrls?: string[],  // 图片key数组
 *   deviceId?: string      // 创建设备ID
 * }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { 
      title, summary, ocrText, collectionId, location, ticketDate, expiryDate, notes, isPrivate, 
      tagIds, tagNames, 
      imageUrls,
      imageKeys,
      deviceId
    } = req.body;

    const imageArray = imageUrls || imageKeys;
    
    if (!imageArray || !Array.isArray(imageArray) || imageArray.length === 0) {
      return res.status(400).json({ error: "请至少上传一张图片" });
    }

    // 日期格式验证与规范化函数
    const validateAndNormalizeDate = (dateStr: string, fieldName: string): { error?: string; date?: string } => {
      if (!dateStr) return { date: undefined };
      
      // 尝试解析多种日期格式
      const cleanStr = dateStr.trim();
      
      // ISO 格式 (YYYY-MM-DDTHH:mm:ss)
      if (/^\d{4}-\d{2}-\d{2}T/.test(cleanStr)) {
        return { date: cleanStr.split('T')[0] };
      }
      
      // YYYY-MM-DD 或 YYYY-M-D 格式
      const dashMatch = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (dashMatch) {
        const [, year, month, day] = dashMatch;
        return { date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` };
      }
      
      // YYYY/MM/DD 或 YYYY/M/D 格式
      const slashMatch = cleanStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (slashMatch) {
        const [, year, month, day] = slashMatch;
        return { date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` };
      }
      
      // 尝试 Date.parse 解析
      const parsed = Date.parse(cleanStr);
      if (!isNaN(parsed)) {
        const date = new Date(parsed);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        // 检查年份是否合理（1900-2100）
        if (year >= 1900 && year <= 2100) {
          return { date: `${year}-${month}-${day}` };
        }
      }
      
      return { error: `${fieldName}格式无效，请使用 YYYY-MM-DD 格式` };
    };

    // 验证并格式化日期
    let formattedTicketDate: string | null = null;
    let formattedExpiryDate: string | null = null;
    
    if (ticketDate) {
      const result = validateAndNormalizeDate(ticketDate, '票据日期');
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      formattedTicketDate = result.date || null;
    }
    
    if (expiryDate) {
      const result = validateAndNormalizeDate(expiryDate, '到期日期');
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      formattedExpiryDate = result.date || null;
    }

    const client = getSupabaseClient();

    // 获取用户设置，判断云端存储和私密票据云端存储设置
    const { data: userData } = await client
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    const preferences = (userData?.preferences as any) || {};
    const cloudBackup = preferences?.cloudBackup !== false; // 默认开启云端存储
    const allowPrivateCloudStorage = preferences?.allowPrivateCloudStorage !== false; // 默认允许私密票据云端存储

    // 决定是否同步到云端
    let isCloudSynced = true;
    if (!cloudBackup) {
      // 用户关闭了云端存储，票据不同步到云端
      isCloudSynced = false;
    } else if (isPrivate && !allowPrivateCloudStorage) {
      // 私密票据且不允许云端存储，票据不同步到云端
      isCloudSynced = false;
    }

    // 创建票据
    const { data: ticket, error: ticketError } = await client
      .from("tickets")
      .insert({
        title: title || null,
        summary: summary || null,
        ocr_text: ocrText || null,
        collection_id: collectionId || null,
        location: location || null,
        ticket_date: formattedTicketDate,
        expiry_date: formattedExpiryDate,
        notes: notes || null,
        is_private: isPrivate || false,
        device_id: deviceId || null,
        is_cloud_synced: isCloudSynced,
        user_id: userId,
      })
      .select()
      .single();

    if (ticketError) {
      console.error("创建票据失败:", ticketError);
      return res.status(500).json({ error: "创建票据失败" });
    }

    // 创建图片记录
    const imageRecords = imageArray.map((item: string, index: number) => ({
      ticket_id: ticket.id,
      url: item,
      thumbnail_url: item,
      sort_order: index,
    }));

    const { error: imagesError } = await client
      .from("images")
      .insert(imageRecords);

    if (imagesError) {
      console.error("创建图片记录失败:", imagesError);
    }

    // 处理标签关联
    let finalTagIds: string[] = tagIds || [];
    
    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      for (const tagName of tagNames) {
        if (!tagName || !tagName.trim()) continue;
        
        const { data: existingTag } = await client
          .from("tags")
          .select("id")
          .eq("name", tagName.trim())
          .eq("user_id", userId)
          .single();
        
        if (existingTag) {
          if (!finalTagIds.includes(existingTag.id)) {
            finalTagIds.push(existingTag.id);
          }
        } else {
          const { data: newTag, error: tagError } = await client
            .from("tags")
            .insert({
              name: tagName.trim(),
              user_id: userId,
            })
            .select()
            .single();
          
          if (!tagError && newTag) {
            finalTagIds.push(newTag.id);
          }
        }
      }
    }

    if (finalTagIds.length > 0) {
      const tagRecords = finalTagIds.map((tagId: string) => ({
        ticket_id: ticket.id,
        tag_id: tagId,
      }));

      await client.from("ticket_tags").insert(tagRecords);
    }

    res.json({
      success: true,
      ticket: {
        id: ticket.id,
        title: ticket.title,
        summary: ticket.summary,
        ocrText: ticket.ocr_text,
        collectionId: ticket.collection_id,
        location: ticket.location,
        ticketDate: ticket.ticket_date,
        expiryDate: ticket.expiry_date,
        notes: ticket.notes,
        isPrivate: ticket.is_private,
        deviceId: ticket.device_id,
        isCloudSynced: ticket.is_cloud_synced,
        createdAt: ticket.created_at,
        images: imageRecords.map((img, index) => ({
          id: `${ticket.id}_${index}`,
          url: img.url,
          thumbnailUrl: img.thumbnail_url,
          sortOrder: img.sort_order,
        })),
      },
    });
  } catch (error) {
    console.error("创建票据失败:", error);
    res.status(500).json({ error: "创建票据失败" });
  }
});

/**
 * 获取票据列表
 * GET /api/v1/tickets
 * Query: tagId?, collectionId?, sort?, deviceId?
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { tagId, collectionId, sort = 'newest', deviceId } = req.query;
    const client = getSupabaseClient();

    // 获取用户设置，判断云端存储和私密票据云端存储设置
    const { data: userData } = await client
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    const preferences = (userData?.preferences as any) || {};
    const cloudBackup = preferences?.cloudBackup !== false; // 默认开启云端存储
    const allowPrivateCloudStorage = preferences?.allowPrivateCloudStorage !== false; // 默认允许私密票据云端存储

    // 获取回收站中的票据ID列表，用于排除
    const { data: deletedTickets } = await client
      .from("recycle_bin")
      .select("ticket_id")
      .eq("user_id", userId);
    
    const deletedTicketIds = (deletedTickets || []).map((t: any) => t.ticket_id);

    let query = client
      .from("tickets")
      .select(`
        id,
        title,
        summary,
        ocr_text,
        collection_id,
        location,
        ticket_date,
        expiry_date,
        notes,
        is_private,
        device_id,
        is_cloud_synced,
        created_at,
        images (id, url, thumbnail_url, sort_order),
        tags:ticket_tags (
          tag:tags (id, name)
        ),
        collection:collections (id, name)
      `)
      .eq("user_id", userId);

    // 排除回收站中的票据
    if (deletedTicketIds.length > 0) {
      query = query.not("id", "in", `(${deletedTicketIds.join(",")})`);
    }

    // 根据云端存储设置过滤票据
    // 如果关闭了云端存储，只显示当前设备创建的票据
    if (!cloudBackup && deviceId) {
      query = query.eq("device_id", deviceId);
    }

    // 对于私密票据，如果关闭了私密票据云端存储，只显示当前设备创建的私密票据
    // 注意：这里需要在结果中过滤，因为SQL条件比较复杂

    if (sort === 'oldest') {
      query = query.order("created_at", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    if (tagId) {
      const { data: ticketIds } = await client
        .from("ticket_tags")
        .select("ticket_id")
        .eq("tag_id", tagId);
      
      if (ticketIds && ticketIds.length > 0) {
        query = query.in("id", ticketIds.map(t => t.ticket_id));
      } else {
        return res.json({ success: true, tickets: [] });
      }
    }

    if (collectionId) {
      query = query.eq("collection_id", collectionId);
    }

    const { data: tickets, error } = await query;

    if (error) {
      console.error("获取票据列表失败:", error);
      return res.status(500).json({ error: "获取票据列表失败" });
    }

    // 过滤私密票据：如果关闭了私密票据云端存储，只显示当前设备创建的私密票据
    let filteredTickets = tickets || [];
    if (!allowPrivateCloudStorage && deviceId) {
      filteredTickets = filteredTickets.filter((ticket: any) => {
        // 非私密票据直接通过
        if (!ticket.is_private) return true;
        // 私密票据只显示当前设备创建的
        return ticket.device_id === deviceId;
      });
    }

    const formattedTickets = await Promise.all(filteredTickets.map(async (ticket: any) => ({
      id: ticket.id,
      title: ticket.title,
      summary: ticket.summary,
      ocrText: ticket.ocr_text,
      collectionId: ticket.collection_id,
      location: ticket.location,
      ticketDate: ticket.ticket_date,
      expiryDate: ticket.expiry_date,
      notes: ticket.notes,
      isPrivate: ticket.is_private,
      deviceId: ticket.device_id,
      isCloudSynced: ticket.is_cloud_synced,
      createdAt: ticket.created_at,
      images: await processImageUrls(
        (ticket.images || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((img: any) => ({
            id: img.id,
            url: img.url,
            thumbnail_url: img.thumbnail_url,
            sortOrder: img.sort_order,
          }))
      ),
      tags: (ticket.tags || []).map((t: any) => ({
        id: t.tag.id,
        name: t.tag.name,
      })),
      collection: ticket.collection ? {
        id: ticket.collection[0]?.id || ticket.collection.id,
        name: ticket.collection[0]?.name || ticket.collection.name,
      } : null,
    })));

    res.json({ success: true, tickets: formattedTickets });
  } catch (error) {
    console.error("获取票据列表失败:", error);
    res.status(500).json({ error: "获取票据列表失败" });
  }
});

/**
 * 搜索票据
 * GET /api/v1/tickets/search
 * Query: keyword?, tagId?, collectionId?, sort?
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { keyword, tagId, collectionId, sort = 'relevance' } = req.query;
    const client = getSupabaseClient();

    // 获取回收站中的票据ID列表，用于排除
    const { data: deletedTickets } = await client
      .from("recycle_bin")
      .select("ticket_id")
      .eq("user_id", userId);
    
    const deletedTicketIds = (deletedTickets || []).map((t: any) => t.ticket_id);

    // 构建基础查询
    let query = client
      .from("tickets")
      .select(`
        id,
        title,
        summary,
        ocr_text,
        collection_id,
        location,
        ticket_date,
        expiry_date,
        notes,
        is_private,
        created_at,
        images (id, url, thumbnail_url, sort_order),
        tags:ticket_tags (
          tag:tags (id, name)
        ),
        collection:collections (id, name)
      `)
      .eq("user_id", userId);

    // 排除回收站中的票据
    if (deletedTicketIds.length > 0) {
      query = query.not("id", "in", `(${deletedTicketIds.join(",")})`);
    }

    // 关键词搜索（标题、OCR文本、位置、备注）
    if (keyword && typeof keyword === 'string' && keyword.trim()) {
      const searchTerm = keyword.trim();
      query = query.or(`title.ilike.%${searchTerm}%,ocr_text.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
    }

    // 标签筛选
    if (tagId && typeof tagId === 'string') {
      const { data: ticketIds } = await client
        .from("ticket_tags")
        .select("ticket_id")
        .eq("tag_id", tagId);
      
      if (ticketIds && ticketIds.length > 0) {
        query = query.in("id", ticketIds.map(t => t.ticket_id));
      } else {
        return res.json({ success: true, tickets: [] });
      }
    }

    // 合集筛选
    if (collectionId && typeof collectionId === 'string') {
      query = query.eq("collection_id", collectionId);
    }

    // 排序
    if (sort === 'newest') {
      query = query.order("created_at", { ascending: false });
    } else if (sort === 'oldest') {
      query = query.order("created_at", { ascending: true });
    } else {
      // relevance - 默认按创建时间降序
      query = query.order("created_at", { ascending: false });
    }

    const { data: tickets, error } = await query;

    if (error) {
      console.error("搜索票据失败:", error);
      return res.status(500).json({ error: "搜索票据失败" });
    }

    const formattedTickets = await Promise.all((tickets || []).map(async (ticket: any) => ({
      id: ticket.id,
      title: ticket.title,
      summary: ticket.summary,
      ocrText: ticket.ocr_text,
      collectionId: ticket.collection_id,
      location: ticket.location,
      ticketDate: ticket.ticket_date,
      expiryDate: ticket.expiry_date,
      notes: ticket.notes,
      isPrivate: ticket.is_private,
      createdAt: ticket.created_at,
      images: await processImageUrls(
        (ticket.images || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((img: any) => ({
            id: img.id,
            url: img.url,
            thumbnail_url: img.thumbnail_url,
            sortOrder: img.sort_order,
          }))
      ),
      tags: (ticket.tags || []).map((t: any) => ({
        id: t.tag.id,
        name: t.tag.name,
      })),
      collection: ticket.collection ? {
        id: ticket.collection[0]?.id || ticket.collection.id,
        name: ticket.collection[0]?.name || ticket.collection.name,
      } : null,
    })));

    res.json({ success: true, tickets: formattedTickets });
  } catch (error) {
    console.error("搜索票据失败:", error);
    res.status(500).json({ error: "搜索票据失败" });
  }
});

/**
 * 获取回收站票据列表
 * GET /api/v1/tickets/deleted
 */
router.get("/deleted", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    // 获取回收站票据，30天后自动清理
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: deletedTickets, error } = await client
      .from("recycle_bin")
      .select(`
        id,
        ticket_id,
        deleted_at,
        ticket:tickets (
          id,
          title,
          images (id, url, thumbnail_url)
        )
      `)
      .eq("user_id", userId)
      .gte("deleted_at", thirtyDaysAgo.toISOString())
      .order("deleted_at", { ascending: false });

    if (error) {
      console.error("获取回收站失败:", error);
      return res.status(500).json({ error: "获取回收站失败" });
    }

    const formattedTickets = await Promise.all((deletedTickets || []).map(async (item: any) => ({
      id: item.id,
      ticketId: item.ticket_id,
      deletedAt: item.deleted_at,
      ticket: {
        title: item.ticket?.title || null,
        images: await processImageUrls((item.ticket?.images || []).map((img: any) => ({
          id: img.id,
          url: img.url,
          thumbnail_url: img.thumbnail_url,
        }))),
      },
    })));

    res.json({ success: true, tickets: formattedTickets });
  } catch (error) {
    console.error("获取回收站失败:", error);
    res.status(500).json({ error: "获取回收站失败" });
  }
});

/**
 * 获取用户统计数据
 * GET /api/v1/tickets/stats
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    // 获取回收站中的票据ID列表
    const { data: deletedTickets } = await client
      .from("recycle_bin")
      .select("ticket_id")
      .eq("user_id", userId);
    
    const deletedTicketIds = (deletedTickets || []).map((t: any) => t.ticket_id);

    // 统计票据数量（排除回收站）
    let ticketsQuery = client
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (deletedTicketIds.length > 0) {
      ticketsQuery = ticketsQuery.not("id", "in", `(${deletedTicketIds.join(",")})`);
    }

    const { count: ticketCount } = await ticketsQuery;

    // 获取用户所有票据ID
    const { data: userTickets } = await client
      .from("tickets")
      .select("id")
      .eq("user_id", userId);
    
    const userTicketIds = (userTickets || []).map((t: any) => t.id);

    // 统计图片数量
    let imageCount = 0;
    if (userTicketIds.length > 0) {
      const { count } = await client
        .from("images")
        .select("id", { count: "exact", head: true })
        .in("ticket_id", userTicketIds);
      imageCount = count || 0;
    }

    // 统计存储空间使用量（基于图片数量估算，每张图片平均约500KB）
    const avgImageSizeKB = 500;
    const storageUsedBytes = imageCount * avgImageSizeKB * 1024;

    // 统计OCR使用次数（从票据中统计有ocr_text的）
    let ocrQuery = client
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("ocr_text", "is", null);

    if (deletedTicketIds.length > 0) {
      ocrQuery = ocrQuery.not("id", "in", `(${deletedTicketIds.join(",")})`);
    }

    const { count: ocrCount } = await ocrQuery;

    // 获取用户存储限制
    const { data: user } = await client
      .from("users")
      .select("storage_limit, member_level")
      .eq("id", userId)
      .single();

    const storageLimit = user?.storage_limit || 1073741824; // 默认1GB

    res.json({
      success: true,
      stats: {
        ticketCount: ticketCount || 0,
        imageCount: imageCount,
        ocrCount: ocrCount || 0,
        storageUsed: storageUsedBytes,
        storageLimit: storageLimit,
        memberLevel: user?.member_level || "free",
      },
    });
  } catch (error) {
    console.error("获取统计数据失败:", error);
    res.status(500).json({ error: "获取统计数据失败" });
  }
});

/**
 * 获取单个票据
 * GET /api/v1/tickets/:id
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { id } = req.params;
    const client = getSupabaseClient();

    const { data: ticket, error } = await client
      .from("tickets")
      .select(`
        id,
        title,
        summary,
        ocr_text,
        collection_id,
        location,
        ticket_date,
        expiry_date,
        notes,
        is_private,
        created_at,
        images (id, url, thumbnail_url, sort_order),
        tags:ticket_tags (
          tag:tags (id, name)
        ),
        collection:collections (id, name)
      `)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !ticket) {
      return res.status(404).json({ error: "票据不存在" });
    }

    // 处理collection字段（可能是数组或对象）
    const collectionData = ticket.collection as any;
    let collectionResult = null;
    if (collectionData) {
      if (Array.isArray(collectionData) && collectionData.length > 0) {
        collectionResult = {
          id: collectionData[0].id,
          name: collectionData[0].name,
        };
      } else if (collectionData.id) {
        collectionResult = {
          id: collectionData.id,
          name: collectionData.name,
        };
      }
    }

    // 处理图片URL
    const processedImages = await processImageUrls(
      (ticket.images || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((img: any) => ({
          id: img.id,
          url: img.url,
          thumbnail_url: img.thumbnail_url,
          sortOrder: img.sort_order,
        }))
    );

    res.json({
      success: true,
      ticket: {
        id: ticket.id,
        title: ticket.title,
        summary: ticket.summary,
        ocrText: ticket.ocr_text,
        collectionId: ticket.collection_id,
        location: ticket.location,
        ticketDate: ticket.ticket_date,
        expiryDate: ticket.expiry_date,
        notes: ticket.notes,
        isPrivate: ticket.is_private,
        createdAt: ticket.created_at,
        images: processedImages,
        tags: (ticket.tags || []).map((t: any) => ({
          id: t.tag.id,
          name: t.tag.name,
        })),
        collection: collectionResult,
      },
    });
  } catch (error) {
    console.error("获取票据详情失败:", error);
    res.status(500).json({ error: "获取票据详情失败" });
  }
});

/**
 * 更新票据
 * PUT /api/v1/tickets/:id
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { id } = req.params;
    const { title, summary, ocrText, collectionId, location, ticketDate, expiryDate, notes, isPrivate, tagIds, tagNames } = req.body;

    const client = getSupabaseClient();

    const { data: existingTicket } = await client
      .from("tickets")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!existingTicket) {
      return res.status(404).json({ error: "票据不存在" });
    }

    const { error: updateError } = await client
      .from("tickets")
      .update({
        title: title || null,
        summary: summary || null,
        ocr_text: ocrText || null,
        collection_id: collectionId || null,
        location: location || null,
        ticket_date: ticketDate || null,
        expiry_date: expiryDate || null,
        notes: notes || null,
        is_private: isPrivate || false,
      })
      .eq("id", id);

    if (updateError) {
      console.error("更新票据失败:", updateError);
      return res.status(500).json({ error: "更新票据失败" });
    }

    let finalTagIds: string[] = tagIds || [];
    
    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      for (const tagName of tagNames) {
        if (!tagName || !tagName.trim()) continue;
        
        const { data: existingTag } = await client
          .from("tags")
          .select("id")
          .eq("name", tagName.trim())
          .eq("user_id", userId)
          .single();
        
        if (existingTag) {
          if (!finalTagIds.includes(existingTag.id)) {
            finalTagIds.push(existingTag.id);
          }
        } else {
          const { data: newTag, error: tagError } = await client
            .from("tags")
            .insert({
              name: tagName.trim(),
              user_id: userId,
            })
            .select()
            .single();
          
          if (!tagError && newTag) {
            finalTagIds.push(newTag.id);
          }
        }
      }
    }

    await client.from("ticket_tags").delete().eq("ticket_id", id);

    if (finalTagIds.length > 0) {
      const tagRecords = finalTagIds.map((tagId: string) => ({
        ticket_id: id,
        tag_id: tagId,
      }));
      await client.from("ticket_tags").insert(tagRecords);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("更新票据失败:", error);
    res.status(500).json({ error: "更新票据失败" });
  }
});

/**
 * 删除票据（移入回收站）
 * DELETE /api/v1/tickets/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { id } = req.params;
    const client = getSupabaseClient();

    const { data: ticket } = await client
      .from("tickets")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!ticket) {
      return res.status(404).json({ error: "票据不存在" });
    }

    // 检查是否已在回收站
    const { data: existingRecycle } = await client
      .from("recycle_bin")
      .select("id")
      .eq("ticket_id", id)
      .single();

    if (existingRecycle) {
      return res.status(400).json({ error: "票据已在回收站中" });
    }

    // 移入回收站
    await client.from("recycle_bin").insert({
      ticket_id: id,
      user_id: userId,
    });

    res.json({ success: true, message: "票据已移入回收站" });
  } catch (error) {
    console.error("删除票据失败:", error);
    res.status(500).json({ error: "删除票据失败" });
  }
});

/**
 * 恢复票据
 * POST /api/v1/tickets/:id/restore
 */
router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { id } = req.params;
    const client = getSupabaseClient();

    // 检查票据是否在回收站中
    const { data: recycleItem } = await client
      .from("recycle_bin")
      .select("id")
      .eq("ticket_id", id)
      .eq("user_id", userId)
      .single();

    if (!recycleItem) {
      return res.status(404).json({ error: "票据不在回收站中" });
    }

    // 从回收站移除
    await client.from("recycle_bin").delete().eq("ticket_id", id);

    res.json({ success: true, message: "票据已恢复" });
  } catch (error) {
    console.error("恢复票据失败:", error);
    res.status(500).json({ error: "恢复票据失败" });
  }
});

/**
 * 彻底删除票据
 * DELETE /api/v1/tickets/:id/permanent
 */
router.delete("/:id/permanent", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { id } = req.params;
    const client = getSupabaseClient();

    // 检查票据是否在回收站中
    const { data: recycleItem } = await client
      .from("recycle_bin")
      .select("id")
      .eq("ticket_id", id)
      .eq("user_id", userId)
      .single();

    if (!recycleItem) {
      return res.status(404).json({ error: "票据不在回收站中" });
    }

    // 先从回收站移除
    await client.from("recycle_bin").delete().eq("ticket_id", id);

    // 彻底删除票据（会级联删除图片、标签关联等）
    await client.from("tickets").delete().eq("id", id);

    res.json({ success: true, message: "票据已彻底删除" });
  } catch (error) {
    console.error("彻底删除票据失败:", error);
    res.status(500).json({ error: "彻底删除票据失败" });
  }
});

export default router;
