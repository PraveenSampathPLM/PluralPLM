import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import multer from "multer";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";

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

    const docNumber = await allocateNextSequenceValue("DOCUMENT");
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
    res.setHeader("Content-Type", record.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename=\"${record.fileName}\"`);
    createReadStream(record.filePath).pipe(res);
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
