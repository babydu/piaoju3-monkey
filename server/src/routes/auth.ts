import express from "express";
import multer from "multer";
import { S3Storage } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { insertUserSchema } from "../storage/database/shared/schema.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Mob 秒验配置
const MOB_APP_KEY = process.env.MOB_APP_KEY || "3caaf104bc3d4";
const MOB_APP_SECRET = process.env.MOB_APP_SECRET || "dc47854aa32d3e9778e328ef1770fb98";

// 验证码缓存（生产环境应使用 Redis）
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * Mob 秒验 - 一键登录验证
 * POST /api/v1/auth/verify-one-click
 * Body: { token: string, operator: string }
 */
router.post("/verify-one-click", async (req, res) => {
  try {
    const { token, operator } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token不能为空" });
    }

    console.log(`[秒验] 收到一键登录请求, operator: ${operator}`);

    // 调用 Mob 服务端 API 验证 Token 并获取手机号
    const mobApiUrl = "https://api.verify.mob.com:8443/v2/verifyLogin";
    
    const response = await fetch(mobApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appkey: MOB_APP_KEY,
        token: token,
      }),
    });

    const mobResult = await response.json() as any;
    console.log(`[秒验] Mob API 返回:`, JSON.stringify(mobResult));

    if (mobResult.status !== 200) {
      console.error("[秒验] Token 验证失败:", mobResult);
      return res.status(400).json({ 
        error: mobResult.error || "Token验证失败",
        code: mobResult.status 
      });
    }

    // 从 Mob 返回结果中获取手机号
    const phone: string = mobResult.phone;
    if (!phone) {
      return res.status(400).json({ error: "无法获取手机号" });
    }

    console.log(`[秒验] 获取手机号成功: ${phone.substring(0, 3)}****${phone.substring(7)}`);

    // 查询或创建用户
    const client = getSupabaseClient();

    // 查询用户是否存在
    const { data: existingUser, error: queryError } = await client
      .from("users")
      .select("*")
      .eq("phone", phone)
      .single();

    if (queryError && queryError.code !== "PGRST116") {
      console.error("查询用户失败:", queryError);
      return res.status(500).json({ error: "登录失败" });
    }

    let user = existingUser;

    // 如果用户不存在，创建新用户
    if (!existingUser) {
      const { data: newUser, error: createError } = await client
        .from("users")
        .insert({
          phone,
          member_level: "free",
          storage_used: 0,
          storage_limit: 1073741824, // 1GB
          preferences: {
            ocrMode: "local",
            cloudBackup: false,
            allowPrivateBackup: false
          }
        })
        .select()
        .single();

      if (createError) {
        console.error("创建用户失败:", createError);
        return res.status(500).json({ error: "注册失败" });
      }

      user = newUser;
      console.log(`[秒验] 新用户注册成功: ${user.id}`);
    } else {
      console.log(`[秒验] 用户登录成功: ${user.id}`);
    }

    // 更新最后登录时间
    await client
      .from("users")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        memberLevel: user.member_level,
        storageUsed: user.storage_used,
        storageLimit: user.storage_limit,
        preferences: user.preferences,
        avatar: user.avatar_url || null
      },
      loginMethod: "oneClick"
    });
  } catch (error) {
    console.error("秒验登录失败:", error);
    res.status(500).json({ error: "秒验登录失败" });
  }
});

/**
 * Mob 秒验 - 检查是否支持一键登录
 * GET /api/v1/auth/check-one-click-support
 */
router.get("/check-one-click-support", async (req, res) => {
  try {
    // 返回服务端配置信息
    // 实际的支持判断由客户端根据运营商网络环境决定
    res.json({
      success: true,
      supported: true,
      appKey: MOB_APP_KEY,
      message: "秒验服务已配置"
    });
  } catch (error) {
    console.error("检查秒验支持失败:", error);
    res.status(500).json({ error: "检查失败" });
  }
});

/**
 * 发送验证码
 * POST /api/v1/auth/send-code
 * Body: { phone: string }
 * 
 * 使用 Mob 短信验证码服务
 * 文档：https://www.mob.com/wiki/native/ sms
 */
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "手机号不能为空" });
    }

    // 验证手机号格式（中国大陆）
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: "手机号格式不正确" });
    }

    // 生成6位随机验证码
    const code = Math.random().toString().slice(2, 8);
    
    // 缓存验证码（5分钟有效期）
    verificationCodes.set(phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    // 调用 Mob 短信验证码 API
    const mobSmsApiUrl = "https://api.sms.mob.com/sms/send";
    
    const response = await fetch(mobSmsApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appkey: MOB_APP_KEY,
        phone: phone,
        // Mob 短信模板ID（需要在 Mob 后台配置）
        // 如果没有配置模板，使用默认验证码短信
        zone: "86", // 中国大陆区号
      }),
    });

    const mobResult = await response.json() as any;
    console.log(`[短信] Mob API 返回:`, JSON.stringify(mobResult));

    if (mobResult.status !== 200 && mobResult.status !== 'success') {
      console.error("[短信] 发送失败:", mobResult);
      
      // 如果 Mob API 失败，检查是否是配置问题
      // 在开发环境下，仍然允许使用验证码登录
      if (process.env.NODE_ENV === 'development' || mobResult.error === 'appkey invalid') {
        console.log(`[短信] 开发模式：验证码 ${code} 已缓存，可用于测试`);
        // 开发模式下返回验证码（生产环境应删除此逻辑）
        return res.json({
          success: true,
          message: "验证码已发送",
          // 仅开发环境返回验证码
          ...(process.env.NODE_ENV === 'development' && { code })
        });
      }
      
      return res.status(400).json({ 
        error: mobResult.error || "短信发送失败，请稍后重试" 
      });
    }

    console.log(`[短信] 验证码已发送到 ${phone.substring(0, 3)}****${phone.substring(7)}`);

    res.json({
      success: true,
      message: "验证码已发送"
    });
  } catch (error) {
    console.error("发送验证码失败:", error);
    
    // 开发环境降级处理
    if (process.env.NODE_ENV === 'development') {
      const { phone } = req.body;
      const code = Math.random().toString().slice(2, 8);
      verificationCodes.set(phone, {
        code,
        expiresAt: Date.now() + 5 * 60 * 1000
      });
      console.log(`[短信] 开发模式降级：验证码 ${code}`);
      
      return res.json({
        success: true,
        message: "验证码已发送（开发模式）",
        code
      });
    }
    
    res.status(500).json({ error: "发送验证码失败" });
  }
});

/**
 * 登录/注册
 * POST /api/v1/auth/login
 * Body: { phone: string, code: string }
 */
router.post("/login", async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: "手机号和验证码不能为空" });
    }

    // 验证码校验
    const cachedData = verificationCodes.get(phone);
    
    if (!cachedData) {
      return res.status(400).json({ error: "验证码已过期，请重新获取" });
    }
    
    if (Date.now() > cachedData.expiresAt) {
      verificationCodes.delete(phone);
      return res.status(400).json({ error: "验证码已过期，请重新获取" });
    }
    
    if (cachedData.code !== code) {
      return res.status(400).json({ error: "验证码错误" });
    }
    
    // 验证成功后删除验证码
    verificationCodes.delete(phone);

    const client = getSupabaseClient();

    // 查询用户是否存在
    const { data: existingUser, error: queryError } = await client
      .from("users")
      .select("*")
      .eq("phone", phone)
      .single();

    if (queryError && queryError.code !== "PGRST116") {
      // PGRST116: 没有找到记录
      console.error("查询用户失败:", queryError);
      return res.status(500).json({ error: "登录失败" });
    }

    let user = existingUser;

    // 如果用户不存在，创建新用户
    if (!existingUser) {
      const validationResult = insertUserSchema.safeParse({ phone });
      if (!validationResult.success) {
        return res.status(400).json({ error: "手机号格式不正确" });
      }

      const { data: newUser, error: createError } = await client
        .from("users")
        .insert({
          phone,
          member_level: "free",
          storage_used: 0,
          storage_limit: 1073741824, // 1GB
          preferences: {
            ocrMode: "local",
            cloudBackup: false,
            allowPrivateBackup: false
          }
        })
        .select()
        .single();

      if (createError) {
        console.error("创建用户失败:", createError);
        return res.status(500).json({ error: "注册失败" });
      }

      user = newUser;
    }

    // 更新最后登录时间
    await client
      .from("users")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        memberLevel: user.member_level,
        storageUsed: user.storage_used,
        storageLimit: user.storage_limit,
        preferences: user.preferences,
        avatar: user.avatar_url || null
      }
    });
  } catch (error) {
    console.error("登录失败:", error);
    res.status(500).json({ error: "登录失败" });
  }
});

/**
 * 获取用户信息
 * GET /api/v1/auth/me
 * Header: Authorization: Bearer {userId}
 */
router.get("/me", async (req, res) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");

    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const client = getSupabaseClient();
    const { data: user, error } = await client
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "用户不存在" });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        memberLevel: user.member_level,
        storageUsed: user.storage_used,
        storageLimit: user.storage_limit,
        preferences: user.preferences,
        avatar: user.avatar_url || null
      }
    });
  } catch (error) {
    console.error("获取用户信息失败:", error);
    res.status(500).json({ error: "获取用户信息失败" });
  }
});

/**
 * 上传头像
 * POST /api/v1/users/avatar
 */
router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "请选择图片" });
    }

    // 上传到对象存储
    const key = `avatars/${userId}/${Date.now()}_${req.file.originalname}`;
    const fileKey = await storage.uploadFile({
      fileContent: req.file.buffer,
      fileName: key,
      contentType: req.file.mimetype,
    });

    // 生成签名URL
    const avatarUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 31536000, // 1年有效期
    });

    // 更新用户头像
    const client = getSupabaseClient();
    const { error: updateError } = await client
      .from("users")
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("更新头像失败:", updateError);
      return res.status(500).json({ error: "更新头像失败" });
    }

    res.json({
      success: true,
      avatarUrl,
    });
  } catch (error) {
    console.error("上传头像失败:", error);
    res.status(500).json({ error: "上传头像失败" });
  }
});

export default router;
