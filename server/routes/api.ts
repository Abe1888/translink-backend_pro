import { NextFunction, Request, Response, Router } from "express";
import { dashboardService } from "../brain/DashboardService.js";
import { ragService } from "../brain/knowledge/RagService.js";
import { memoryService } from "../brain/memory/MemoryService.js";
import { agentOrchestrator } from "../services/AgentOrchestrator.js";
import { voiceTelemetryService } from "../services/VoiceTelemetryService.js";
import { rateLimitService } from "../services/RateLimitService.js";
import { voiceReadinessService } from "../services/VoiceReadinessService.js";
import { rtcSessionService } from "../services/RtcSessionService.js";

import fs from "fs";
import path from "path";

const router = Router();

const isProduction = process.env.NODE_ENV === "production";

const TELEMETRY_RATE_LIMIT = Number(process.env.TELEMETRY_RATE_LIMIT || 60);
const TELEMETRY_RATE_WINDOW_MS = Number(process.env.TELEMETRY_RATE_WINDOW_MS || 60 * 1000);

const RTC_SESSION_RATE_LIMIT = Number(process.env.RTC_SESSION_RATE_LIMIT || 20);
const RTC_SESSION_RATE_WINDOW_MS = Number(process.env.RTC_SESSION_RATE_WINDOW_MS || 60 * 1000);

const telemetryToken = process.env.VOICE_TELEMETRY_TOKEN || process.env.ADMIN_API_TOKEN || "";

/**
 * FIX: safer IP resolver
 */
const getRequestIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(",")[0]?.trim() || "unknown";
  }

  return req.ip || req.socket.remoteAddress || "unknown";
};

/**
 * TELEMETRY GUARD (UNCHANGED LOGIC)
 */
const requireTelemetryAccess = (req: Request, res: Response, next: NextFunction) => {
  const ip = getRequestIp(req);

  const rateResult = rateLimitService.check(
    `voice-telemetry:${ip}`,
    TELEMETRY_RATE_LIMIT,
    TELEMETRY_RATE_WINDOW_MS
  );

  if (!rateResult.allowed) {
    res.setHeader("Retry-After", Math.ceil((rateResult.retryAfterMs || 1000) / 1000));
    res.status(429).json({ error: "Too many telemetry requests" });
    return;
  }

  if (!isProduction) {
    next();
    return;
  }

  if (!telemetryToken) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const headerToken = req.headers["x-admin-token"];

  if (bearerToken === telemetryToken || headerToken === telemetryToken) {
    next();
    return;
  }

  res.status(403).json({ error: "Forbidden" });
};

/**
 * HEALTH
 */
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * BRAIN STATUS
 */
router.get("/brain/status", async (req, res) => {
  try {
    const status = await dashboardService.getBrainStatus();
    res.json(status);
  } catch {
    res.status(500).json({ error: "Failed to fetch brain status" });
  }
});

/**
 * RTC SESSION
 */
router.post("/rtc/session", (req, res) => {
  const ip = getRequestIp(req);

  const rateResult = rateLimitService.check(
    `rtc-session:${ip}`,
    RTC_SESSION_RATE_LIMIT,
    RTC_SESSION_RATE_WINDOW_MS
  );

  if (!rateResult.allowed) {
    res.setHeader("Retry-After", Math.ceil((rateResult.retryAfterMs || 1000) / 1000));
    res.status(429).json({ error: "Too many RTC session requests" });
    return;
  }

  res.json(rtcSessionService.createSession());
});

/**
 * VOICE ENDPOINTS
 */
router.get("/voice/telemetry", requireTelemetryAccess, (req, res) => {
  const includeSnapshot =
    req.query.detail === "1" || req.query.detail === "true";

  res.json({
    status: "ok",
    summary: voiceTelemetryService.getSummary(),
    ...(includeSnapshot ? { snapshot: voiceTelemetryService.getSnapshot() } : {}),
  });
});

router.get("/voice/readiness", requireTelemetryAccess, (req, res) => {
  const report = voiceReadinessService.getReport();
  res.status(report.status === "error" ? 503 : 200).json(report);
});

router.get("/voice/memory", requireTelemetryAccess, (req, res) => {
  res.json({
    status: "ok",
    memory: memoryService.getStats(),
    retrieval: ragService.getStats(),
    orchestrator: agentOrchestrator.getStats(),
    rtc: rtcSessionService.getStats(),
  });
});

router.post("/voice/memory/cleanup", requireTelemetryAccess, (req, res) => {
  const requestedTtlMs = Number(req.body?.maxAgeMs);

  const removed = memoryService.cleanupExpiredSessions(
    Number.isFinite(requestedTtlMs) && requestedTtlMs > 0 ? requestedTtlMs : undefined
  );

  res.json({
    status: "ok",
    removed,
    memory: memoryService.getStats(),
  });
});

/**
 * CONFIG ROUTES
 */
interface ConfigRouteInfo {
  filename: string;
  subDir: string;
  requiredKey: string | null;
}

const configRouteMap: Record<string, ConfigRouteInfo> = {
  language: { filename: "language_config.json", subDir: "", requiredKey: "languages" },
  "mesh/behavior": { filename: "mesh_behavior_config.json", subDir: "", requiredKey: "meshes" },
  "mesh/material": { filename: "mesh_material_config.json", subDir: "", requiredKey: "materials" },
  camera: { filename: "camera_config.json", subDir: "", requiredKey: "cameraKeyframesDesktop" },
  voice: { filename: "voice_config.json", subDir: "live-voice", requiredKey: "voiceMetadata" },
  knowledge: { filename: "knowledge_config.json", subDir: "live-voice", requiredKey: "sync_engine" },
  "knowledge-md": { filename: "knowledge.md", subDir: "live-voice", requiredKey: null }
};

/**
 * FIX #1: Express-safe wildcard route
 * FIX #2: Type-safe param handling
 */
router.all("/config/:path(*)", async (req: Request, res: Response) => {
  try {
    const rawPath = req.params.path;
    const pathSuffix = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;

    const configInfo = configRouteMap[pathSuffix];

    if (!configInfo) {
      res.status(404).json({ error: `Unknown config type: ${pathSuffix}` });
      return;
    }

    const basePath = path.resolve(process.cwd(), "src", "translinkconfig");

    const sourcePath = path.resolve(
      basePath,
      configInfo.subDir,
      configInfo.filename
    );

    const buildPath = path.resolve(
      process.cwd(),
      "dist",
      "src",
      "translinkconfig",
      configInfo.subDir,
      configInfo.filename
    );

    const backupPath = sourcePath.replace(/(\.json|\.md)$/, ".backup$1");

    /**
     * GET (safe read)
     */
    if (req.method === "GET") {
      try {
        const activePath = fs.existsSync(sourcePath)
          ? sourcePath
          : buildPath;

        const raw = await fs.promises.readFile(activePath, "utf8");

        res.setHeader(
          "Content-Type",
          configInfo.requiredKey ? "application/json" : "text/plain"
        );

        res.status(200).send(raw);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }

      return;
    }

    /**
     * POST (safe write)
     */
    if (req.method === "POST") {
      try {
        const body = req.body;
        let writeContent = "";

        if (configInfo.requiredKey) {
          let parsed = body;

          if (typeof body === "string") {
            parsed = JSON.parse(body);
          }

          if (!parsed?.[configInfo.requiredKey]) {
            res.status(400).json({
              error: `Missing key '${configInfo.requiredKey}'`,
            });
            return;
          }

          writeContent = JSON.stringify(parsed, null, 2);
        } else {
          writeContent =
            typeof body === "string"
              ? body
              : JSON.stringify(body);
        }

        /**
         * backup
         */
        try {
          if (fs.existsSync(sourcePath)) {
            await fs.promises.copyFile(sourcePath, backupPath);
          }
        } catch { }

        /**
         * write ONLY ONE location (prevents heavy duplication)
         */
        await fs.promises.mkdir(path.dirname(sourcePath), { recursive: true });

        await fs.promises.writeFile(sourcePath, writeContent, "utf8");

        /**
         * NON-BLOCKING RAG (fix Gemini Live freeze)
         */
        if (pathSuffix === "knowledge" || pathSuffix === "knowledge-md") {
          setImmediate(() => {
            ragService.rebuildIndex().catch((err) => {
              console.error("[RAG rebuild failed]", err);
            });
          });
        }

        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }

      return;
    }

    res.status(405).json({ error: "Method Not Allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

export default router;