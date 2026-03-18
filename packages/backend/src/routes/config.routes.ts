import { Router } from "express";
import os from "node:os";
import { z } from "zod";
import {
  addAttributeDefinition,
  allocateNextSequenceValue,
  peekNextSequenceValue,
  readAppConfig,
  readMailConfig,
  removeAttributeDefinition,
  updateMailConfig,
  updateUoms,
  updateListColumns,
  updateRevisionScheme,
  updateSequence
} from "../services/config-store.service.js";
import { authorize } from "../middleware/auth.middleware.js";
import { prisma } from "../services/prisma.js";

const entitySchema = z.enum(["ITEM", "ITEM_FINISHED_GOOD", "ITEM_PACKAGING", "FORMULA", "BOM", "CHANGE_REQUEST"]);
const attributeEntitySchema = z.enum(["ITEM"]);
const revisionEntitySchema = z.enum(["ITEM", "FORMULA", "BOM"]);
const listEntitySchema = z.enum(["ITEM", "FORMULA", "BOM", "CHANGE_REQUEST", "SPECIFICATION"]);

const sequenceSchema = z.object({
  prefix: z.string().min(1),
  padding: z.number().int().positive().max(10),
  next: z.number().int().positive()
});

const attributeSchema = z.object({
  entity: attributeEntitySchema,
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "boolean"]),
  required: z.boolean().default(false)
});

const revisionSchemeSchema = z.object({
  style: z.enum(["NUMERIC", "ALPHA_NUMERIC"]),
  delimiter: z.string().min(1).max(3)
});

const listColumnsSchema = z.object({
  columns: z.array(z.string().min(1)).min(1)
});

const uomSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1)
});

const mailSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean(),
  username: z.string().min(1),
  password: z.string().min(1),
  fromName: z.string().min(1),
  fromEmail: z.string().min(3)
});

const router = Router();

interface ServerStatsResponse {
  generatedAt: string;
  health: {
    api: "UP";
    database: "UP" | "DOWN";
    uptimeSec: number;
    nodeVersion: string;
  };
  resources: {
    systemMemory: { usedMb: number; totalMb: number; percent: number };
    processMemory: { rssMb: number; heapUsedMb: number; heapTotalMb: number; heapPercent: number };
    cpu: { load1: number; cores: number; percent: number };
    runtime: { platform: string; arch: string; pid: number };
  };
  logins: {
    last24hSuccess: number;
    last24hFailed: number;
    last7dSuccess: number;
    uniqueUsers7d: number;
    loginByRole: Array<{ role: string; count: number }>;
    loginsByDay: Array<{ day: string; success: number; failed: number }>;
    recentSuccess: Array<{ at: string; userId: string; email: string; name: string; role: string }>;
  };
}

async function buildServerStats(): Promise<ServerStatsResponse> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let database: "UP" | "DOWN" = "UP";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "DOWN";
  }

  const [auditRows, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        entityType: "AUTH",
        action: { in: ["LOGIN_SUCCESS", "LOGIN_FAILED"] },
        createdAt: { gte: sevenDaysAgo }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: { select: { name: true } } }
    })
  ]);

  const userMap = new Map(users.map((user) => [user.id, user]));
  const successRows = auditRows.filter((row) => row.action === "LOGIN_SUCCESS");
  const failedRows = auditRows.filter((row) => row.action === "LOGIN_FAILED");

  const last24hSuccess = successRows.filter((row) => row.createdAt >= oneDayAgo).length;
  const last24hFailed = failedRows.filter((row) => row.createdAt >= oneDayAgo).length;
  const uniqueUsers7d = new Set(successRows.map((row) => row.actorId).filter(Boolean)).size;

  const byRoleMap = new Map<string, number>();
  for (const row of successRows) {
    const roleName = row.actorId ? userMap.get(row.actorId)?.role.name : undefined;
    const key = roleName ?? "Unknown";
    byRoleMap.set(key, (byRoleMap.get(key) ?? 0) + 1);
  }
  const loginByRole = Array.from(byRoleMap.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);

  const byDayMap = new Map<string, { success: number; failed: number }>();
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    byDayMap.set(day, { success: 0, failed: 0 });
  }
  for (const row of auditRows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const current = byDayMap.get(day);
    if (!current) {
      continue;
    }
    if (row.action === "LOGIN_SUCCESS") {
      current.success += 1;
    } else {
      current.failed += 1;
    }
  }
  const loginsByDay = Array.from(byDayMap.entries()).map(([day, value]) => ({ day, ...value }));

  const recentSuccess = successRows.slice(0, 8).map((row) => {
    const user = row.actorId ? userMap.get(row.actorId) : undefined;
    return {
      at: row.createdAt.toISOString(),
      userId: row.actorId ?? "unknown",
      email: user?.email ?? "unknown",
      name: user?.name ?? "Unknown User",
      role: user?.role.name ?? "Unknown"
    };
  });

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  const load1 = os.loadavg()[0] ?? 0;
  const cores = os.cpus().length || 1;
  const cpuPercent = Math.min(100, Math.max(0, (load1 / cores) * 100));
  const processMem = process.memoryUsage();

  return {
    generatedAt: now.toISOString(),
    health: {
      api: "UP",
      database,
      uptimeSec: Math.floor(process.uptime()),
      nodeVersion: process.version
    },
    resources: {
      systemMemory: {
        usedMb: Math.round(usedMem / 1024 / 1024),
        totalMb: Math.round(totalMem / 1024 / 1024),
        percent: Number(((usedMem / Math.max(1, totalMem)) * 100).toFixed(1))
      },
      processMemory: {
        rssMb: Math.round(processMem.rss / 1024 / 1024),
        heapUsedMb: Math.round(processMem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(processMem.heapTotal / 1024 / 1024),
        heapPercent: Number(((processMem.heapUsed / Math.max(1, processMem.heapTotal)) * 100).toFixed(1))
      },
      cpu: {
        load1: Number(load1.toFixed(2)),
        cores,
        percent: Number(cpuPercent.toFixed(1))
      },
      runtime: {
        platform: os.platform(),
        arch: os.arch(),
        pid: process.pid
      }
    },
    logins: {
      last24hSuccess,
      last24hFailed,
      last7dSuccess: successRows.length,
      uniqueUsers7d,
      loginByRole,
      loginsByDay,
      recentSuccess
    }
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const config = await readAppConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

router.get("/next-number/:entity", async (req, res, next) => {
  try {
    const entity = entitySchema.parse(req.params.entity);
    const containerId = req.query.containerId ? String(req.query.containerId) : undefined;
    const value = await peekNextSequenceValue(entity, containerId);
    res.json({ entity, value });
  } catch (error) {
    next(error);
  }
});

router.get("/uoms", async (_req, res, next) => {
  try {
    const config = await readAppConfig();
    res.json({ data: config.uoms });
  } catch (error) {
    next(error);
  }
});

router.get("/mail", async (_req, res, next) => {
  try {
    const mail = await readMailConfig();
    res.json(mail);
  } catch (error) {
    next(error);
  }
});

router.get("/server-stats", authorize(["System Admin", "PLM Admin"]), async (_req, res, next) => {
  try {
    const stats = await buildServerStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get("/server-stats/stream", authorize(["System Admin", "PLM Admin"]), async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendStats = async (): Promise<void> => {
    try {
      const stats = await buildServerStats();
      res.write(`event: stats\n`);
      res.write(`data: ${JSON.stringify(stats)}\n\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load server stats";
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    }
  };

  await sendStats();

  const statsInterval = setInterval(() => {
    void sendStats();
  }, 2000);

  const heartbeatInterval = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(statsInterval);
    clearInterval(heartbeatInterval);
    res.end();
  });
});

router.put("/uoms", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const payload = z.array(uomSchema).min(1).parse(req.body);
    await updateUoms(payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put("/mail", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const payload = mailSchema.parse(req.body);
    await updateMailConfig(payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/next-number/:entity", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = entitySchema.parse(req.params.entity);
    const value = await allocateNextSequenceValue(entity);
    res.json({ entity, value });
  } catch (error) {
    next(error);
  }
});

router.put("/number-sequences/:entity", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = entitySchema.parse(req.params.entity);
    const payload = sequenceSchema.parse(req.body);
    await updateSequence(entity, payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put("/revision-schemes/:entity", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = revisionEntitySchema.parse(req.params.entity);
    const payload = revisionSchemeSchema.parse(req.body);
    await updateRevisionScheme(entity, payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put("/list-columns/:entity", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = listEntitySchema.parse(req.params.entity);
    const payload = listColumnsSchema.parse(req.body);
    await updateListColumns(entity, payload.columns);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/attributes", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const payload = attributeSchema.parse(req.body);
    await addAttributeDefinition(payload.entity, {
      key: payload.key,
      label: payload.label,
      type: payload.type,
      required: payload.required
    });
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.delete("/attributes/:entity/:key", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = attributeEntitySchema.parse(req.params.entity);
    const key = String(req.params.key ?? "");
    await removeAttributeDefinition(entity, key);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
