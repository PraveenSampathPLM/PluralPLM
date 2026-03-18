import { Router } from "express";
import { AnnotationStatus, ArtworkComponentType, ArtworkFileType, ArtworkStatus, Prisma } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { writeAuditLog } from "../services/audit.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";

const router = Router();

const uploadDir = path.resolve(process.cwd(), "storage", "artworks");
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

const createArtworkSchema = z.object({
  title: z.string().min(2),
  brand: z.string().optional(),
  packSize: z.string().optional(),
  market: z.string().optional(),
  languageSet: z.array(z.string()).optional(),
  legalCopy: z.string().optional(),
  warnings: z.string().optional(),
  storageConditions: z.string().optional(),
  usageInstructions: z.string().optional(),
  claims: z.array(z.string()).optional(),
  status: z.nativeEnum(ArtworkStatus).optional(),
  fgItemId: z.string().optional(),
  packagingItemId: z.string().optional(),
  formulaId: z.string().optional(),
  releaseRequestId: z.string().optional(),
  containerId: z.string().optional()
});

const updateArtworkSchema = createArtworkSchema.partial();

const createComponentSchema = z.object({
  componentType: z.nativeEnum(ArtworkComponentType),
  name: z.string().min(1),
  dimensions: z.string().optional(),
  substrate: z.string().optional(),
  printProcess: z.string().optional(),
  variantKey: z.string().optional()
});

const updateComponentSchema = createComponentSchema.partial();

const createAnnotationSchema = z.object({
  annotation: z.string().min(1),
  coordinates: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1).optional(),
      height: z.number().min(0).max(1).optional(),
      page: z.number().int().min(1).optional()
    })
    .optional(),
  status: z.nativeEnum(AnnotationStatus).optional()
});

const updateAnnotationSchema = z.object({
  annotation: z.string().min(1).optional(),
  status: z.nativeEnum(AnnotationStatus).optional()
});

const linkSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1)
});

const statusSchema = z.object({
  status: z.nativeEnum(ArtworkStatus)
});

async function ensureArtworkAccess(
  req: { user?: { sub: string; role: string } },
  containerId: string | null | undefined,
  action: "READ" | "WRITE"
): Promise<boolean> {
  const userId = req.user?.sub;
  if (!userId) {
    return false;
  }
  // Reuse document permissions for artwork governance until dedicated ARTWORK permissions are introduced.
  return ensureContainerAccess({
    userId,
    userRole: req.user?.role,
    containerId,
    entity: "DOCUMENT",
    action
  });
}

router.get("/dashboard", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const containerId = String(req.query.containerId ?? "").trim();
    const where: { containerId?: string; OR?: Array<{ containerId: null } | { containerId: { in: string[] } }> } = {};
    if (!isGlobalAdmin(req.user?.role)) {
      const allowed = await getAccessibleContainerIds(userId, "DOCUMENT", "READ");
      where.OR = [{ containerId: null }, { containerId: { in: allowed } }];
    }
    if (containerId) {
      where.containerId = containerId;
    }

    const [rows, byStatus] = await Promise.all([
      prisma.artwork.findMany({
        where,
        select: { createdAt: true, status: true }
      }),
      prisma.artwork.groupBy({
        by: ["status"],
        where,
        _count: { _all: true }
      })
    ]);

    const months: Array<{ month: string; created: number; released: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const bucket = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${bucket.getFullYear()}-${String(bucket.getMonth() + 1).padStart(2, "0")}`;
      const created = rows.filter((row) => row.createdAt.getFullYear() === bucket.getFullYear() && row.createdAt.getMonth() === bucket.getMonth()).length;
      const released = rows.filter(
        (row) => row.status === ArtworkStatus.RELEASED && row.createdAt.getFullYear() === bucket.getFullYear() && row.createdAt.getMonth() === bucket.getMonth()
      ).length;
      months.push({ month: label, created, released });
    }

    res.json({
      kpis: {
        total: rows.length,
        released: rows.filter((row) => row.status === ArtworkStatus.RELEASED).length,
        review: rows.filter((row) => row.status === ArtworkStatus.REVIEW).length,
        draft: rows.filter((row) => row.status === ArtworkStatus.DRAFT).length
      },
      byStatus: byStatus.map((entry) => ({ status: entry.status, count: entry._count._all })),
      monthlyTrend: months
    });
  } catch (error) {
    next(error);
  }
});

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
    const status = String(req.query.status ?? "").trim();
    const containerId = String(req.query.containerId ?? "").trim();

    const where: {
      OR?: Array<{ title: { contains: string; mode: "insensitive" } } | { artworkCode: { contains: string; mode: "insensitive" } }>;
      status?: ArtworkStatus;
      containerId?: string;
      AND?: Array<{ OR: Array<{ containerId: null } | { containerId: { in: string[] } }> }>;
    } = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { artworkCode: { contains: search, mode: "insensitive" } }
      ];
    }
    if (status && Object.values(ArtworkStatus).includes(status as ArtworkStatus)) {
      where.status = status as ArtworkStatus;
    }
    if (containerId) {
      where.containerId = containerId;
    }
    if (!isGlobalAdmin(req.user?.role)) {
      const allowed = await getAccessibleContainerIds(userId, "DOCUMENT", "READ");
      where.AND = [{ OR: [{ containerId: null }, { containerId: { in: allowed } }] }];
    }

    const [data, total] = await Promise.all([
      prisma.artwork.findMany({
        where,
        include: {
          fgItem: { select: { id: true, itemCode: true, name: true } },
          formula: { select: { id: true, formulaCode: true, version: true, name: true } },
          _count: { select: { components: true, files: true, approvals: true } }
        },
        orderBy: [{ updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.artwork.count({ where })
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const parsed = createArtworkSchema.parse(req.body);
    const hasAccess = await ensureArtworkAccess(req, parsed.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "No write access to selected container." });
      return;
    }
    const artworkCode = await allocateNextSequenceValue("ARTWORK", parsed.containerId);
    const created = await prisma.artwork.create({
      data: {
        artworkCode,
        title: parsed.title,
        ...(parsed.brand ? { brand: parsed.brand } : {}),
        ...(parsed.packSize ? { packSize: parsed.packSize } : {}),
        ...(parsed.market ? { market: parsed.market } : {}),
        ...(parsed.languageSet ? { languageSet: parsed.languageSet } : {}),
        ...(parsed.legalCopy ? { legalCopy: parsed.legalCopy } : {}),
        ...(parsed.claims ? { claims: parsed.claims } : {}),
        ...(parsed.warnings ? { warnings: parsed.warnings } : {}),
        ...(parsed.storageConditions ? { storageConditions: parsed.storageConditions } : {}),
        ...(parsed.usageInstructions ? { usageInstructions: parsed.usageInstructions } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.fgItemId ? { fgItemId: parsed.fgItemId } : {}),
        ...(parsed.packagingItemId ? { packagingItemId: parsed.packagingItemId } : {}),
        ...(parsed.formulaId ? { formulaId: parsed.formulaId } : {}),
        ...(parsed.releaseRequestId ? { releaseRequestId: parsed.releaseRequestId } : {}),
        ...(parsed.containerId ? { containerId: parsed.containerId } : {}),
        ownerId: userId
      }
    });
    await writeAuditLog({ entityType: "ARTWORK", entityId: created.id, action: "CREATE", actorId: userId, payload: created });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const artwork = await prisma.artwork.findUnique({
      where: { id: req.params.id },
      include: {
        fgItem: { select: { id: true, itemCode: true, name: true } },
        packagingItem: { select: { id: true, itemCode: true, name: true } },
        formula: { select: { id: true, formulaCode: true, version: true, name: true } },
        releaseRequest: { select: { id: true, rrNumber: true, title: true, status: true } },
        components: {
          include: {
            files: {
              orderBy: { createdAt: "desc" },
              include: { annotations: { orderBy: { createdAt: "desc" } } }
            }
          },
          orderBy: { createdAt: "asc" }
        },
        files: {
          where: { artworkComponentId: null },
          orderBy: { createdAt: "desc" },
          include: { annotations: { orderBy: { createdAt: "desc" } } }
        },
        approvals: { orderBy: { createdAt: "asc" } },
        links: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json(artwork);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const existing = await prisma.artwork.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const parsed = updateArtworkSchema.parse(req.body);
    const updated = await prisma.artwork.update({
      where: { id: existing.id },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.brand !== undefined ? { brand: parsed.brand } : {}),
        ...(parsed.packSize !== undefined ? { packSize: parsed.packSize } : {}),
        ...(parsed.market !== undefined ? { market: parsed.market } : {}),
        ...(parsed.languageSet !== undefined ? { languageSet: parsed.languageSet } : {}),
        ...(parsed.legalCopy !== undefined ? { legalCopy: parsed.legalCopy } : {}),
        ...(parsed.claims !== undefined ? { claims: parsed.claims } : {}),
        ...(parsed.warnings !== undefined ? { warnings: parsed.warnings } : {}),
        ...(parsed.storageConditions !== undefined ? { storageConditions: parsed.storageConditions } : {}),
        ...(parsed.usageInstructions !== undefined ? { usageInstructions: parsed.usageInstructions } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.fgItemId !== undefined ? { fgItemId: parsed.fgItemId || null } : {}),
        ...(parsed.packagingItemId !== undefined ? { packagingItemId: parsed.packagingItemId || null } : {}),
        ...(parsed.formulaId !== undefined ? { formulaId: parsed.formulaId || null } : {}),
        ...(parsed.releaseRequestId !== undefined ? { releaseRequestId: parsed.releaseRequestId || null } : {}),
        ...(parsed.containerId !== undefined ? { containerId: parsed.containerId || null } : {})
      }
    });
    await writeAuditLog({ entityType: "ARTWORK", entityId: updated.id, action: "UPDATE", actorId: userId, payload: parsed });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/components", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const artwork = await prisma.artwork.findUnique({ where: { id: req.params.id } });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const parsed = createComponentSchema.parse(req.body);
    const created = await prisma.artworkComponent.create({
      data: {
        artworkId: artwork.id,
        componentType: parsed.componentType,
        name: parsed.name,
        ...(parsed.dimensions ? { dimensions: parsed.dimensions } : {}),
        ...(parsed.substrate ? { substrate: parsed.substrate } : {}),
        ...(parsed.printProcess ? { printProcess: parsed.printProcess } : {}),
        ...(parsed.variantKey ? { variantKey: parsed.variantKey } : {})
      }
    });
    await writeAuditLog({ entityType: "ARTWORK_COMPONENT", entityId: created.id, action: "CREATE", actorId: userId, payload: created });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put("/components/:componentId", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const component = await prisma.artworkComponent.findUnique({
      where: { id: req.params.componentId },
      include: { artwork: true }
    });
    if (!component) {
      res.status(404).json({ message: "Artwork component not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, component.artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const parsed = updateComponentSchema.parse(req.body);
    const updated = await prisma.artworkComponent.update({
      where: { id: component.id },
      data: {
        ...(parsed.componentType !== undefined ? { componentType: parsed.componentType } : {}),
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.dimensions !== undefined ? { dimensions: parsed.dimensions } : {}),
        ...(parsed.substrate !== undefined ? { substrate: parsed.substrate } : {}),
        ...(parsed.printProcess !== undefined ? { printProcess: parsed.printProcess } : {}),
        ...(parsed.variantKey !== undefined ? { variantKey: parsed.variantKey } : {})
      }
    });
    await writeAuditLog({ entityType: "ARTWORK_COMPONENT", entityId: updated.id, action: "UPDATE", actorId: userId, payload: parsed });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/components/:componentId", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const component = await prisma.artworkComponent.findUnique({
      where: { id: req.params.componentId },
      include: { artwork: true }
    });
    if (!component) {
      res.status(404).json({ message: "Artwork component not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, component.artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await prisma.artworkComponent.delete({ where: { id: component.id } });
    await writeAuditLog({ entityType: "ARTWORK_COMPONENT", entityId: component.id, action: "DELETE", actorId: userId, payload: component });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post("/:id/files", upload.single("file"), async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "File is required" });
      return;
    }
    const artwork = await prisma.artwork.findUnique({ where: { id: String(req.params.id ?? "") } });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const fileTypeRaw = String(req.body.fileType ?? "PROOF");
    const componentIdRaw = String(req.body.componentId ?? "").trim();
    const fileType = Object.values(ArtworkFileType).includes(fileTypeRaw as ArtworkFileType)
      ? (fileTypeRaw as ArtworkFileType)
      : ArtworkFileType.PROOF;

    if (componentIdRaw) {
      const component = await prisma.artworkComponent.findUnique({ where: { id: componentIdRaw } });
      if (!component || component.artworkId !== artwork.id) {
        res.status(400).json({ message: "Invalid componentId for this artwork." });
        return;
      }
    }

    const created = await prisma.artworkFile.create({
      data: {
        artworkId: artwork.id,
        ...(componentIdRaw ? { artworkComponentId: componentIdRaw } : {}),
        fileType,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedById: userId
      }
    });
    await writeAuditLog({ entityType: "ARTWORK_FILE", entityId: created.id, action: "UPLOAD", actorId: userId, payload: { fileType } });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get("/files/:fileId/download", async (req, res, next) => {
  try {
    const file = await prisma.artworkFile.findUnique({
      where: { id: req.params.fileId },
      include: { artwork: true }
    });
    if (!file) {
      res.status(404).json({ message: "Artwork file not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, file.artwork.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const readablePath = await resolveReadableFilePath(file.filePath);
    if (!readablePath) {
      res.status(404).json({ message: "Artwork file is missing on server storage." });
      return;
    }
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename=\"${file.fileName}\"`);
    const stream = createReadStream(readablePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(404).json({ message: "Artwork file is missing on server storage." });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/files/:fileId", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const file = await prisma.artworkFile.findUnique({
      where: { id: req.params.fileId },
      include: { artwork: true }
    });
    if (!file) {
      res.status(404).json({ message: "Artwork file not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, file.artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    await prisma.artworkFile.delete({ where: { id: file.id } });
    const readablePath = await resolveReadableFilePath(file.filePath);
    if (readablePath) {
      try {
        await fs.unlink(readablePath);
      } catch {
        // Best-effort file cleanup
      }
    }

    await writeAuditLog({
      entityType: "ARTWORK_FILE",
      entityId: file.id,
      action: "DELETE",
      actorId: userId,
      payload: { fileName: file.fileName, fileType: file.fileType }
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post("/files/:fileId/annotations", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const file = await prisma.artworkFile.findUnique({
      where: { id: req.params.fileId },
      include: { artwork: true }
    });
    if (!file) {
      res.status(404).json({ message: "Artwork file not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, file.artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const parsed = createAnnotationSchema.parse(req.body);
    const created = await prisma.artworkAnnotation.create({
      data: {
        artworkFileId: file.id,
        annotation: parsed.annotation,
        ...(parsed.coordinates ? { coordinates: parsed.coordinates } : {}),
        status: parsed.status ?? AnnotationStatus.OPEN,
        createdById: userId
      }
    });
    await writeAuditLog({ entityType: "ARTWORK_ANNOTATION", entityId: created.id, action: "CREATE", actorId: userId, payload: parsed });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put("/annotations/:annotationId", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const annotation = await prisma.artworkAnnotation.findUnique({
      where: { id: req.params.annotationId },
      include: { artworkFile: { include: { artwork: true } } }
    });
    if (!annotation) {
      res.status(404).json({ message: "Annotation not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, annotation.artworkFile.artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const parsed = updateAnnotationSchema.parse(req.body);
    const updated = await prisma.artworkAnnotation.update({
      where: { id: annotation.id },
      data: {
        ...(parsed.annotation !== undefined ? { annotation: parsed.annotation } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {})
      }
    });
    await writeAuditLog({ entityType: "ARTWORK_ANNOTATION", entityId: updated.id, action: "UPDATE", actorId: userId, payload: parsed });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/links", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const artwork = await prisma.artwork.findUnique({ where: { id: req.params.id } });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const parsed = linkSchema.parse(req.body);
    const existing = await prisma.artworkLink.findFirst({
      where: { artworkId: artwork.id, entityType: parsed.entityType, entityId: parsed.entityId }
    });
    if (existing) {
      res.json(existing);
      return;
    }
    const created = await prisma.artworkLink.create({
      data: { artworkId: artwork.id, entityType: parsed.entityType, entityId: parsed.entityId }
    });
    await writeAuditLog({ entityType: "ARTWORK_LINK", entityId: created.id, action: "CREATE", actorId: userId, payload: parsed });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/check-out", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const artwork = await prisma.artwork.findUnique({ where: { id: req.params.id } });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (artwork.status !== ArtworkStatus.DRAFT) {
      res.status(400).json({ message: "Only Draft artwork can be checked out." });
      return;
    }
    const updated = await prisma.artwork.update({ where: { id: artwork.id }, data: { status: ArtworkStatus.REVIEW } });
    await writeAuditLog({ entityType: "ARTWORK", entityId: updated.id, action: "CHECK_OUT", actorId: userId, payload: updated });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/check-in", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const artwork = await prisma.artwork.findUnique({ where: { id: req.params.id } });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (artwork.status !== ArtworkStatus.REVIEW) {
      res.status(400).json({ message: "Only artwork in Review can be checked in." });
      return;
    }
    const revisionIteration = artwork.revisionIteration + 1;
    const updated = await prisma.artwork.update({
      where: { id: artwork.id },
      data: {
        status: ArtworkStatus.APPROVED,
        revisionIteration,
        revisionLabel: `${artwork.revisionMajor}.${revisionIteration}`
      }
    });
    await writeAuditLog({ entityType: "ARTWORK", entityId: updated.id, action: "CHECK_IN", actorId: userId, payload: updated });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/revise", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const source = await prisma.artwork.findUnique({
      where: { id: req.params.id },
      include: {
        components: true,
        files: true,
        links: true,
        approvals: true
      }
    });
    if (!source) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const newMajor = source.revisionMajor + 1;
    const created = await prisma.artwork.create({
      data: {
        artworkCode: source.artworkCode,
        title: source.title,
        brand: source.brand,
        packSize: source.packSize,
        market: source.market,
        languageSet: source.languageSet === null ? Prisma.JsonNull : source.languageSet as Prisma.InputJsonValue,
        status: ArtworkStatus.DRAFT,
        revisionMajor: newMajor,
        revisionIteration: 1,
        revisionLabel: `${newMajor}.1`,
        legalCopy: source.legalCopy,
        claims: source.claims === null ? Prisma.JsonNull : source.claims as Prisma.InputJsonValue,
        warnings: source.warnings,
        storageConditions: source.storageConditions,
        usageInstructions: source.usageInstructions,
        fgItemId: source.fgItemId,
        packagingItemId: source.packagingItemId,
        formulaId: source.formulaId,
        releaseRequestId: source.releaseRequestId,
        containerId: source.containerId,
        ownerId: userId,
        components: {
          create: source.components.map((component) => ({
            componentType: component.componentType,
            name: component.name,
            dimensions: component.dimensions,
            substrate: component.substrate,
            printProcess: component.printProcess,
            variantKey: component.variantKey
          }))
        },
        links: {
          create: source.links.map((link) => ({
            entityType: link.entityType,
            entityId: link.entityId
          }))
        },
        approvals: {
          create: source.approvals.map((approval) => ({
            stage: approval.stage,
            approverRole: approval.approverRole,
            approverId: approval.approverId,
            decision: null,
            comment: null,
            decidedAt: null
          }))
        }
      }
    });
    await writeAuditLog({
      entityType: "ARTWORK",
      entityId: created.id,
      action: "REVISE",
      actorId: userId,
      payload: { sourceId: source.id, revisionLabel: created.revisionLabel }
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/copy", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const source = await prisma.artwork.findUnique({
      where: { id: req.params.id },
      include: {
        components: true,
        links: true
      }
    });
    if (!source) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const artworkCode = await allocateNextSequenceValue("ARTWORK", source.containerId);
    const created = await prisma.artwork.create({
      data: {
        artworkCode,
        title: `${source.title} Copy`,
        brand: source.brand,
        packSize: source.packSize,
        market: source.market,
        languageSet: source.languageSet === null ? Prisma.JsonNull : source.languageSet as Prisma.InputJsonValue,
        status: ArtworkStatus.DRAFT,
        revisionMajor: 1,
        revisionIteration: 1,
        revisionLabel: "1.1",
        legalCopy: source.legalCopy,
        claims: source.claims === null ? Prisma.JsonNull : source.claims as Prisma.InputJsonValue,
        warnings: source.warnings,
        storageConditions: source.storageConditions,
        usageInstructions: source.usageInstructions,
        fgItemId: source.fgItemId,
        packagingItemId: source.packagingItemId,
        formulaId: source.formulaId,
        releaseRequestId: source.releaseRequestId,
        containerId: source.containerId,
        ownerId: userId,
        components: {
          create: source.components.map((component) => ({
            componentType: component.componentType,
            name: component.name,
            dimensions: component.dimensions,
            substrate: component.substrate,
            printProcess: component.printProcess,
            variantKey: component.variantKey
          }))
        },
        links: {
          create: source.links.map((link) => ({
            entityType: link.entityType,
            entityId: link.entityId
          }))
        }
      }
    });
    await writeAuditLog({
      entityType: "ARTWORK",
      entityId: created.id,
      action: "COPY",
      actorId: userId,
      payload: { sourceId: source.id, artworkCode: created.artworkCode }
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const artwork = await prisma.artwork.findUnique({
      where: { id: req.params.id },
      include: {
        files: { select: { id: true, filePath: true } },
        components: { include: { files: { select: { id: true, filePath: true } } } }
      }
    });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await prisma.artwork.delete({ where: { id: artwork.id } });

    const filePaths = new Set<string>();
    for (const file of artwork.files) {
      filePaths.add(file.filePath);
    }
    for (const component of artwork.components) {
      for (const file of component.files) {
        filePaths.add(file.filePath);
      }
    }
    await Promise.all(
      Array.from(filePaths).map(async (filePath) => {
        try {
          await fs.unlink(filePath);
        } catch {
          // Best-effort cleanup; record deleted from DB already.
        }
      })
    );

    await writeAuditLog({ entityType: "ARTWORK", entityId: artwork.id, action: "DELETE", actorId: userId, payload: artwork });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/:id/compliance-check", async (req, res, next) => {
  try {
    const artwork = await prisma.artwork.findUnique({
      where: { id: req.params.id },
      include: {
        components: { include: { files: true } },
        formula: { include: { ingredients: { include: { item: true } } } }
      }
    });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const issues: Array<{ severity: "HIGH" | "MEDIUM" | "LOW"; code: string; message: string }> = [];
    if (!artwork.components.length) {
      issues.push({ severity: "HIGH", code: "NO_COMPONENTS", message: "No artwork components defined." });
    }
    if (!artwork.legalCopy?.trim()) {
      issues.push({ severity: "HIGH", code: "MISSING_LEGAL_COPY", message: "Legal copy is missing." });
    }
    if (!artwork.warnings?.trim()) {
      issues.push({ severity: "MEDIUM", code: "MISSING_WARNINGS", message: "Warnings/precaution text is missing." });
    }
    if (!artwork.claims || !Array.isArray(artwork.claims) || artwork.claims.length === 0) {
      issues.push({ severity: "MEDIUM", code: "NO_CLAIMS", message: "No approved claims attached." });
    }
    for (const component of artwork.components) {
      const hasProof = component.files.some((file) => file.fileType === ArtworkFileType.PROOF || file.fileType === ArtworkFileType.FINAL);
      if (!hasProof) {
        issues.push({
          severity: "MEDIUM",
          code: "MISSING_PROOF",
          message: `Component ${component.name} has no proof/final file.`
        });
      }
    }
    if (artwork.market && !artwork.languageSet) {
      issues.push({
        severity: "LOW",
        code: "MISSING_LANGUAGE_SET",
        message: "Market specified but language set is missing."
      });
    }
    if (artwork.formula && !artwork.formula.ingredients.length) {
      issues.push({
        severity: "LOW",
        code: "FORMULA_EMPTY",
        message: "Linked formula has no ingredients to derive declarations."
      });
    }

    res.json({
      artworkId: artwork.id,
      compliant: issues.filter((issue) => issue.severity === "HIGH").length === 0,
      issues
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/print-pack", async (req, res, next) => {
  try {
    const artwork = await prisma.artwork.findUnique({
      where: { id: req.params.id },
      include: {
        components: {
          include: { files: true }
        },
        files: true,
        approvals: true,
        fgItem: { select: { itemCode: true, name: true } },
        formula: { select: { formulaCode: true, version: true, name: true } }
      }
    });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const finalFiles = artwork.files.filter((file) => file.fileType === ArtworkFileType.FINAL);
    const componentFiles = artwork.components.map((component) => ({
      component: component.name,
      type: component.componentType,
      files: component.files.map((file) => ({
        id: file.id,
        fileType: file.fileType,
        fileName: file.fileName,
        createdAt: file.createdAt
      }))
    }));

    res.json({
      header: {
        artworkCode: artwork.artworkCode,
        revisionLabel: artwork.revisionLabel,
        status: artwork.status,
        title: artwork.title,
        market: artwork.market,
        brand: artwork.brand,
        packSize: artwork.packSize
      },
      product: {
        fgItem: artwork.fgItem,
        formula: artwork.formula
      },
      approvals: artwork.approvals,
      files: {
        artworkLevelFinalFiles: finalFiles,
        componentFiles
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/traceability", async (req, res, next) => {
  try {
    const artwork = await prisma.artwork.findUnique({
      where: { id: req.params.id },
      include: {
        fgItem: { select: { id: true, itemCode: true, name: true } },
        packagingItem: { select: { id: true, itemCode: true, name: true } },
        formula: { select: { id: true, formulaCode: true, version: true, name: true } },
        releaseRequest: { select: { id: true, rrNumber: true, title: true, status: true } },
        links: true
      }
    });
    if (!artwork) {
      res.status(404).json({ message: "Artwork not found" });
      return;
    }
    const hasAccess = await ensureArtworkAccess(req, artwork.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const [relatedArtworks, audit] = await Promise.all([
      prisma.artwork.findMany({
        where: {
          id: { not: artwork.id },
          OR: [
            ...(artwork.fgItemId ? [{ fgItemId: artwork.fgItemId }] : []),
            ...(artwork.packagingItemId ? [{ packagingItemId: artwork.packagingItemId }] : []),
            ...(artwork.formulaId ? [{ formulaId: artwork.formulaId }] : [])
          ]
        },
        select: { id: true, artworkCode: true, title: true, status: true, revisionLabel: true }
      }),
      prisma.auditLog.findMany({
        where: { entityType: "ARTWORK", entityId: artwork.id },
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);

    res.json({
      artwork: {
        id: artwork.id,
        artworkCode: artwork.artworkCode,
        title: artwork.title,
        status: artwork.status,
        revisionLabel: artwork.revisionLabel
      },
      directLinks: {
        fgItem: artwork.fgItem,
        packagingItem: artwork.packagingItem,
        formula: artwork.formula,
        releaseRequest: artwork.releaseRequest,
        objectLinks: artwork.links
      },
      relatedArtworks,
      history: audit
    });
  } catch (error) {
    next(error);
  }
});

export default router;
