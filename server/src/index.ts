import express from "express";
import cors from "cors";
import { getConfigStatus } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import ticketsRoutes from "./routes/tickets.js";
import tagsRoutes from "./routes/tags.js";
import collectionsRoutes from "./routes/collections.js";
import ocrRoutes from "./routes/ocr.js";
import uploadRoutes from "./routes/upload.js";
import membershipRoutes from "./routes/membership.js";
import settingsRoutes from "./routes/settings.js";
import backupRoutes from "./routes/backup.js";
import feedbackRoutes from "./routes/feedback.js";
import imageRoutes from "./routes/image.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/tickets", ticketsRoutes);
app.use("/api/v1/tags", tagsRoutes);
app.use("/api/v1/collections", collectionsRoutes);
app.use("/api/v1/ocr", ocrRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/membership", membershipRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/backup", backupRoutes);
app.use("/api/v1/feedback", feedbackRoutes);
app.use("/api/v1/image", imageRoutes);

// 健康检查
app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// 配置状态检查（用于调试，不暴露敏感信息）
app.get('/api/v1/config-status', (req, res) => {
  const status = getConfigStatus();
  res.status(200).json({
    success: true,
    data: status,
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
