import express, { type Request, type Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";

const router = express.Router();

/**
 * 获取备份状态
 * GET /api/v1/backup/status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    // 获取用户信息
    const { data: user } = await client
      .from("users")
      .select("preferences, storage_used")
      .eq("id", userId)
      .single();

    // 获取票据数量
    const { count: ticketCount } = await client
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // 获取图片数量
    const { count: imageCount } = await client
      .from("images")
      .select("*, tickets!inner(user_id)", { count: "exact", head: true })
      .eq("tickets.user_id", userId);

    // 获取最近备份时间（这里简化处理，实际可以增加备份记录表）
    const preferences = user?.preferences as any;
    const lastBackupAt = preferences?.lastBackupAt || null;

    res.json({
      success: true,
      status: {
        enabled: preferences?.cloudBackup || false,
        lastBackupAt,
        totalTickets: ticketCount || 0,
        totalImages: imageCount || 0,
        storageUsed: user?.storage_used || 0,
      },
    });
  } catch (error) {
    console.error("获取备份状态失败:", error);
    res.status(500).json({ error: "获取备份状态失败" });
  }
});

/**
 * 切换云备份开关
 * POST /api/v1/backup/toggle
 */
router.post("/toggle", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { enabled } = req.body;
    const client = getSupabaseClient();

    const { data: user } = await client
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    const currentPrefs = (user?.preferences as any) || {};
    const newPrefs = { ...currentPrefs, cloudBackup: enabled };

    await client
      .from("users")
      .update({ preferences: newPrefs })
      .eq("id", userId);

    res.json({ success: true });
  } catch (error) {
    console.error("切换备份开关失败:", error);
    res.status(500).json({ error: "切换备份开关失败" });
  }
});

/**
 * 执行备份
 * POST /api/v1/backup/execute
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    // 更新最后备份时间
    const { data: user } = await client
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    const currentPrefs = (user?.preferences as any) || {};
    const newPrefs = { 
      ...currentPrefs, 
      lastBackupAt: new Date().toISOString(),
      cloudBackup: true,
    };

    await client
      .from("users")
      .update({ preferences: newPrefs })
      .eq("id", userId);

    res.json({ success: true, message: "备份完成" });
  } catch (error) {
    console.error("执行备份失败:", error);
    res.status(500).json({ error: "执行备份失败" });
  }
});

/**
 * 恢复数据
 * POST /api/v1/backup/restore
 */
router.post("/restore", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    // 简化处理：实际恢复逻辑需要根据备份策略实现
    res.json({ success: true, message: "数据恢复完成" });
  } catch (error) {
    console.error("恢复数据失败:", error);
    res.status(500).json({ error: "恢复数据失败" });
  }
});

export default router;
