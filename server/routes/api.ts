import { NextFunction, Request, Response, Router } from "express";
import { dashboardService } from "../brain/DashboardService.js";
import { ragService } from "../brain/knowledge/RagService.js";
import { memoryService } from "../brain/memory/MemoryService.js";
import { agentOrchestrator } from "../services/AgentOrchestrator.js";
import { voiceTelemetryService } from "../services/VoiceTelemetryService.js";
import { rateLimitService } from "../services/RateLimitService.js";
import { voiceReadinessService } from "../services/VoiceReadinessService.js";
import { rtcSessionService } from "../services/RtcSessionService.js";
import fs from 'fs';
import path from 'path';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';
const TELEMETRY_RATE_LIMIT = Number(process.env.TELEMETRY_RATE_LIMIT || 60);
const TELEMETRY_RATE_WINDOW_MS = Number(process.env.TELEMETRY_RATE_WINDOW_MS || 60 * 1000);
const RTC_SESSION_RATE_LIMIT = Number(process.env.RTC_SESSION_RATE_LIMIT || 20);
const RTC_SESSION_RATE_WINDOW_MS = Number(process.env.RTC_SESSION_RATE_WINDOW_MS || 60 * 1000);
const telemetryToken = process.env.VOICE_TELEMETRY_TOKEN || process.env.ADMIN_API_TOKEN || '';

const getRequestIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const requireTelemetryAccess = (req: Request, res: Response, next: NextFunction) => {
  const ip = getRequestIp(req);
  const rateResult = rateLimitService.check(
    `voice-telemetry:${ip}`,
    TELEMETRY_RATE_LIMIT,
    TELEMETRY_RATE_WINDOW_MS
  );
  if (!rateResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateResult.retryAfterMs || 1000) / 1000));
    res.status(429).json({ error: 'Too many telemetry requests' });
    return;
  }

  if (!isProduction) {
    next();
    return;
  }

  if (!telemetryToken) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const headerToken = req.headers['x-admin-token'];
  if (bearerToken === telemetryToken || headerToken === telemetryToken) {
    next();
    return;
  }

  res.status(403).json({ error: 'Forbidden' });
};

router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/brain/status", async (req, res) => {
  try {
    const status = await dashboardService.getBrainStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch brain status" });
  }
});

router.post("/rtc/session", (req, res) => {
  const ip = getRequestIp(req);
  const rateResult = rateLimitService.check(
    `rtc-session:${ip}`,
    RTC_SESSION_RATE_LIMIT,
    RTC_SESSION_RATE_WINDOW_MS
  );
  if (!rateResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateResult.retryAfterMs || 1000) / 1000));
    res.status(429).json({ error: 'Too many RTC session requests' });
    return;
  }

  res.json(rtcSessionService.createSession());
});

router.get("/voice/telemetry", requireTelemetryAccess, (req, res) => {
  const includeSnapshot = req.query.detail === '1' || req.query.detail === 'true';
  res.json({
    status: "ok",
    summary: voiceTelemetryService.getSummary(),
    ...(includeSnapshot ? { snapshot: voiceTelemetryService.getSnapshot() } : {}),
  });
});

router.get("/voice/readiness", requireTelemetryAccess, (req, res) => {
  const report = voiceReadinessService.getReport();
  const httpStatus = report.status === 'error' ? 503 : 200;
  res.status(httpStatus).json(report);
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

interface ConfigRouteInfo {
  filename: string;
  subDir: string;
  requiredKey: string | null;
}

const configRouteMap: Record<string, ConfigRouteInfo> = {
  'language': { filename: 'language_config.json', subDir: '', requiredKey: 'languages' },
  'mesh/behavior': { filename: 'mesh_behavior_config.json', subDir: '', requiredKey: 'meshes' },
  'mesh/material': { filename: 'mesh_material_config.json', subDir: '', requiredKey: 'materials' },
  'camera': { filename: 'camera_config.json', subDir: '', requiredKey: 'cameraKeyframesDesktop' },
  'voice': { filename: 'voice_config.json', subDir: 'live-voice', requiredKey: 'voiceMetadata' },
  'knowledge': { filename: 'knowledge_config.json', subDir: 'live-voice', requiredKey: 'sync_engine' },
  'knowledge-md': { filename: 'knowledge.md', subDir: 'live-voice', requiredKey: null }
};

router.all('/config/*', async (req: Request, res: Response) => {
  const pathSuffix = req.path.replace(/^\/config\//, '');
  const configInfo = configRouteMap[pathSuffix];
  if (!configInfo) {
    res.status(404).json({ error: `Unknown config type: ${pathSuffix}` });
    return;
  }

  const sourcePath = configInfo.subDir
    ? path.resolve(process.cwd(), 'src', 'translinkconfig', configInfo.subDir, configInfo.filename)
    : path.resolve(process.cwd(), 'src', 'translinkconfig', configInfo.filename);

  const buildPath = configInfo.subDir
    ? path.resolve(process.cwd(), 'dist', 'src', 'translinkconfig', configInfo.subDir, configInfo.filename)
    : path.resolve(process.cwd(), 'dist', 'src', 'translinkconfig', configInfo.filename);

  const backupSourcePath = sourcePath.replace(/(\.json|\.md)$/, '.backup$1');
  const backupBuildPath = buildPath.replace(/(\.json|\.md)$/, '.backup$1');

  if (req.method === 'GET') {
    try {
      let activePath = sourcePath;
      try {
        await fs.promises.access(sourcePath);
      } catch {
        activePath = buildPath;
      }

      const raw = await fs.promises.readFile(activePath, 'utf8');
      if (configInfo.requiredKey !== null) {
        res.setHeader('Content-Type', 'application/json');
      } else {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      res.status(200).send(raw);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      let writeContent = '';

      if (configInfo.requiredKey !== null) {
        let parsedBody = body;
        if (typeof body === 'string') {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            res.status(400).json({ error: 'Invalid JSON payload' });
            return;
          }
        }
        if (!parsedBody || typeof parsedBody !== 'object' || !parsedBody[configInfo.requiredKey]) {
          res.status(400).json({ error: `Invalid config payload: missing key '${configInfo.requiredKey}'` });
          return;
        }
        writeContent = JSON.stringify(parsedBody, null, 2);
      } else {
        writeContent = typeof body === 'string' ? body : JSON.stringify(body);
      }

      // 1. Back up original files if they exist
      try {
        await fs.promises.access(sourcePath);
        await fs.promises.copyFile(sourcePath, backupSourcePath);
      } catch {}

      try {
        await fs.promises.access(buildPath);
        await fs.promises.copyFile(buildPath, backupBuildPath);
      } catch {}

      // 2. Ensure directories exist
      await fs.promises.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.promises.mkdir(path.dirname(buildPath), { recursive: true });

      // 3. Write contents to both source and build directories
      await Promise.all([
        fs.promises.writeFile(sourcePath, writeContent, 'utf8'),
        fs.promises.writeFile(buildPath, writeContent, 'utf8')
      ]);

      // 4. If RAG files changed, rebuild RAG index immediately
      if (pathSuffix === 'knowledge-md' || pathSuffix === 'knowledge') {
        try {
          await ragService.rebuildIndex();
          console.log(`[Server] Rebuilt RAG index after CMS update to ${pathSuffix}.`);
        } catch (rerr) {
          console.error('[Server] RAG rebuild index failed after CMS update:', rerr);
        }
      }

      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
});

export default router;
