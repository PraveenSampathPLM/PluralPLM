import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { formatRevisionLabel, getRevisionScheme } from "../services/revision.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";
import { checkoutEntity, checkinEntity, undoCheckout } from "../services/versioning.service.js";

const router = Router();

const packagingLineSchema = z.object({
  lineNumber: z.number().int().positive().optional(),
  itemId: z.string().min(1),
  quantity: z.number().positive(),
  uom: z.string().min(1)
});

const createFgSchema = z.object({
  fgItemId: z.string().min(1),
  formulaId: z.string().min(1),
  containerId: z.string().optional(),
  effectiveDate: z.string().optional(),
  packagingLines: z.array(packagingLineSchema).default([])
});

const updatePackagingSchema = z.object({
  packagingLines: z.array(packagingLineSchema)
});

async function ensureFgAccess(
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
    entity: "ITEM",
    action
  });
}

async function validateFgBusinessRules(fgItemId: string, formulaId: string): Promise<void> {
  const [fgItem, formula] = await Promise.all([
    prisma.item.findUnique({ where: { id: fgItemId }, select: { id: true, itemType: true } }),
    prisma.formula.findUnique({ where: { id: formulaId }, select: { id: true } })
  ]);

  if (!fgItem || fgItem.itemType !== "FINISHED_GOOD") {
    throw new Error("FG Item must be of type Finished Good.");
  }
  if (!formula) {
    throw new Error("Formula not found.");
  }
}

// GET /api/fg
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const containerId = String(req.query.containerId ?? "").trim();
    const fgItemId = String(req.query.fgItemId ?? "").trim();

    const baseWhere = {};
    const where = !isGlobalAdmin(req.user?.role)
      ? {
          ...baseWhere,
          AND: [
            {
              OR: [{ containerId: null }, { containerId: { in: await getAccessibleContainerIds(userId, "ITEM", "READ") } }]
            }
          ]
        }
      : baseWhere;
    if (containerId) {
      Object.assign(where, { AND: [...((where as { AND?: unknown[] }).AND ?? []), { containerId }] });
    }
    if (fgItemId) {
      Object.assign(where, { AND: [...((where as { AND?: unknown[] }).AND ?? []), { fgItemId }] });
    }

    const [data, total] = await Promise.all([
      prisma.fGStructure.findMany({
        where,
        include: {
          fgItem: { select: { id: true, itemCode: true, name: true, itemType: true } },
          formula: { select: { id: true, formulaCode: true, version: true, name: true, status: true } },
          packagingLines: { include: { item: { select: { id: true, itemCode: true, name: true } } } }
        },
        orderBy: [{ fgItem: { itemCode: "asc" } }, { version: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.fGStructure.count({ where })
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

// POST /api/fg
router.post("/", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const parsed = createFgSchema.parse(req.body);
    const hasAccess = await ensureFgAccess(req, parsed.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "No write access to selected container." });
      return;
    }

    await validateFgBusinessRules(parsed.fgItemId, parsed.formulaId);

    // Validate packaging items
    if (parsed.packagingLines.length > 0) {
      const pkgItems = await prisma.item.findMany({
        where: { id: { in: parsed.packagingLines.map((l) => l.itemId) } },
        select: { id: true, itemType: true }
      });
      for (const line of parsed.packagingLines) {
        const item = pkgItems.find((i) => i.id === line.itemId);
        if (!item) {
          throw new Error(`Packaging item ${line.itemId} not found.`);
        }
        if (item.itemType !== "PACKAGING") {
          throw new Error(`Item ${line.itemId} must be of type PACKAGING.`);
        }
      }
    }

    const revisionScheme = await getRevisionScheme("BOM");
    const existingVersions = await prisma.fGStructure.findMany({
      where: { fgItemId: parsed.fgItemId },
      orderBy: { version: "desc" },
      take: 1
    });
    const version = existingVersions.length > 0 ? existingVersions[0]!.version + 1 : 1;

    const created = await prisma.fGStructure.create({
      data: {
        fgItem: { connect: { id: parsed.fgItemId } },
        formula: { connect: { id: parsed.formulaId } },
        version,
        revisionMajor: version,
        revisionIteration: 1,
        revisionLabel: formatRevisionLabel(version, 1, revisionScheme),
        status: "IN_WORK",
        ...(parsed.containerId ? { container: { connect: { id: parsed.containerId } } } : {}),
        ...(parsed.effectiveDate ? { effectiveDate: new Date(parsed.effectiveDate) } : {}),
        packagingLines: {
          create: parsed.packagingLines.map((line, idx) => ({
            item: { connect: { id: line.itemId } },
            lineNumber: line.lineNumber ?? (idx + 1) * 10,
            quantity: line.quantity,
            uom: line.uom
          }))
        }
      },
      include: {
        fgItem: true,
        formula: true,
        packagingLines: { include: { item: true } }
      }
    });

    await writeAuditLog({
      entityType: "FG_STRUCTURE",
      entityId: created.id,
      action: "CREATE",
      actorId: userId,
      payload: created
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

// GET /api/fg/:id
router.get("/:id", async (req, res, next) => {
  try {
    const fg = await prisma.fGStructure.findUnique({
      where: { id: req.params.id },
      include: {
        fgItem: { select: { id: true, itemCode: true, name: true, itemType: true, industryType: true } },
        formula: { select: { id: true, formulaCode: true, version: true, name: true, status: true } },
        packagingLines: { include: { item: { select: { id: true, itemCode: true, name: true } } } },
        checkedOutBy: { select: { id: true, name: true } }
      }
    });
    if (!fg) {
      res.status(404).json({ message: "Finished Good structure not found" });
      return;
    }
    const hasAccess = await ensureFgAccess(req, fg.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json(fg);
  } catch (error) {
    next(error);
  }
});

// GET /api/fg/:id/history
router.get("/:id/history", async (req, res, next) => {
  try {
    const fg = await prisma.fGStructure.findUnique({ where: { id: req.params.id } });
    if (!fg) {
      res.status(404).json({ message: "Finished Good structure not found" });
      return;
    }
    const hasAccess = await ensureFgAccess(req, fg.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const history = await prisma.fGStructure.findMany({
      where: { fgItemId: fg.fgItemId },
      include: {
        fgItem: { select: { id: true, itemCode: true, name: true } },
        formula: { select: { id: true, formulaCode: true, version: true, name: true } }
      },
      orderBy: { version: "desc" }
    });
    res.json({ currentId: fg.id, history });
  } catch (error) {
    next(error);
  }
});

// PUT /api/fg/:id/packaging
router.put("/:id/packaging", async (req, res, next) => {
  try {
    const fgId = String(req.params.id ?? "");
    const parsed = updatePackagingSchema.parse(req.body);

    const existing = await prisma.fGStructure.findUnique({ where: { id: fgId } });
    if (!existing) {
      res.status(404).json({ message: "Finished Good structure not found" });
      return;
    }
    if (existing.status !== "IN_WORK") {
      res.status(400).json({ message: "Only IN_WORK structures can be edited." });
      return;
    }
    const hasAccess = await ensureFgAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // Validate packaging items
    if (parsed.packagingLines.length > 0) {
      const pkgItems = await prisma.item.findMany({
        where: { id: { in: parsed.packagingLines.map((l) => l.itemId) } },
        select: { id: true, itemType: true }
      });
      for (const line of parsed.packagingLines) {
        const item = pkgItems.find((i) => i.id === line.itemId);
        if (!item) {
          throw new Error(`Packaging item ${line.itemId} not found.`);
        }
        if (item.itemType !== "PACKAGING") {
          throw new Error(`Item ${line.itemId} must be of type PACKAGING.`);
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.fGPackagingLine.deleteMany({ where: { fgStructureId: fgId } });
      if (parsed.packagingLines.length > 0) {
        await tx.fGPackagingLine.createMany({
          data: parsed.packagingLines.map((line, idx) => ({
            fgStructureId: fgId,
            itemId: line.itemId,
            lineNumber: line.lineNumber ?? (idx + 1) * 10,
            quantity: line.quantity,
            uom: line.uom
          }))
        });
      }
      return tx.fGStructure.findUnique({
        where: { id: fgId },
        include: {
          fgItem: true,
          formula: true,
          packagingLines: { include: { item: true } }
        }
      });
    });

    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FG_STRUCTURE",
      entityId: fgId,
      action: "UPDATE_PACKAGING",
      ...(actorId ? { actorId } : {}),
      payload: { lineCount: parsed.packagingLines.length }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// POST /api/fg/:id/check-out
router.post("/:id/check-out", async (req, res, next) => {
  try {
    const fgId = String(req.params.id ?? "");
    const existing = await prisma.fGStructure.findUnique({ where: { id: fgId } });
    if (!existing) {
      res.status(404).json({ message: "Finished Good structure not found" });
      return;
    }
    if (existing.status !== "IN_WORK") {
      res.status(400).json({ message: "Only IN_WORK structures can be checked out." });
      return;
    }
    const hasAccess = await ensureFgAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const updated = await prisma.fGStructure.update({
      where: { id: fgId },
      data: { status: "UNDER_REVIEW" }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FG_STRUCTURE",
      entityId: updated.id,
      action: "CHECK_OUT",
      ...(actorId ? { actorId } : {}),
      payload: updated
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// POST /api/fg/:id/check-in
router.post("/:id/check-in", async (req, res, next) => {
  try {
    const fgId = String(req.params.id ?? "");
    const existing = await prisma.fGStructure.findUnique({ where: { id: fgId } });
    if (!existing) {
      res.status(404).json({ message: "Finished Good structure not found" });
      return;
    }
    if (existing.status !== "UNDER_REVIEW") {
      res.status(400).json({ message: "Only structures under review can be checked in." });
      return;
    }
    const hasAccess = await ensureFgAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const revisionScheme = await getRevisionScheme("BOM");
    const revisionMajor = existing.revisionMajor;
    const revisionIteration = existing.revisionIteration + 1;
    const updated = await prisma.fGStructure.update({
      where: { id: fgId },
      data: {
        status: "RELEASED",
        revisionIteration,
        revisionLabel: formatRevisionLabel(revisionMajor, revisionIteration, revisionScheme)
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FG_STRUCTURE",
      entityId: updated.id,
      action: "CHECK_IN",
      ...(actorId ? { actorId } : {}),
      payload: updated
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// POST /api/fg/:id/revise
router.post("/:id/revise", async (req, res, next) => {
  try {
    const fgId = String(req.params.id ?? "");
    const source = await prisma.fGStructure.findUnique({
      where: { id: fgId },
      include: { packagingLines: true }
    });
    if (!source) {
      res.status(404).json({ message: "Finished Good structure not found" });
      return;
    }
    const hasAccess = await ensureFgAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const latest = await prisma.fGStructure.findFirst({
      where: { fgItemId: source.fgItemId },
      orderBy: { version: "desc" }
    });
    const version = (latest?.version ?? source.version) + 1;
    const revisionScheme = await getRevisionScheme("BOM");

    const revised = await prisma.fGStructure.create({
      data: {
        fgItem: { connect: { id: source.fgItemId } },
        formula: { connect: { id: source.formulaId } },
        version,
        revisionMajor: version,
        revisionIteration: 1,
        revisionLabel: formatRevisionLabel(version, 1, revisionScheme),
        status: "IN_WORK",
        ...(source.containerId ? { container: { connect: { id: source.containerId } } } : {}),
        ...(source.effectiveDate ? { effectiveDate: source.effectiveDate } : {}),
        packagingLines: {
          create: source.packagingLines.map((line) => ({
            item: { connect: { id: line.itemId } },
            lineNumber: line.lineNumber,
            quantity: line.quantity,
            uom: line.uom
          }))
        }
      }
    });

    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FG_STRUCTURE",
      entityId: revised.id,
      action: "REVISE",
      ...(actorId ? { actorId } : {}),
      payload: { sourceId: source.id, version }
    });
    res.status(201).json(revised);
  } catch (error) {
    next(error);
  }
});

// POST /api/fg/:id/copy
router.post("/:id/copy", async (req, res, next) => {
  try {
    const fgId = String(req.params.id ?? "");
    const source = await prisma.fGStructure.findUnique({
      where: { id: fgId },
      include: { packagingLines: true }
    });
    if (!source) {
      res.status(404).json({ message: "Finished Good structure not found" });
      return;
    }
    const hasAccess = await ensureFgAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const revisionScheme = await getRevisionScheme("BOM");
    const copied = await prisma.fGStructure.create({
      data: {
        fgItem: { connect: { id: source.fgItemId } },
        formula: { connect: { id: source.formulaId } },
        version: 1,
        revisionMajor: 1,
        revisionIteration: 1,
        revisionLabel: formatRevisionLabel(1, 1, revisionScheme),
        status: "IN_WORK",
        ...(source.containerId ? { container: { connect: { id: source.containerId } } } : {}),
        ...(source.effectiveDate ? { effectiveDate: source.effectiveDate } : {}),
        packagingLines: {
          create: source.packagingLines.map((line) => ({
            item: { connect: { id: line.itemId } },
            lineNumber: line.lineNumber,
            quantity: line.quantity,
            uom: line.uom
          }))
        }
      }
    });

    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FG_STRUCTURE",
      entityId: copied.id,
      action: "COPY",
      ...(actorId ? { actorId } : {}),
      payload: { sourceId: source.id }
    });
    res.status(201).json(copied);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/fg/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const fgId = String(req.params.id ?? "");
    const existing = await prisma.fGStructure.findUnique({ where: { id: fgId } });
    if (!existing) {
      res.status(404).json({ message: "Finished Good structure not found" });
      return;
    }
    const hasAccess = await ensureFgAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await prisma.fGStructure.delete({ where: { id: fgId } });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FG_STRUCTURE",
      entityId: fgId,
      action: "DELETE",
      ...(actorId ? { actorId } : {}),
      payload: existing
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/fg/:id/links
router.get("/:id/links", async (req, res, next) => {
  try {
    const fgId = String(req.params.id ?? "");
    const fg = await prisma.fGStructure.findUnique({
      where: { id: fgId },
      include: {
        fgItem: { select: { id: true, itemCode: true, name: true, itemType: true, industryType: true } },
        formula: { select: { id: true, formulaCode: true, version: true, name: true, status: true } },
        packagingLines: { include: { item: { select: { id: true, itemCode: true, name: true, itemType: true } } } }
      }
    });
    if (!fg) {
      res.status(404).json({ message: "Finished Good structure not found" });
      return;
    }
    const hasAccess = await ensureFgAccess(req, fg.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const [relatedChanges, workflows, formulaSpecs, fgItemSpecs, packagingSpecs] = await Promise.all([
      prisma.changeRequest.findMany({
        where: {
          OR: [
            { affectedItems: { has: fg.fgItem.itemCode } },
            ...(fg.formula ? [{ affectedFormulas: { has: fg.formula.formulaCode } }] : [])
          ]
        },
        select: { id: true, crNumber: true, title: true, type: true, priority: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.workflowInstance.findMany({
        where: { entityType: "FG_STRUCTURE", entityId: fgId },
        select: { id: true, currentState: true, updatedAt: true },
        orderBy: { updatedAt: "desc" }
      }),
      fg.formulaId
        ? prisma.specification.findMany({
            where: { formulaId: fg.formulaId },
            select: { id: true, specType: true, attribute: true, value: true, minValue: true, maxValue: true, uom: true },
            orderBy: { updatedAt: "desc" }
          })
        : Promise.resolve([]),
      prisma.specification.findMany({
        where: { itemId: fg.fgItemId },
        select: { id: true, specType: true, attribute: true, value: true, minValue: true, maxValue: true, uom: true, testMethod: true }
      }),
      prisma.specification.findMany({
        where: { itemId: { in: fg.packagingLines.map((line) => line.itemId) } },
        select: { id: true, itemId: true, specType: true, attribute: true, value: true, minValue: true, maxValue: true, uom: true }
      })
    ]);

    res.json({
      fg,
      relatedChanges,
      workflows,
      formulaSpecifications: formulaSpecs,
      fgItemSpecifications: fgItemSpecs,
      packagingSpecifications: packagingSpecs
    });
  } catch (error) {
    next(error);
  }
});

// ─── Versioning-service checkout / checkin / undo-checkout ────────────────────

router.post("/:id/checkout", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const result = await checkoutEntity("FG_STRUCTURE", req.params.id, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/checkin", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const result = await checkinEntity("FG_STRUCTURE", req.params.id, userId, req.body ?? {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/undo-checkout", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const userRole = req.user?.role ?? "";
    const isAdmin = ["System Admin", "PLM Admin", "Container Admin"].includes(userRole);
    const result = await undoCheckout("FG_STRUCTURE", req.params.id, userId, isAdmin);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
