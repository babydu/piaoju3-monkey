import express, { type Request, type Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import crypto from "crypto";

const router = express.Router();

// 加密函数（用于隐私箱密码）
function encryptPassword(password: string): string {
  const secret = process.env.PRIVACY_SECRET || 'default-secret-key';
  return crypto.createHash('sha256').update(password + secret).digest('hex');
}

/**
 * 获取用户设置
 * GET /api/v1/settings
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();

    const { data: user, error } = await client
      .from("users")
      .select("preferences, privacy_password, password_hint, biometric_enabled, member_level, phone")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "用户不存在" });
    }

    // 获取云存储配置
    const { data: cloudConfigs } = await client
      .from("cloud_storage_configs")
      .select("id, provider, is_enabled, last_sync_at")
      .eq("user_id", userId);

    // 获取可用的OCR服务配置
    const { data: ocrServices } = await client
      .from("ocr_service_configs")
      .select("id, name, display_name, is_enabled, is_default")
      .eq("is_enabled", true);

    res.json({
      success: true,
      settings: {
        preferences: user.preferences || {},
        privacy: {
          hasPassword: !!user.privacy_password,
          passwordHint: user.password_hint || null,
          biometricEnabled: user.biometric_enabled || false,
        },
        cloudStorage: cloudConfigs || [],
        ocrServices: ocrServices || [],
        isPro: user.member_level === 'pro',
        // 返回脱敏手机号用于密码重置
        phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
      },
    });
  } catch (error) {
    console.error("获取设置失败:", error);
    res.status(500).json({ error: "获取设置失败" });
  }
});

/**
 * 更新用户偏好设置
 * PUT /api/v1/settings/preferences
 * Body: { ocrMode?, cloudBackup?, cloudOcrEnabled?, allowPrivateCloudStorage?, aiServiceEnabled?, theme? }
 */
router.put("/preferences", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { ocrMode, cloudBackup, cloudOcrEnabled, allowPrivateCloudStorage, aiServiceEnabled, theme } = req.body;
    const client = getSupabaseClient();

    // 获取当前偏好
    const { data: user } = await client
      .from("users")
      .select("preferences, member_level")
      .eq("id", userId)
      .single();

    const currentPrefs = user?.preferences || {};
    const newPrefs = {
      ...currentPrefs,
      ...(ocrMode !== undefined && { ocrMode }),
      ...(cloudBackup !== undefined && { cloudBackup }),
      ...(cloudOcrEnabled !== undefined && { cloudOcrEnabled }),
      ...(allowPrivateCloudStorage !== undefined && { allowPrivateCloudStorage }),
      ...(aiServiceEnabled !== undefined && { aiServiceEnabled }),
      ...(theme !== undefined && { theme }),
    };

    const { error } = await client
      .from("users")
      .update({ preferences: newPrefs })
      .eq("id", userId);

    if (error) {
      console.error("更新偏好设置失败:", error);
      return res.status(500).json({ error: "更新偏好设置失败" });
    }

    res.json({ success: true, preferences: newPrefs });
  } catch (error) {
    console.error("更新偏好设置失败:", error);
    res.status(500).json({ error: "更新偏好设置失败" });
  }
});

/**
 * 设置隐私箱密码
 * POST /api/v1/settings/privacy-password
 * Body: { password, oldPassword?, passwordHint? }
 */
router.post("/privacy-password", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { password, oldPassword, passwordHint } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({ error: "密码长度至少4位" });
    }

    // 提示语长度限制
    if (passwordHint && passwordHint.length > 100) {
      return res.status(400).json({ error: "密码提示语最长100个字符" });
    }

    const client = getSupabaseClient();

    // 检查会员权限
    const { data: user } = await client
      .from("users")
      .select("member_level, privacy_password")
      .eq("id", userId)
      .single();

    if (user?.member_level !== 'pro') {
      return res.status(403).json({ error: "隐私箱为专业版功能" });
    }

    // 如果已有密码，需要验证旧密码
    if (user.privacy_password && oldPassword) {
      const hashedOld = encryptPassword(oldPassword);
      if (hashedOld !== user.privacy_password) {
        return res.status(400).json({ error: "原密码错误" });
      }
    }

    const hashedPassword = encryptPassword(password);

    const { error } = await client
      .from("users")
      .update({ 
        privacy_password: hashedPassword,
        password_hint: passwordHint || null,
      })
      .eq("id", userId);

    if (error) {
      console.error("设置隐私箱密码失败:", error);
      return res.status(500).json({ error: "设置隐私箱密码失败" });
    }

    res.json({ success: true, message: "隐私箱密码设置成功" });
  } catch (error) {
    console.error("设置隐私箱密码失败:", error);
    res.status(500).json({ error: "设置隐私箱密码失败" });
  }
});

/**
 * 验证隐私箱密码
 * POST /api/v1/settings/privacy-password/verify
 * Body: { password }
 */
router.post("/privacy-password/verify", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "请输入密码" });
    }

    const client = getSupabaseClient();

    const { data: user } = await client
      .from("users")
      .select("privacy_password, password_hint")
      .eq("id", userId)
      .single();

    if (!user?.privacy_password) {
      return res.status(400).json({ error: "未设置隐私箱密码" });
    }

    const hashedPassword = encryptPassword(password);
    const isValid = hashedPassword === user.privacy_password;

    res.json({ 
      success: true, 
      valid: isValid,
      message: isValid ? "验证成功" : "密码错误",
      passwordHint: !isValid ? user.password_hint : undefined, // 验证失败时返回提示语
    });
  } catch (error) {
    console.error("验证隐私箱密码失败:", error);
    res.status(500).json({ error: "验证隐私箱密码失败" });
  }
});

/**
 * 重置隐私箱密码（通过手机验证码验证身份）
 * POST /api/v1/settings/privacy-password/reset
 * Body: { newPassword, passwordHint?, verifyCode }
 * 注意：此接口需要用户已登录，需要短信验证码验证身份
 */
router.post("/privacy-password/reset", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { newPassword, passwordHint, verifyCode } = req.body;

    // 验证短信验证码
    if (!verifyCode) {
      return res.status(400).json({ error: "请输入短信验证码" });
    }

    // 模拟验证码验证（固定验证码：123456）
    if (verifyCode !== "123456") {
      return res.status(400).json({ error: "验证码错误" });
    }

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: "密码长度至少4位" });
    }

    // 提示语长度限制
    if (passwordHint && passwordHint.length > 100) {
      return res.status(400).json({ error: "密码提示语最长100个字符" });
    }

    const client = getSupabaseClient();

    // 检查会员权限
    const { data: user } = await client
      .from("users")
      .select("member_level, phone")
      .eq("id", userId)
      .single();

    if (user?.member_level !== 'pro') {
      return res.status(403).json({ error: "隐私箱为专业版功能" });
    }

    const hashedPassword = encryptPassword(newPassword);

    const { error } = await client
      .from("users")
      .update({ 
        privacy_password: hashedPassword,
        password_hint: passwordHint || null,
      })
      .eq("id", userId);

    if (error) {
      console.error("重置隐私箱密码失败:", error);
      return res.status(500).json({ error: "重置隐私箱密码失败" });
    }

    res.json({ success: true, message: "隐私箱密码重置成功" });
  } catch (error) {
    console.error("重置隐私箱密码失败:", error);
    res.status(500).json({ error: "重置隐私箱密码失败" });
  }
});

/**
 * 设置生物识别开关
 * PUT /api/v1/settings/biometric
 * Body: { enabled: boolean }
 */
router.put("/biometric", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { enabled } = req.body;
    const client = getSupabaseClient();

    const { error } = await client
      .from("users")
      .update({ biometric_enabled: enabled })
      .eq("id", userId);

    if (error) {
      console.error("设置生物识别开关失败:", error);
      return res.status(500).json({ error: "设置生物识别开关失败" });
    }

    res.json({ success: true, biometricEnabled: enabled });
  } catch (error) {
    console.error("设置生物识别开关失败:", error);
    res.status(500).json({ error: "设置生物识别开关失败" });
  }
});

/**
 * 添加云存储配置
 * POST /api/v1/settings/cloud-storage
 * Body: { provider, config }
 */
router.post("/cloud-storage", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { provider, config } = req.body;

    if (!provider || !config) {
      return res.status(400).json({ error: "缺少必要参数" });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("cloud_storage_configs")
      .insert({
        user_id: userId,
        provider,
        config,
        is_enabled: false, // 默认不启用，需要验证后启用
      })
      .select()
      .single();

    if (error) {
      console.error("添加云存储配置失败:", error);
      return res.status(500).json({ error: "添加云存储配置失败" });
    }

    res.json({ success: true, config: data });
  } catch (error) {
    console.error("添加云存储配置失败:", error);
    res.status(500).json({ error: "添加云存储配置失败" });
  }
});

/**
 * 更新云存储配置
 * PUT /api/v1/settings/cloud-storage/:id
 * Body: { config?, isEnabled? }
 */
router.put("/cloud-storage/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { id } = req.params;
    const { config, isEnabled } = req.body;
    const client = getSupabaseClient();

    const updateData: any = {};
    if (config !== undefined) updateData.config = config;
    if (isEnabled !== undefined) updateData.is_enabled = isEnabled;

    const { error } = await client
      .from("cloud_storage_configs")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("更新云存储配置失败:", error);
      return res.status(500).json({ error: "更新云存储配置失败" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("更新云存储配置失败:", error);
    res.status(500).json({ error: "更新云存储配置失败" });
  }
});

/**
 * 删除云存储配置
 * DELETE /api/v1/settings/cloud-storage/:id
 */
router.delete("/cloud-storage/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { id } = req.params;
    const client = getSupabaseClient();

    const { error } = await client
      .from("cloud_storage_configs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("删除云存储配置失败:", error);
      return res.status(500).json({ error: "删除云存储配置失败" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("删除云存储配置失败:", error);
    res.status(500).json({ error: "删除云存储配置失败" });
  }
});

/**
 * 获取可用主题列表
 * GET /api/v1/settings/themes
 */
router.get("/themes", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    const client = getSupabaseClient();

    // 获取用户会员状态
    let isPro = false;
    if (userId) {
      const { data: user } = await client
        .from("users")
        .select("member_level")
        .eq("id", userId)
        .single();
      isPro = user?.member_level === 'pro';
    }

    // 获取所有主题
    const { data: themes, error } = await client
      .from("themes")
      .select("*")
      .order("is_default", { ascending: false })
      .order("download_count", { ascending: false });

    if (error) {
      console.error("获取主题列表失败:", error);
      return res.status(500).json({ error: "获取主题列表失败" });
    }

    // 如果不是会员，过滤掉专业版主题
    const availableThemes = isPro 
      ? themes 
      : themes?.filter(t => !t.is_pro);

    res.json({ 
      success: true, 
      themes: availableThemes,
      isPro,
    });
  } catch (error) {
    console.error("获取主题列表失败:", error);
    res.status(500).json({ error: "获取主题列表失败" });
  }
});

export default router;
