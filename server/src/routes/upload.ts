import express, { type Request, type Response } from "express";
import multer from "multer";
import { S3Storage } from "coze-coding-dev-sdk";

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

/**
 * 通用文件上传接口
 * POST /api/v1/upload
 * Body: FormData { file: File }
 * Returns: { success: true, url: string, key: string }
 */
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "请选择文件" });
    }

    const { buffer, originalname, mimetype } = req.file;
    const fileName = `uploads/${userId}/${Date.now()}_${originalname}`;

    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: mimetype,
    });

    // 生成签名URL（有效期30天）
    const signedUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 2592000, // 30天
    });

    console.log(`File uploaded successfully: ${fileKey}`);

    // 返回文件key和签名URL
    res.json({
      success: true,
      url: signedUrl,  // 前端展示用的签名URL
      key: fileKey,    // 持久化存储用的key
    });
  } catch (error) {
    console.error("上传文件失败:", error);
    res.status(500).json({ error: "上传文件失败" });
  }
});

export default router;
