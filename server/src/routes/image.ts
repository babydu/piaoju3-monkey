import express, { type Request, type Response } from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { S3Storage } from 'coze-coding-dev-sdk';

const execAsync = promisify(exec);
const router = express.Router();

// 配置 multer 用于文件上传
const upload = multer({ 
  dest: '/tmp/image_processor/',
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

interface ProcessResult {
  success: boolean;
  image?: string;
  error?: string;
  edges_detected?: boolean;
  edges?: number[][];
  original_size?: { width: number; height: number };
  processed_size?: { width: number; height: number };
  info?: {
    best_strategy?: string;
    confidence?: number;
    all_strategies?: Array<{
      strategy: string;
      score: number;
      success: boolean;
    }>;
  };
}

/**
 * 执行新的文档扫描器脚本
 */
async function runDocumentScanner(args: string[]): Promise<ProcessResult> {
  const scriptPath = path.join(process.cwd(), 'scripts/document_scanner.py');
  
  // 对参数进行正确的 shell 转义处理
  const escapedArgs = args.map(arg => {
    // 如果参数包含空格、引号或特殊字符，需要用双引号包裹
    if (arg.includes(' ') || arg.includes('"') || arg.includes('[') || arg.includes('{')) {
      // 对内部的引号进行转义
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  }).join(' ');
  
  try {
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" ${escapedArgs}`,
      { maxBuffer: 50 * 1024 * 1024 } // 50MB buffer
    );
    
    if (stderr && !stderr.includes('warning')) {
      console.error('Document scanner stderr:', stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error: any) {
    console.error('Document scanner error:', error);
    // 回退到旧的图像处理器
    const oldScriptPath = path.join(process.cwd(), 'scripts/image_processor.py');
    try {
      const { stdout } = await execAsync(
        `python3 "${oldScriptPath}" ${escapedArgs}`,
        { maxBuffer: 50 * 1024 * 1024 }
      );
      return JSON.parse(stdout);
    } catch (fallbackError) {
      return {
        success: false,
        error: error.message || 'Document scanning failed'
      };
    }
  }
}

/**
 * 执行图像处理脚本（兼容旧接口）
 */
async function runImageProcessor(args: string[]): Promise<ProcessResult> {
  return runDocumentScanner(args);
}

/**
 * 将处理后的图片上传到对象存储
 */
async function uploadProcessedImage(buffer: Buffer, prefix: string): Promise<{ url: string; key: string }> {
  const key = `${prefix}/${Date.now()}.jpg`;
  
  const fileKey = await storage.uploadFile({
    fileContent: buffer,
    fileName: key,
    contentType: 'image/jpeg',
  });

  const signedUrl = await storage.generatePresignedUrl({
    key: fileKey,
    expireTime: 2592000, // 30天
  });

  return { url: signedUrl, key: fileKey };
}

/**
 * POST /api/v1/image/process
 * 处理票据图片
 * 
 * Body (multipart/form-data):
 * - image: 图片文件
 * - mode: 处理模式 (auto/enhance/binarize)
 */
router.post('/process', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const mode = req.body.mode || 'auto';
    const inputPath = req.file.path;

    console.log(`Processing image: ${inputPath}, mode: ${mode}`);

    // 调用 Python 脚本处理图片
    const result = await runImageProcessor(['process', inputPath, mode]);

    // 清理临时文件
    try {
      fs.unlinkSync(inputPath);
    } catch (e) {
      console.error('Failed to cleanup temp file:', e);
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Image processing failed' });
    }

    // 将处理后的图片上传到对象存储
    if (result.image) {
      const buffer = Buffer.from(result.image, 'base64');
      const { url, key } = await uploadProcessedImage(buffer, 'processed');
      
      return res.json({
        success: true,
        url,
        key,
        edgesDetected: result.edges_detected || false,
        edges: result.edges,
        originalSize: result.original_size,
        processedSize: result.processed_size
      });
    }

    return res.status(500).json({ error: 'No processed image returned' });
  } catch (error: any) {
    console.error('Image processing error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/v1/image/transform
 * 使用指定四个点进行透视矫正
 * 
 * Body (multipart/form-data):
 * - image: 图片文件
 * - points: 四个角点的 JSON 字符串 [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
 */
router.post('/transform', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!req.body.points) {
      return res.status(400).json({ error: 'No points provided' });
    }

    const inputPath = req.file.path;
    let points;
    
    try {
      points = JSON.parse(req.body.points);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid points format' });
    }

    console.log(`Transforming image with points:`, points);

    // 调用 Python 脚本进行透视矫正
    // 注意：不使用单引号包裹，直接传递 JSON 字符串（双引号已转义）
    const result = await runImageProcessor([
      'transform', 
      inputPath, 
      JSON.stringify(points)
    ]);

    // 清理临时文件
    try {
      fs.unlinkSync(inputPath);
    } catch (e) {
      console.error('Failed to cleanup temp file:', e);
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Image transformation failed' });
    }

    // 将处理后的图片上传到对象存储
    if (result.image) {
      const buffer = Buffer.from(result.image, 'base64');
      const { url, key } = await uploadProcessedImage(buffer, 'transformed');
      
      return res.json({
        success: true,
        url,
        key,
        originalSize: result.original_size,
        processedSize: result.processed_size
      });
    }

    return res.status(500).json({ error: 'No transformed image returned' });
  } catch (error: any) {
    console.error('Image transformation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/v1/image/base64-process
 * 使用 Base64 图片进行处理（适用于前端直接传递）
 * 
 * Body:
 * - image: Base64 编码的图片（可含 data:image/xxx;base64, 前缀）
 * - mode: 处理模式 (auto/enhance/binarize)
 */
router.post('/base64-process', async (req: Request, res: Response) => {
  try {
    const { image, mode = 'auto' } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // 将 Base64 保存为临时文件
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const buffer = Buffer.from(base64Data, 'base64');
    const tempPath = `/tmp/image_processor/${Date.now()}_input.jpg`;
    
    // 确保目录存在
    const dir = path.dirname(tempPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(tempPath, buffer);

    console.log(`Processing base64 image, mode: ${mode}`);

    // 调用 Python 脚本处理图片
    const result = await runImageProcessor(['process', tempPath, mode]);

    // 清理临时文件
    try {
      fs.unlinkSync(tempPath);
    } catch (e) {
      console.error('Failed to cleanup temp file:', e);
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Image processing failed' });
    }

    // 将处理后的图片上传到对象存储
    if (result.image) {
      const processedBuffer = Buffer.from(result.image, 'base64');
      const { url, key } = await uploadProcessedImage(processedBuffer, 'processed');
      
      return res.json({
        success: true,
        url,
        key,
        edgesDetected: result.edges_detected || false,
        edges: result.edges,
        originalSize: result.original_size,
        processedSize: result.processed_size
      });
    }

    return res.status(500).json({ error: 'No processed image returned' });
  } catch (error: any) {
    console.error('Base64 image processing error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/v1/image/detect-edges
 * 仅检测图片边缘（不进行透视矫正）
 * 
 * Body (multipart/form-data):
 * - image: 图片文件
 */
router.post('/detect-edges', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const inputPath = req.file.path;

    console.log(`Detecting edges for: ${inputPath}`);

    // 使用 auto 模式，但只返回边缘信息
    const result = await runImageProcessor(['process', inputPath, 'auto']);

    // 清理临时文件
    try {
      fs.unlinkSync(inputPath);
    } catch (e) {
      console.error('Failed to cleanup temp file:', e);
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Edge detection failed' });
    }

    return res.json({
      success: true,
      edgesDetected: result.edges_detected || false,
      edges: result.edges,
      originalSize: result.original_size
    });
  } catch (error: any) {
    console.error('Edge detection error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/v1/image/base64-detect-edges
 * 使用 Base64 图片进行边缘检测（仅返回边框坐标，不处理图片）
 * 
 * Body:
 * - image: Base64 编码的图片（可含 data:image/xxx;base64, 前缀）
 */
router.post('/base64-detect-edges', async (req: Request, res: Response) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // 将 Base64 保存为临时文件
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const buffer = Buffer.from(base64Data, 'base64');
    const tempPath = `/tmp/image_processor/${Date.now()}_detect.jpg`;
    
    // 确保目录存在
    const dir = path.dirname(tempPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(tempPath, buffer);

    console.log(`[Scanner] Detecting edges for base64 image`);

    // 使用新的文档扫描器进行边缘检测
    const result = await runDocumentScanner(['detect', tempPath]);

    // 清理临时文件
    try {
      fs.unlinkSync(tempPath);
    } catch (e) {
      console.error('Failed to cleanup temp file:', e);
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Edge detection failed' });
    }

    return res.json({
      success: true,
      edgesDetected: result.edges_detected || false,
      edges: result.edges,
      originalSize: result.original_size,
      info: result.info,
    });
  } catch (error: any) {
    console.error('Base64 edge detection error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/v1/image/base64-transform
 * 使用用户确认的四点坐标进行透视矫正
 * 
 * Body:
 * - image: Base64 编码的图片
 * - points: 四个角点的数组 [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
 */
router.post('/base64-transform', async (req: Request, res: Response) => {
  try {
    const { image, points } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    if (!points || !Array.isArray(points) || points.length !== 4) {
      return res.status(400).json({ error: 'Invalid points: need 4 corner points' });
    }

    // 将 Base64 保存为临时文件
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const buffer = Buffer.from(base64Data, 'base64');
    const tempPath = `/tmp/image_processor/${Date.now()}_transform.jpg`;
    
    // 确保目录存在
    const dir = path.dirname(tempPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(tempPath, buffer);

    console.log(`Transforming image with points:`, points);

    // 调用 Python 脚本进行透视矫正
    // 注意：不使用单引号包裹，直接传递 JSON 字符串（双引号已转义）
    const result = await runImageProcessor([
      'transform', 
      tempPath, 
      JSON.stringify(points)
    ]);

    // 清理临时文件
    try {
      fs.unlinkSync(tempPath);
    } catch (e) {
      console.error('Failed to cleanup temp file:', e);
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Image transformation failed' });
    }

    // 将处理后的图片上传到对象存储
    if (result.image) {
      const processedBuffer = Buffer.from(result.image, 'base64');
      const { url, key } = await uploadProcessedImage(processedBuffer, 'transformed');
      
      return res.json({
        success: true,
        url,
        key,
        originalSize: result.original_size,
        processedSize: result.processed_size
      });
    }

    return res.status(500).json({ error: 'No transformed image returned' });
  } catch (error: any) {
    console.error('Base64 transform error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
