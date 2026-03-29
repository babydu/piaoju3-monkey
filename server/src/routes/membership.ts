import express, { type Request, type Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";

const router = express.Router();

// 会员权益配置
const MEMBER_BENEFITS = {
  free: {
    name: '免费版',
    storageLimit: 1073741824, // 1GB
    ticketLimit: 100,
    ocrLimit: 50, // 每月
    exportWithImage: false, // 导出是否包含原图
    multiDevice: false, // 多设备同步
    privacyBox: false, // 隐私箱
    themeUnlock: false, // 皮肤解锁
    price: {
      monthly: 0,
      yearly: 0,
    }
  },
  pro: {
    name: '专业版',
    storageLimit: 10737418240, // 10GB
    ticketLimit: -1, // 无限
    ocrLimit: -1, // 无限
    exportWithImage: true,
    multiDevice: true,
    privacyBox: true,
    themeUnlock: true,
    price: {
      monthly: 19.9,
      yearly: 199,
    }
  }
};

/**
 * 获取会员权益配置
 * GET /api/v1/membership/benefits
 */
router.get("/benefits", async (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    benefits: MEMBER_BENEFITS 
  });
});

/**
 * 获取当前用户的会员信息和用量
 * GET /api/v1/membership/status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    // 获取用户信息
    const { data: user, error } = await client
      .from("users")
      .select("id, phone, member_level, member_expired_at, storage_used, storage_limit, ticket_count, ticket_limit, ocr_count, ocr_limit, ocr_reset_at, trial_used, preferences")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "用户不存在" });
    }

    // 检查是否是专业版且已过期
    let memberLevel = user.member_level;
    let isExpired = false;
    
    if (user.member_level === 'pro' && user.member_expired_at) {
      const expiredAt = new Date(user.member_expired_at);
      if (expiredAt < new Date()) {
        memberLevel = 'free';
        isExpired = true;
        // 更新用户等级为免费版
        await client
          .from("users")
          .update({ 
            member_level: 'free',
            storage_limit: MEMBER_BENEFITS.free.storageLimit,
            ticket_limit: MEMBER_BENEFITS.free.ticketLimit,
            ocr_limit: MEMBER_BENEFITS.free.ocrLimit,
          })
          .eq("id", userId);
      }
    }

    // 检查OCR计数是否需要重置（每月）
    const now = new Date();
    const ocrResetAt = user.ocr_reset_at ? new Date(user.ocr_reset_at) : null;
    const needsReset = !ocrResetAt || 
      now.getMonth() !== ocrResetAt.getMonth() || 
      now.getFullYear() !== ocrResetAt.getFullYear();

    let ocrCount = user.ocr_count;
    let ocrLimit = user.ocr_limit;
    
    if (needsReset) {
      ocrCount = 0;
      const newLimit = memberLevel === 'pro' ? -1 : MEMBER_BENEFITS.free.ocrLimit;
      ocrLimit = newLimit;
      await client
        .from("users")
        .update({ 
          ocr_count: 0, 
          ocr_reset_at: now.toISOString(),
          ocr_limit: newLimit,
        })
        .eq("id", userId);
    }

    // 获取本月使用统计
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { data: stats } = await client
      .from("usage_stats")
      .select("*")
      .eq("user_id", userId)
      .eq("month", month)
      .single();

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

    const { count: actualTicketCount } = await ticketsQuery;

    // 统计图片数量
    const { data: userTickets } = await client
      .from("tickets")
      .select("id")
      .eq("user_id", userId);
    
    const ticketIds = (userTickets || []).map((t: any) => t.id);
    let actualImageCount = 0;
    
    if (ticketIds.length > 0) {
      const { count } = await client
        .from("images")
        .select("id", { count: "exact", head: true })
        .in("ticket_id", ticketIds);
      actualImageCount = count || 0;
    }

    const benefits = memberLevel === 'pro' ? MEMBER_BENEFITS.pro : MEMBER_BENEFITS.free;

    res.json({
      success: true,
      membership: {
        level: memberLevel,
        name: benefits.name,
        expiredAt: user.member_expired_at,
        isExpired,
        trialUsed: user.trial_used,
      },
      usage: {
        storage: {
          used: user.storage_used,
          limit: user.storage_limit,
          percentage: user.storage_limit > 0 ? Math.round((user.storage_used / user.storage_limit) * 100) : 0,
        },
        tickets: {
          used: actualTicketCount || 0,
          limit: user.ticket_limit,
          percentage: user.ticket_limit > 0 ? Math.round(((actualTicketCount || 0) / user.ticket_limit) * 100) : 0,
        },
        ocr: {
          used: ocrCount,
          limit: ocrLimit,
          percentage: ocrLimit > 0 ? Math.round((ocrCount / ocrLimit) * 100) : 0,
          resetAt: user.ocr_reset_at,
        },
      },
      benefits: {
        exportWithImage: benefits.exportWithImage,
        multiDevice: benefits.multiDevice,
        privacyBox: benefits.privacyBox,
        themeUnlock: benefits.themeUnlock,
      },
      monthlyStats: stats || {
        ocrCount: 0,
        ticketCount: 0,
        storageBytes: 0,
        exportCount: 0,
      },
    });
  } catch (error) {
    console.error("获取会员状态失败:", error);
    res.status(500).json({ error: "获取会员状态失败" });
  }
});

/**
 * 开通试用（新用户3天专业版体验）
 * POST /api/v1/membership/trial
 */
router.post("/trial", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    // 检查用户是否已使用过试用
    const { data: user, error: userError } = await client
      .from("users")
      .select("trial_used, member_level")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "用户不存在" });
    }

    if (user.trial_used) {
      return res.status(400).json({ error: "您已使用过试用体验" });
    }

    if (user.member_level === 'pro') {
      return res.status(400).json({ error: "您已是专业版会员" });
    }

    // 开通3天试用
    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + 3);

    const { error: updateError } = await client
      .from("users")
      .update({
        member_level: 'trial',
        member_expired_at: expiredAt.toISOString(),
        trial_used: true,
        storage_limit: MEMBER_BENEFITS.pro.storageLimit,
        ticket_limit: MEMBER_BENEFITS.pro.ticketLimit,
        ocr_limit: MEMBER_BENEFITS.pro.ocrLimit,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("开通试用失败:", updateError);
      return res.status(500).json({ error: "开通试用失败" });
    }

    // 创建订阅记录
    await client
      .from("subscriptions")
      .insert({
        user_id: userId,
        type: 'trial',
        status: 'active',
        price: 0,
        expired_at: expiredAt.toISOString(),
      });

    res.json({
      success: true,
      message: "试用已开通，有效期3天",
      expiredAt: expiredAt.toISOString(),
    });
  } catch (error) {
    console.error("开通试用失败:", error);
    res.status(500).json({ error: "开通试用失败" });
  }
});

/**
 * 购买会员
 * POST /api/v1/membership/purchase
 * Body: { type: 'monthly' | 'yearly' }
 */
router.post("/purchase", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { type } = req.body;
    if (!type || !['monthly', 'yearly'].includes(type)) {
      return res.status(400).json({ error: "请选择有效的订阅类型" });
    }

    const client = getSupabaseClient();

    // 获取用户当前状态
    const { data: user, error: userError } = await client
      .from("users")
      .select("member_level, member_expired_at")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "用户不存在" });
    }

    const price = type === 'monthly' ? MEMBER_BENEFITS.pro.price.monthly : MEMBER_BENEFITS.pro.price.yearly;
    
    // 计算过期时间
    const now = new Date();
    let expiredAt = new Date();
    
    if (user.member_level === 'pro' && user.member_expired_at) {
      // 如果当前是专业版且未过期，从当前过期时间延长
      const currentExpired = new Date(user.member_expired_at);
      if (currentExpired > now) {
        expiredAt = currentExpired;
      }
    }
    
    if (type === 'monthly') {
      expiredAt.setMonth(expiredAt.getMonth() + 1);
    } else {
      expiredAt.setFullYear(expiredAt.getFullYear() + 1);
    }

    // 模拟支付成功（实际应接入支付系统）
    // 创建订阅记录
    const { error: subError } = await client
      .from("subscriptions")
      .insert({
        user_id: userId,
        type,
        status: 'active',
        price: price.toString(),
        expired_at: expiredAt.toISOString(),
      });

    if (subError) {
      console.error("创建订阅记录失败:", subError);
      return res.status(500).json({ error: "创建订阅记录失败" });
    }

    // 更新用户会员状态
    const { error: updateError } = await client
      .from("users")
      .update({
        member_level: 'pro',
        member_expired_at: expiredAt.toISOString(),
        storage_limit: MEMBER_BENEFITS.pro.storageLimit,
        ticket_limit: MEMBER_BENEFITS.pro.ticketLimit,
        ocr_limit: MEMBER_BENEFITS.pro.ocrLimit,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("更新会员状态失败:", updateError);
      return res.status(500).json({ error: "更新会员状态失败" });
    }

    res.json({
      success: true,
      message: "购买成功",
      subscription: {
        type,
        price,
        expiredAt: expiredAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("购买会员失败:", error);
    res.status(500).json({ error: "购买会员失败" });
  }
});

/**
 * 获取订阅历史
 * GET /api/v1/membership/subscriptions
 */
router.get("/subscriptions", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    const { data: subscriptions, error } = await client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取订阅历史失败:", error);
      return res.status(500).json({ error: "获取订阅历史失败" });
    }

    res.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("获取订阅历史失败:", error);
    res.status(500).json({ error: "获取订阅历史失败" });
  }
});

export default router;
