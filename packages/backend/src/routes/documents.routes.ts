import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import multer from "multer";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";
import { checkoutEntity, checkinEntity, undoCheckout } from "../services/versioning.service.js";

const router = Router();

const uploadDir = path.resolve(process.cwd(), "storage", "documents");

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

async function resolveReadableFilePath(storedPath: string): Promise<string | null> {
  const uniqueCandidates = Array.from(
    new Set([storedPath, path.resolve(process.cwd(), storedPath), path.resolve(process.cwd(), "..", storedPath)])
  );
  for (const candidate of uniqueCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

const createDocumentSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  containerId: z.string().optional(),
  docType: z.enum(["SDS", "TDS", "COA", "SPECIFICATION", "PROCESS", "QUALITY", "REGULATORY", "OTHER"]).optional(),
  status: z.enum(["DRAFT", "RELEASED", "OBSOLETE"]).optional()
});

const linkSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1)
});

async function ensureDocumentAccess(
  req: { user?: { sub: string; role: string } },
  containerId: string | null | undefined,
  action: "READ" | "WRITE"
): Promise<boolean> {
  const userId = req.user?.sub;
  if (!userId) {
    return false;
  }
  return ensureContainerAccess({
    userId,
    userRole: req.user?.role,
    containerId,
    entity: "DOCUMENT",
    action
  });
}

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const search = String(req.query.search ?? "").trim();
    const containerId = String(req.query.containerId ?? "").trim();
    const entityType = String(req.query.entityType ?? "").trim();
    const entityId = String(req.query.entityId ?? "").trim();

    const where: any = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { docNumber: { contains: search, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(entityType && entityId ? { links: { some: { entityType, entityId } } } : {})
    };

    if (!isGlobalAdmin(req.user?.role)) {
      const allowed = await getAccessibleContainerIds(userId, "DOCUMENT", "READ");
      where.OR = [
        ...(where.OR ?? []),
        { containerId: null },
        { containerId: { in: allowed } }
      ];
    }

    if (containerId) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { containerId }];
    }

    const [data, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: { owner: { select: { id: true, name: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.document.count({ where })
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "File is required" });
      return;
    }

    const parsed = createDocumentSchema.parse(req.body);
    const hasAccess = await ensureDocumentAccess(req, parsed.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "No write access to selected container." });
      return;
    }

    const docNumber = await allocateNextSequenceValue("DOCUMENT", parsed.containerId);
    const created = await prisma.document.create({
      data: {
        docNumber,
        name: parsed.name,
        description: parsed.description ?? null,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        docType: parsed.docType ?? "OTHER",
        status: parsed.status ?? "DRAFT",
        ownerId: actorId,
        ...(parsed.containerId ? { containerId: parsed.containerId } : {})
      }
    });

    await writeAuditLog({
      entityType: "DOCUMENT",
      entityId: created.id,
      action: "CREATE",
      actorId,
      payload: created
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const record = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { checkedOutBy: { select: { id: true, name: true } } }
    });
    if (!record) {
      res.status(404).json({ message: "Document not found" });
      return;
    }
    const hasAccess = await ensureDocumentAccess(req, record.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json(record);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/download", async (req, res, next) => {
  try {
    const record = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!record) {
      res.status(404).json({ message: "Document not found" });
      return;
    }
    const hasAccess = await ensureDocumentAccess(req, record.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const readablePath = await resolveReadableFilePath(record.filePath);
    if (!readablePath) {
      res.status(404).json({ message: "Document file is missing on server storage." });
      return;
    }
    res.setHeader("Content-Type", record.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename=\"${record.fileName}\"`);
    const stream = createReadStream(readablePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(404).json({ message: "Document file is missing on server storage." });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

const updateDocumentSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  docType: z.enum(["SDS", "TDS", "COA", "SPECIFICATION", "PROCESS", "QUALITY", "REGULATORY", "OTHER"]).optional(),
  status: z.enum(["DRAFT", "RELEASED", "OBSOLETE"]).optional()
});

router.put("/:id", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const record = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!record) { res.status(404).json({ message: "Document not found" }); return; }
    const hasAccess = await ensureDocumentAccess(req, record.containerId, "WRITE");
    if (!hasAccess) { res.status(403).json({ message: "Forbidden" }); return; }
    const parsed = updateDocumentSchema.parse(req.body);
    const updateData: Prisma.DocumentUpdateInput = {};
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.description !== undefined) updateData.description = parsed.description;
    if (parsed.docType !== undefined) updateData.docType = parsed.docType;
    if (parsed.status !== undefined) updateData.status = parsed.status;
    const updated = await prisma.document.update({ where: { id: req.params.id }, data: updateData });
    await writeAuditLog({ entityType: "DOCUMENT", entityId: updated.id, action: "UPDATE", actorId, payload: updated });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/link", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }
    const hasAccess = await ensureDocumentAccess(req, document.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const parsed = linkSchema.parse(req.body);
    const existing = await prisma.documentLink.findFirst({
      where: { documentId: document.id, entityType: parsed.entityType, entityId: parsed.entityId }
    });
    if (existing) {
      res.status(200).json(existing);
      return;
    }

    const link = await prisma.documentLink.create({
      data: {
        documentId: document.id,
        entityType: parsed.entityType,
        entityId: parsed.entityId
      }
    });

    await writeAuditLog({
      entityType: "DOCUMENT_LINK",
      entityId: link.id,
      action: "CREATE",
      actorId,
      payload: link
    });

    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
});

// Remove link by entity type+id (e.g. unlink from item)
router.delete("/:id/links/entity/:entityType/:entityId", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) { res.status(404).json({ message: "Document not found" }); return; }
    const hasAccess = await ensureDocumentAccess(req, document.containerId, "WRITE");
    if (!hasAccess) { res.status(403).json({ message: "Forbidden" }); return; }
    const link = await prisma.documentLink.findFirst({
      where: { documentId: document.id, entityType: req.params.entityType, entityId: req.params.entityId }
    });
    if (!link) { res.status(404).json({ message: "Link not found." }); return; }
    await prisma.documentLink.delete({ where: { id: link.id } });
    await writeAuditLog({ entityType: "DOCUMENT_LINK", entityId: link.id, action: "DELETE", actorId, payload: { linkId: link.id, entityType: link.entityType, entityId: link.entityId } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.delete("/:id/links/:linkId", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }
    const hasAccess = await ensureDocumentAccess(req, document.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const link = await prisma.documentLink.findFirst({
      where: { id: req.params.linkId, documentId: document.id }
    });
    if (!link) {
      res.status(404).json({ message: "Link not found." });
      return;
    }

    await prisma.documentLink.delete({ where: { id: req.params.linkId } });

    await writeAuditLog({
      entityType: "DOCUMENT_LINK",
      entityId: link.id,
      action: "DELETE",
      actorId,
      payload: { linkId: link.id, entityType: link.entityType, entityId: link.entityId }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/checkout", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const result = await checkoutEntity("DOCUMENT", req.params.id, userId);
    res.json(result);
  } catch (error: unknown) {
    const e = error as { statusCode?: number; message?: string };
    if (e.statusCode) { res.status(e.statusCode).json({ message: e.message }); return; }
    next(error);
  }
});

router.post("/:id/checkin", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const result = await checkinEntity("DOCUMENT", req.params.id, userId, req.body ?? {});
    res.json(result);
  } catch (error: unknown) {
    const e = error as { statusCode?: number; message?: string };
    if (e.statusCode) { res.status(e.statusCode).json({ message: e.message }); return; }
    next(error);
  }
});

router.post("/:id/undo-checkout", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    const userRole = req.user?.role ?? "";
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const isAdmin = ["System Admin", "PLM Admin", "Container Admin"].includes(userRole);
    const result = await undoCheckout("DOCUMENT", req.params.id, userId, isAdmin);
    res.json(result);
  } catch (error: unknown) {
    const e = error as { statusCode?: number; message?: string };
    if (e.statusCode) { res.status(e.statusCode).json({ message: e.message }); return; }
    next(error);
  }
});

router.get("/:id/links", async (req, res, next) => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }
    const hasAccess = await ensureDocumentAccess(req, document.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const links = await prisma.documentLink.findMany({ where: { documentId: document.id } });
    const itemIds = links.filter((link) => link.entityType === "ITEM").map((link) => link.entityId);
    const items = itemIds.length
      ? await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, itemCode: true, name: true } })
      : [];
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const enriched = links.map((link) => ({
      ...link,
      item: link.entityType === "ITEM" ? itemMap.get(link.entityId) ?? null : null
    }));
    res.json({ data: enriched });
  } catch (error) {
    next(error);
  }
});

export default router;
