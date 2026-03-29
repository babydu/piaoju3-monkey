import express, { type Request, type Response } from "express";
import multer from "multer";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";
import {
  recognizeImage,
  isOCRServiceAvailable,
  getOCRServiceStatus,
} from "../services/xunfei-ocr.js";
import {
  analyzeOCRText,
  isLLMServiceAvailable,
  getLLMServiceStatus,
  isAIServiceEnabledForUser,
} from "../services/xunfei-llm.js";

const execAsync = promisify(exec);

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// OCR识别超时时间（毫秒）
const OCR_TIMEOUT = 60000; // 60秒

/**
 * 获取OCR和LLM服务状态
 * GET /api/v1/ocr/status
 * Returns: { ocr: {...}, llm: {...} }
 */
router.get("/status", (_req: Request, res: Response) => {
  const ocrStatus = getOCRServiceStatus();
  const llmStatus = getLLMServiceStatus();
  res.json({
    success: true,
    ocr: ocrStatus,
    llm: llmStatus,
  });
});

/**
 * 讯飞OCR识别票据图片
 * POST /api/v1/ocr/recognize
 * Body: FormData { file: File }
 * Returns: { text: string, suggestedTags: string[], ticketType: string, keyInfo: object }
 */
router.post(
  "/recognize",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const userId = req.headers.authorization?.replace("Bearer ", "");
      if (!userId) {
        return res.status(401).json({ error: "未登录" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "请选择图片" });
      }

      // 检查讯飞OCR服务是否可用
      if (!isOCRServiceAvailable()) {
        console.error("讯飞OCR服务不可用，请检查环境变量配置");
        return res.status(503).json({
          error: "OCR服务暂时不可用，请稍后重试或使用本地识别",
        });
      }

      const { buffer } = req.file;
      
      // 获取纯Base64（不含data:xxx;base64,前缀）
      const base64Image = buffer.toString("base64");

      // 调用讯飞OCR识别
      const ocrResult = await recognizeImage(base64Image, OCR_TIMEOUT);

      if (!ocrResult.success) {
        console.error("讯飞OCR识别失败:", ocrResult.error);
        return res.status(500).json({
          error: ocrResult.error || "OCR识别失败",
        });
      }

      // 使用讯飞LLM分析OCR结果，提取结构化信息
      // 传递userId，在服务层检查AI服务是否启用
      let structuredResult = {
        text: ocrResult.text || "",
        ticketType: "其他",
        suggestedTitle: "",
        summary: "",
        suggestedTags: [] as string[],
        keyInfo: {} as Record<string, string | null>,
      };

      // 如果有识别到文字，用LLM进行结构化分析
      if (ocrResult.text && ocrResult.text.trim()) {
        if (isLLMServiceAvailable()) {
          // 传递userId，让服务层检查AI服务设置
          const analysisResult = await analyzeOCRText(ocrResult.text, { userId });
          structuredResult.ticketType = analysisResult.ticketType || "其他";
          structuredResult.suggestedTitle = analysisResult.suggestedTitle || "";
          structuredResult.summary = analysisResult.summary || "";
          structuredResult.suggestedTags = analysisResult.suggestedTags || [];
          structuredResult.keyInfo = analysisResult.keyInfo || {};
        } else {
          console.warn("LLM服务不可用，跳过结构化分析");
          structuredResult.suggestedTags = ["其他"];
        }
      }

      res.json({
        success: true,
        result: structuredResult,
      });
    } catch (error) {
      console.error("OCR识别失败:", error);
      res.status(500).json({ error: "OCR识别失败" });
    }
  }
);

/**
 * 根据OCR文本推荐标签
 * POST /api/v1/ocr/suggest-tags
 * Body: { text: string }
 * Returns: { suggestedTags: string[] }
 */
router.post("/suggest-tags", async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "请提供文本内容" });
    }

    // 检查用户是否启用了AI服务（从服务层统一检查）
    const aiServiceEnabled = await isAIServiceEnabledForUser(userId);
    if (!aiServiceEnabled) {
      return res.status(403).json({
        error: "AI服务已关闭，请在设置中开启后再使用标签推荐功能",
      });
    }

    // 检查LLM服务是否可用
    if (!isLLMServiceAvailable()) {
      return res.status(503).json({
        error: "标签推荐服务暂时不可用",
      });
    }

    // 传递userId，让服务层再次检查AI服务设置（双重保障）
    const result = await analyzeOCRText(text, { userId });

    res.json({
      success: true,
      suggestedTags: result.suggestedTags || [],
      ticketType: result.ticketType || "其他",
      keyInfo: result.keyInfo || {},
    });
  } catch (error) {
    console.error("标签推荐失败:", error);
    res.status(500).json({ error: "标签推荐失败" });
  }
});

/**
 * 本地OCR识别（使用RapidOCR）
 * POST /api/v1/ocr/local
 * Body: FormData { file: File }
 * Returns: { text: string, raw_result: array }
 */
router.post(
  "/local",
  upload.single("file"),
  async (req: Request, res: Response) => {
    let tempFilePath: string | null = null;

    try {
      const userId = req.headers.authorization?.replace("Bearer ", "");
      if (!userId) {
        return res.status(401).json({ error: "未登录" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "请选择图片" });
      }

      // 保存临时文件
      const tempDir = path.join(os.tmpdir(), "ocr_temp");
      await fs.mkdir(tempDir, { recursive: true });
      tempFilePath = path.join(
        tempDir,
        `${Date.now()}_${req.file.originalname}`
      );
      await fs.writeFile(tempFilePath, req.file.buffer);

      // 执行Python OCR脚本
      const scriptPath = path.join(process.cwd(), "scripts", "local_ocr.py");
      const { stdout, stderr } = await execAsync(
        `python3 "${scriptPath}" "${tempFilePath}"`,
        { timeout: 30000 }
      );

      if (stderr && !stdout) {
        console.error("本地OCR执行错误:", stderr);
        return res.status(500).json({ error: "本地OCR识别失败" });
      }

      // 解析OCR结果
      let ocrResult;
      try {
        ocrResult = JSON.parse(stdout);
      } catch (parseError) {
        console.error("解析OCR结果失败:", parseError, "stdout:", stdout);
        return res.status(500).json({ error: "OCR结果解析失败" });
      }

      if (ocrResult.error) {
        console.error("本地OCR错误:", ocrResult.error);
        return res.status(500).json({ error: ocrResult.error });
      }

      // 使用讯飞LLM分析OCR结果，提取结构化信息
      // 传递userId，让服务层检查AI服务是否启用
      let structuredResult = {
        text: ocrResult.text || "",
        ticketType: "其他",
        suggestedTitle: "",
        summary: "",
        suggestedTags: [] as string[],
        keyInfo: {} as Record<string, string | null>,
      };

      // 如果有识别到文字，用LLM进行结构化分析
      if (ocrResult.text && ocrResult.text.trim()) {
        if (isLLMServiceAvailable()) {
          // 传递userId，让服务层检查AI服务设置
          const analysisResult = await analyzeOCRText(ocrResult.text, { userId });
          structuredResult.ticketType = analysisResult.ticketType || "其他";
          structuredResult.suggestedTitle = analysisResult.suggestedTitle || "";
          structuredResult.summary = analysisResult.summary || "";
          structuredResult.suggestedTags = analysisResult.suggestedTags || [];
          structuredResult.keyInfo = analysisResult.keyInfo || {};
        } else {
          console.warn("LLM服务不可用，跳过结构化分析");
          structuredResult.suggestedTags = ["其他"];
        }
      }

      res.json({
        success: true,
        result: structuredResult,
      });
    } catch (error) {
      console.error("本地OCR识别失败:", error);
      res.status(500).json({ error: "本地OCR识别失败" });
    } finally {
      // 清理临时文件
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // 忽略删除失败
        }
      }
    }
  }
);

export default router;
