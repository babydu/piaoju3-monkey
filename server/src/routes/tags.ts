import express, { type Request, type Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";

const router = express.Router();

/**
 * 获取标签列表
 * GET /api/v1/tags
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    // 获取标签及票据数量
    const { data: tags, error } = await client
      .from("tags")
      .select("*, ticket_tags(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取标签列表失败:", error);
      return res.status(500).json({ error: "获取标签列表失败" });
    }

    const formattedTags = (tags || []).map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      ticketCount: tag.ticket_tags?.[0]?.count || 0,
      createdAt: tag.created_at,
    }));

    res.json({ success: true, tags: formattedTags });
  } catch (error) {
    console.error("获取标签列表失败:", error);
    res.status(500).json({ error: "获取标签列表失败" });
  }
});

/**
 * 创建标签
 * POST /api/v1/tags
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
      return res.status(400).json({ error: "标签名称不能为空" });
    }

    const client = getSupabaseClient();

    // 检查是否已存在同名标签
    const { data: existing } = await client
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name.trim())
      .single();

    if (existing) {
      return res.status(400).json({ error: "标签已存在" });
    }

    const { data: tag, error } = await client
      .from("tags")
      .insert({
        name: name.trim(),
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("创建标签失败:", error);
      return res.status(500).json({ error: "创建标签失败" });
    }

    res.json({
      success: true,
      tag: {
        id: tag.id,
        name: tag.name,
        createdAt: tag.created_at,
      },
    });
  } catch (error) {
    console.error("创建标签失败:", error);
    res.status(500).json({ error: "创建标签失败" });
  }
});

/**
 * 更新标签
 * PUT /api/v1/tags/:id
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
      return res.status(400).json({ error: "标签名称不能为空" });
    }

    const client = getSupabaseClient();

    const { data: tag, error } = await client
      .from("tags")
      .update({ name: name.trim() })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("更新标签失败:", error);
      return res.status(500).json({ error: "更新标签失败" });
    }

    res.json({
      success: true,
      tag: {
        id: tag.id,
        name: tag.name,
      },
    });
  } catch (error) {
    console.error("更新标签失败:", error);
    res.status(500).json({ error: "更新标签失败" });
  }
});

/**
 * 删除标签
 * DELETE /api/v1/tags/:id
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
      .from("tags")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("删除标签失败:", error);
      return res.status(500).json({ error: "删除标签失败" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("删除标签失败:", error);
    res.status(500).json({ error: "删除标签失败" });
  }
});

/**
 * 合并标签
 * POST /api/v1/tags/merge
 * Body: { sourceTagId: string, targetTagId: string }
 */
router.post("/merge", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { sourceTagId, targetTagId } = req.body;

    if (!sourceTagId || !targetTagId) {
      return res.status(400).json({ error: "请选择要合并的标签" });
    }

    if (sourceTagId === targetTagId) {
      return res.status(400).json({ error: "不能合并同一个标签" });
    }

    const client = getSupabaseClient();

    // 获取源标签的所有票据关联
    const { data: sourceTagLinks, error: fetchError } = await client
      .from("ticket_tags")
      .select("ticket_id")
      .eq("tag_id", sourceTagId);

    if (fetchError) {
      console.error("获取标签关联失败:", fetchError);
      return res.status(500).json({ error: "合并失败" });
    }

    // 批量更新票据标签关联
    for (const link of sourceTagLinks || []) {
      // 检查是否已存在目标标签关联
      const { data: existing } = await client
        .from("ticket_tags")
        .select("id")
        .eq("ticket_id", link.ticket_id)
        .eq("tag_id", targetTagId)
        .single();

      if (!existing) {
        // 创建新关联
        await client.from("ticket_tags").insert({
          ticket_id: link.ticket_id,
          tag_id: targetTagId,
        });
      }
    }

    // 删除源标签的所有关联
    await client
      .from("ticket_tags")
      .delete()
      .eq("tag_id", sourceTagId);

    // 删除源标签
    await client
      .from("tags")
      .delete()
      .eq("id", sourceTagId)
      .eq("user_id", userId);

    res.json({
      success: true,
      message: "标签合并成功",
    });
  } catch (error) {
    console.error("合并标签失败:", error);
    res.status(500).json({ error: "合并标签失败" });
  }
});

export default router;
