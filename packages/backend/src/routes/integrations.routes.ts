import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { createAdapter } from "../services/erp-adapter.service.js";

const router = Router();

/* ── Validation schemas ─────────────────────────────────────── */
const createSchema = z.object({
  name:         z.string().min(2),
  description:  z.string().optional(),
  erpType:      z.enum(["SAP_S4", "ORACLE_EBS", "ORACLE_FUSION", "DYNAMICS_365", "NETSUITE", "REST"]),
  baseUrl:      z.string().url(),
  authType:     z.enum(["API_KEY", "OAUTH2", "BASIC", "BEARER"]),
  credentials:  z.record(z.string()).default({}),
  syncEntities: z.array(z.string()).default([]),
  syncSchedule: z.string().optional(),
  containerId:  z.string().optional(),
});

const mappingSchema = z.object({
  entityType:    z.string(),
  direction:     z.enum(["PLM_TO_ERP", "ERP_TO_PLM", "BIDIRECTIONAL"]),
  plmField:      z.string(),
  erpField:      z.string(),
  transformRule: z.string().optional(),
  required:      z.boolean().default(false),
});

/* ── Default field mappings per ERP type ───────────────────── */
const DEFAULT_MAPPINGS: Record<string, Array<{ entityType: string; direction: string; plmField: string; erpField: string; required: boolean }>> = {
  SAP_S4: [
    { entityType: "ITEM",    direction: "PLM_TO_ERP", plmField: "itemCode",   erpField: "Material",           required: true  },
    { entityType: "ITEM",    direction: "PLM_TO_ERP", plmField: "name",       erpField: "MaterialDescription", required: true  },
    { entityType: "ITEM",    direction: "PLM_TO_ERP", plmField: "itemType",   erpField: "MaterialType",        required: false },
    { entityType: "ITEM",    direction: "PLM_TO_ERP", plmField: "status",     erpField: "MaterialStatus",      required: false },
    { entityType: "ITEM",    direction: "ERP_TO_PLM", plmField: "itemCode",   erpField: "MATNR",               required: true  },
    { entityType: "ITEM",    direction: "ERP_TO_PLM", plmField: "name",       erpField: "MAKTX",               required: true  },
    { entityType: "FORMULA", direction: "PLM_TO_ERP", plmField: "formulaCode",erpField: "RecipeNumber",        required: true  },
    { entityType: "FORMULA", direction: "PLM_TO_ERP", plmField: "name",       erpField: "RecipeDescription",   required: true  },
  ],
  ORACLE_EBS: [
    { entityType: "ITEM", direction: "PLM_TO_ERP", plmField: "itemCode", erpField: "SEGMENT1",     required: true  },
    { entityType: "ITEM", direction: "PLM_TO_ERP", plmField: "name",     erpField: "DESCRIPTION",  required: true  },
    { entityType: "ITEM", direction: "ERP_TO_PLM", plmField: "itemCode", erpField: "SEGMENT1",     required: true  },
    { entityType: "ITEM", direction: "ERP_TO_PLM", plmField: "name",     erpField: "DESCRIPTION",  required: true  },
  ],
  DYNAMICS_365: [
    { entityType: "ITEM", direction: "PLM_TO_ERP", plmField: "itemCode", erpField: "productnumber", required: true  },
    { entityType: "ITEM", direction: "PLM_TO_ERP", plmField: "name",     erpField: "name",          required: true  },
    { entityType: "ITEM", direction: "ERP_TO_PLM", plmField: "itemCode", erpField: "productnumber", required: true  },
    { entityType: "ITEM", direction: "ERP_TO_PLM", plmField: "name",     erpField: "name",          required: true  },
  ],
  NETSUITE: [
    { entityType: "ITEM", direction: "PLM_TO_ERP", plmField: "itemCode", erpField: "itemId",      required: true  },
    { entityType: "ITEM", direction: "PLM_TO_ERP", plmField: "name",     erpField: "displayName", required: true  },
    { entityType: "ITEM", direction: "ERP_TO_PLM", plmField: "itemCode", erpField: "itemId",      required: true  },
    { entityType: "ITEM", direction: "ERP_TO_PLM", plmField: "name",     erpField: "displayName", required: true  },
  ],
  REST: [
    { entityType: "ITEM", direction: "BIDIRECTIONAL", plmField: "itemCode", erpField: "code", required: true  },
    { entityType: "ITEM", direction: "BIDIRECTIONAL", plmField: "name",     erpField: "name", required: true  },
  ],
};

/* ── GET / — list all integrations ─────────────────────────── */
router.get("/", async (req, res, next) => {
  try {
    const { containerId } = req.query as Record<string, string>;
    const integrations = await prisma.erpIntegration.findMany({
      where: containerId ? { containerId } : {},
      include: { _count: { select: { mappings: true, syncLogs: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: integrations });
  } catch (err) { next(err); }
});

/* ── POST / — create integration ────────────────────────────── */
router.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const integration = await prisma.erpIntegration.create({
      data: {
        name:         body.name,
        description:  body.description ?? null,
        erpType:      body.erpType,
        baseUrl:      body.baseUrl,
        authType:     body.authType,
        credentials:  body.credentials,
        syncEntities: body.syncEntities,
        syncSchedule: body.syncSchedule ?? null,
        containerId:  body.containerId ?? null,
      },
    });
    // Seed default mappings
    const defaults = DEFAULT_MAPPINGS[body.erpType] ?? DEFAULT_MAPPINGS["REST"] ?? [];
    if (defaults.length) {
      await prisma.erpFieldMapping.createMany({
        data: defaults.map((m) => ({ ...m, integrationId: integration.id, transformRule: null })),
      });
    }
    res.status(201).json(integration);
  } catch (err) { next(err); }
});

/* ── GET /:id — single integration ─────────────────────────── */
router.get("/:id", async (req, res, next) => {
  try {
    const integration = await prisma.erpIntegration.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { mappings: { orderBy: [{ entityType: "asc" }, { plmField: "asc" }] } },
    });
    res.json(integration);
  } catch (err) { next(err); }
});

/* ── PUT /:id — update integration ─────────────────────────── */
router.put("/:id", async (req, res, next) => {
  try {
    const body = createSchema.partial().parse(req.body);
    // Build update payload, only including provided fields with null coercion
    const updateData: Record<string, unknown> = {};
    if (body.name        !== undefined) updateData.name        = body.name;
    if (body.description !== undefined) updateData.description = body.description ?? null;
    if (body.baseUrl     !== undefined) updateData.baseUrl     = body.baseUrl;
    if (body.erpType     !== undefined) updateData.erpType     = body.erpType;
    if (body.authType    !== undefined) updateData.authType    = body.authType;
    if (body.credentials !== undefined) updateData.credentials = body.credentials;
    if (body.syncEntities!== undefined) updateData.syncEntities= body.syncEntities;
    if (body.syncSchedule!== undefined) updateData.syncSchedule= body.syncSchedule ?? null;
    if (body.containerId !== undefined) updateData.containerId = body.containerId  ?? null;
    const updated = await prisma.erpIntegration.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(updated);
  } catch (err) { next(err); }
});

/* ── DELETE /:id ────────────────────────────────────────────── */
router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.erpIntegration.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

/* ── POST /:id/test — test connection ───────────────────────── */
router.post("/:id/test", async (req, res, next) => {
  try {
    const integration = await prisma.erpIntegration.findUniqueOrThrow({ where: { id: req.params.id } });
    const adapter = createAdapter(
      integration.erpType, integration.baseUrl, integration.authType,
      integration.credentials as Record<string, string>
    );
    const result = await adapter.testConnection();
    // Update status in DB based on result
    await prisma.erpIntegration.update({
      where: { id: req.params.id },
      data: { status: result.success ? "ACTIVE" : "ERROR" },
    });
    res.json(result);
  } catch (err) { next(err); }
});

/* ── POST /:id/sync — trigger sync ─────────────────────────── */
router.post("/:id/sync", async (req, res, next) => {
  try {
    const { entityType = "ITEM", direction = "PUSH" } = req.body as { entityType?: string; direction?: string };
    const userId = (req as unknown as { user?: { id?: string } }).user?.id;
    const integration = await prisma.erpIntegration.findUniqueOrThrow({ where: { id: req.params.id } });

    // Create a running log entry
    const log = await prisma.erpSyncLog.create({
      data: {
        integrationId: req.params.id,
        direction, entityType,
        status: "RUNNING",
        triggeredBy: userId ?? "manual",
      },
    });

    const adapter = createAdapter(
      integration.erpType, integration.baseUrl, integration.authType,
      integration.credentials as Record<string, string>
    );

    let syncResult = { total: 0, synced: 0, failed: 0, errors: [] as Array<{ id: string; message: string }> };
    let errorMessage: string | undefined;

    try {
      if (direction === "PUSH" && entityType === "ITEM") {
        const cId = integration.containerId;
        const items = await prisma.item.findMany({
          where: { ...(cId ? { containerId: cId } : {}), status: "RELEASED" },
          take: 500,
        });
        const externalItems = items.map((i) => ({
          externalId: i.id, itemCode: i.itemCode, name: i.name,
          type: i.itemType, status: i.status,
        }));
        syncResult = await adapter.pushItems(externalItems);
      } else if (direction === "PULL" && entityType === "ITEM") {
        const pulled = await adapter.pullItems();
        syncResult = { total: pulled.length, synced: pulled.length, failed: 0, errors: [] };
      } else if (direction === "PUSH" && entityType === "FORMULA") {
        const cId = integration.containerId;
        const formulas = await prisma.formula.findMany({
          where: { ...(cId ? { containerId: cId } : {}), status: "RELEASED" },
          include: { ingredients: { include: { item: true } } },
          take: 200,
        });
        const externalFormulas = formulas.map((f) => ({
          externalId: f.id, formulaCode: f.formulaCode, name: f.name,
          outputItem: f.id, version: f.revisionLabel,
          ingredients: f.ingredients.map((i) => ({ itemCode: i.item?.itemCode ?? "", percentage: Number(i.percentage), uom: i.uom ?? "" })),
        }));
        syncResult = await adapter.pushFormulas(externalFormulas);
      }
    } catch (err: unknown) {
      errorMessage = (err as Error).message;
    }

    const finalStatus = errorMessage ? "FAILED" : syncResult.failed > 0 && syncResult.synced > 0 ? "PARTIAL" : syncResult.failed > 0 ? "FAILED" : "SUCCESS";

    const logUpdate: Record<string, unknown> = {
      status: finalStatus, recordsTotal: syncResult.total,
      recordsSynced: syncResult.synced, recordsFailed: syncResult.failed,
      errorMessage: errorMessage ?? null, completedAt: new Date(),
    };
    if (syncResult.errors.length) logUpdate.details = { errors: syncResult.errors };
    const updatedLog = await prisma.erpSyncLog.update({ where: { id: log.id }, data: logUpdate });

    await prisma.erpIntegration.update({
      where: { id: req.params.id },
      data: { lastSyncAt: new Date(), status: finalStatus === "FAILED" ? "ERROR" : "ACTIVE" },
    });

    res.json(updatedLog);
  } catch (err) { next(err); }
});

/* ── GET /:id/logs — sync history ───────────────────────────── */
router.get("/:id/logs", async (req, res, next) => {
  try {
    const page = parseInt((req.query.page as string) ?? "1");
    const pageSize = parseInt((req.query.pageSize as string) ?? "20");
    const [total, logs] = await prisma.$transaction([
      prisma.erpSyncLog.count({ where: { integrationId: req.params.id } }),
      prisma.erpSyncLog.findMany({
        where: { integrationId: req.params.id },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    res.json({ data: logs, total, page, pageSize });
  } catch (err) { next(err); }
});

/* ── GET /:id/mappings ──────────────────────────────────────── */
router.get("/:id/mappings", async (req, res, next) => {
  try {
    const mappings = await prisma.erpFieldMapping.findMany({
      where: { integrationId: req.params.id },
      orderBy: [{ entityType: "asc" }, { plmField: "asc" }],
    });
    res.json({ data: mappings });
  } catch (err) { next(err); }
});

/* ── PUT /:id/mappings — bulk upsert mappings ───────────────── */
router.put("/:id/mappings", async (req, res, next) => {
  try {
    const body = z.object({ mappings: z.array(mappingSchema) }).parse(req.body);
    await prisma.erpFieldMapping.deleteMany({ where: { integrationId: req.params.id } });
    if (body.mappings.length) {
      await prisma.erpFieldMapping.createMany({
        data: body.mappings.map((m) => ({ ...m, integrationId: req.params.id, transformRule: m.transformRule ?? null })),
      });
    }
    const updated = await prisma.erpFieldMapping.findMany({ where: { integrationId: req.params.id } });
    res.json({ data: updated });
  } catch (err) { next(err); }
});

export default router;
