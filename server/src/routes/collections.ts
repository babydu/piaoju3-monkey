import express, { type Request, type Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";

const router = express.Router();

/**
 * 获取合集列表
 * GET /api/v1/collections
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    const { data: collections, error } = await client
      .from("collections")
      .select("*, tickets(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取合集列表失败:", error);
      return res.status(500).json({ error: "获取合集列表失败" });
    }

    const formattedCollections = (collections || []).map((col: any) => ({
      id: col.id,
      name: col.name,
      ticketCount: col.tickets?.[0]?.count || 0,
      createdAt: col.created_at,
    }));

    res.json({ success: true, collections: formattedCollections });
  } catch (error) {
    console.error("获取合集列表失败:", error);
    res.status(500).json({ error: "获取合集列表失败" });
  }
});

/**
 * 创建合集
 * POST /api/v1/collections
 * Body: { name: string }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "合集名称不能为空" });
    }

    const client = getSupabaseClient();

    // 检查是否已存在同名合集
    const { data: existing } = await client
      .from("collections")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name.trim())
      .single();

    if (existing) {
      return res.status(400).json({ error: "合集已存在" });
    }

    const { data: collection, error } = await client
      .from("collections")
      .insert({
        name: name.trim(),
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("创建合集失败:", error);
      return res.status(500).json({ error: "创建合集失败" });
    }

    res.json({
      success: true,
      collection: {
        id: collection.id,
        name: collection.name,
        createdAt: collection.created_at,
      },
    });
  } catch (error) {
    console.error("创建合集失败:", error);
    res.status(500).json({ error: "创建合集失败" });
  }
});

/**
 * 更新合集
 * PUT /api/v1/collections/:id
 * Body: { name: string }
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "合集名称不能为空" });
    }

    const client = getSupabaseClient();

    const { data: collection, error } = await client
      .from("collections")
      .update({ name: name.trim() })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("更新合集失败:", error);
      return res.status(500).json({ error: "更新合集失败" });
    }

    res.json({
      success: true,
      collection: {
        id: collection.id,
        name: collection.name,
      },
    });
  } catch (error) {
    console.error("更新合集失败:", error);
    res.status(500).json({ error: "更新合集失败" });
  }
});

/**
 * 删除合集
 * DELETE /api/v1/collections/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { id } = req.params;
    const client = getSupabaseClient();

    const { error } = await client
      .from("collections")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("删除合集失败:", error);
      return res.status(500).json({ error: "删除合集失败" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("删除合集失败:", error);
    res.status(500).json({ error: "删除合集失败" });
  }
});

export default router;
