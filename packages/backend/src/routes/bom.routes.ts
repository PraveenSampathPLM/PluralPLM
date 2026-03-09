import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { formatRevisionLabel, getRevisionScheme } from "../services/revision.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";

const router = Router();
const createBomSchema = z.object({
  version: z.number().int().positive().default(1),
  bomType: z.enum(["FG_BOM", "FML_BOM"]).default("FML_BOM"),
  parentItemId: z.string().optional(),
  formulaId: z.string().optional(),
  containerId: z.string().optional(),
  type: z.enum(["PRODUCTION", "COSTING", "PLANNING"]).default("PRODUCTION"),
  plantId: z.string().optional(),
  effectiveDate: z.string().optional(),
  lines: z
    .array(
      z
        .object({
          lineNumber: z.number().int().positive().optional(),
          itemId: z.string().min(1).optional(),
          inputFormulaId: z.string().min(1).optional(),
          quantity: z.number().positive(),
          uom: z.string().min(1),
          scrapFactor: z.number().optional(),
          phaseStep: z.string().optional(),
          operationStep: z.string().optional(),
          referenceDesignator: z.string().optional()
        })
        .superRefine((line, ctx) => {
          const hasItem = Boolean(line.itemId);
          const hasFormula = Boolean(line.inputFormulaId);
          if (hasItem === hasFormula) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Each BOM line must reference exactly one source: itemId or inputFormulaId"
            });
          }
        })
    )
    .min(1, "At least one BOM line is required")
});

const updateBomStructureSchema = z.object({
  lines: z
    .array(
      z
        .object({
          lineNumber: z.number().int().positive().optional(),
          itemId: z.string().min(1).optional(),
          inputFormulaId: z.string().min(1).optional(),
          quantity: z.number().positive(),
          uom: z.string().min(1),
          scrapFactor: z.number().optional(),
          phaseStep: z.string().optional(),
          operationStep: z.string().optional(),
          referenceDesignator: z.string().optional()
        })
        .superRefine((line, ctx) => {
          const hasItem = Boolean(line.itemId);
          const hasFormula = Boolean(line.inputFormulaId);
          if (hasItem === hasFormula) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Each BOM line must reference exactly one source: itemId or inputFormulaId"
            });
          }
        })
    )
    .min(1, "At least one BOM line is required")
});

async function validateBomBusinessRules(parsed: z.infer<typeof createBomSchema>): Promise<{ bomCode: string }> {
  if (parsed.bomType === "FG_BOM" && !parsed.parentItemId) {
    throw new Error("FG BOM requires parentItemId.");
  }
  if (parsed.bomType === "FML_BOM" && !parsed.formulaId) {
    throw new Error("FML BOM requires formulaId.");
  }

  const [parentItem, parentFormula] = await Promise.all([
    parsed.parentItemId
      ? prisma.item.findUnique({ where: { id: parsed.parentItemId }, select: { id: true, itemType: true, itemCode: true } })
      : Promise.resolve(null),
    parsed.formulaId
      ? prisma.formula.findUnique({ where: { id: parsed.formulaId }, select: { id: true, formulaCode: true, recipeType: true } })
      : Promise.resolve(null)
  ]);

  if (parsed.bomType === "FG_BOM") {
    if (!parentItem || parentItem.itemType !== "FINISHED_GOOD") {
      throw new Error("FG BOM parent must be a Finished Good item.");
    }
  }
  if (parsed.bomType === "FML_BOM") {
    if (!parentFormula || parentFormula.recipeType !== "FORMULA_RECIPE") {
      throw new Error("FML BOM parent must be a Formula recipe.");
    }
  }

  const itemIds = parsed.lines.map((line) => line.itemId).filter((id): id is string => Boolean(id));
  const formulaIds = parsed.lines.map((line) => line.inputFormulaId).filter((id): id is string => Boolean(id));

  const [items, formulas] = await Promise.all([
    itemIds.length ? prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, itemType: true } }) : Promise.resolve([]),
    formulaIds.length ? prisma.formula.findMany({ where: { id: { in: formulaIds } }, select: { id: true, recipeType: true } }) : Promise.resolve([])
  ]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const formulaById = new Map(formulas.map((f) => [f.id, f]));

  if (parsed.bomType === "FG_BOM") {
    const hasFormulaLine = parsed.lines.some((line) => Boolean(line.inputFormulaId));
    if (!hasFormulaLine) {
      throw new Error("FG BOM must include at least one formula line.");
    }
  }

  for (const [index, line] of parsed.lines.entries()) {
    if (line.itemId) {
      const item = itemById.get(line.itemId);
      if (!item) {
        throw new Error(`Line ${index + 1}: item not found.`);
      }
      if (parsed.bomType === "FG_BOM" && item.itemType !== "PACKAGING") {
        throw new Error(`Line ${index + 1}: FG BOM item inputs must be Packaging.`);
      }
      if (parsed.bomType === "FML_BOM" && !["RAW_MATERIAL", "INTERMEDIATE"].includes(item.itemType)) {
        throw new Error(`Line ${index + 1}: FML BOM item inputs must be Raw Material or Intermediate.`);
      }
    }
    if (line.inputFormulaId) {
      const formula = formulaById.get(line.inputFormulaId);
      if (!formula) {
        throw new Error(`Line ${index + 1}: input formula not found.`);
      }
      if (formula.recipeType !== "FORMULA_RECIPE") {
        throw new Error(`Line ${index + 1}: input formula must be a Formula recipe.`);
      }
    }
  }

  const bomCode =
    parsed.bomType === "FG_BOM"
      ? parentItem?.itemCode ?? ""
      : parentFormula?.formulaCode ?? "";
  if (!bomCode) {
    throw new Error("Unable to derive BOM code from parent.");
  }
  return { bomCode };
}

async function ensureBomAccess(
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
    entity: "BOM",
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
    const containerId = String(req.query.containerId ?? "").trim();
    const baseWhere = {};
    const where = !isGlobalAdmin(req.user?.role)
      ? {
          ...baseWhere,
          AND: [
            {
              OR: [{ containerId: null }, { containerId: { in: await getAccessibleContainerIds(userId, "BOM", "READ") } }]
            }
          ]
        }
      : baseWhere;
    if (containerId) {
      Object.assign(where, { AND: [...((where as { AND?: unknown[] }).AND ?? []), { containerId }] });
    }

    const data = await prisma.bOM.findMany({
      where,
      include: { formula: true, parentItem: true, plant: true, lines: { include: { item: true, inputFormula: true } } },
      distinct: ["bomCode"],
      orderBy: [{ bomCode: "asc" }, { version: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    const total = (await prisma.bOM.groupBy({ by: ["bomCode"], where })).length;

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createBomSchema.parse(req.body);
    const hasAccess = await ensureBomAccess(req, parsed.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "No write access to selected container. Choose a container you can write to." });
      return;
    }
    const { bomCode } = await validateBomBusinessRules(parsed);
    const revisionScheme = await getRevisionScheme("BOM");
    const revisionMajor = parsed.version;
    const revisionIteration = 1;
    const created = await prisma.bOM.create({
      data: {
        bomCode,
        version: parsed.version,
        revisionMajor,
        revisionIteration,
        revisionLabel: formatRevisionLabel(revisionMajor, revisionIteration, revisionScheme),
        status: "DRAFT",
        bomType: parsed.bomType,
        ...(parsed.parentItemId ? { parentItem: { connect: { id: parsed.parentItemId } } } : {}),
        ...(parsed.formulaId ? { formula: { connect: { id: parsed.formulaId } } } : {}),
        ...(parsed.containerId ? { container: { connect: { id: parsed.containerId } } } : {}),
        type: parsed.type,
        ...(parsed.plantId ? { plant: { connect: { id: parsed.plantId } } } : {}),
        ...(parsed.effectiveDate ? { effectiveDate: new Date(parsed.effectiveDate) } : {}),
        lines: {
          create: parsed.lines.map((line) => ({
            ...(typeof line.lineNumber === "number" ? { lineNumber: line.lineNumber } : {}),
            ...(line.itemId ? { itemId: line.itemId } : {}),
            ...(line.inputFormulaId ? { inputFormulaId: line.inputFormulaId } : {}),
            quantity: line.quantity,
            uom: line.uom,
            ...(typeof line.scrapFactor === "number" ? { scrapFactor: line.scrapFactor } : {}),
            ...(line.phaseStep ? { phaseStep: line.phaseStep } : {}),
            ...(line.operationStep ? { operationStep: line.operationStep } : {}),
            ...(line.referenceDesignator ? { referenceDesignator: line.referenceDesignator } : {})
          }))
        }
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "BOM",
      entityId: created.id,
      action: "CREATE",
      ...(actorId ? { actorId } : {}),
      payload: created
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const bom = await prisma.bOM.findUnique({
      where: { id: req.params.id },
      include: { formula: true, parentItem: true, plant: true, lines: { include: { item: true, inputFormula: true } } }
    });
    if (!bom) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    const hasAccess = await ensureBomAccess(req, bom.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json(bom);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/history", async (req, res, next) => {
  try {
    const bom = await prisma.bOM.findUnique({ where: { id: req.params.id } });
    if (!bom) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    const hasAccess = await ensureBomAccess(req, bom.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const history = await prisma.bOM.findMany({
      where: { bomCode: bom.bomCode },
      orderBy: [{ version: "desc" }]
    });
    res.json({ currentId: bom.id, history });
  } catch (error) {
    next(error);
  }
});

router.put("/:id/structure", async (req, res, next) => {
  try {
    const bomId = String(req.params.id ?? "");
    const parsed = updateBomStructureSchema.parse(req.body);
    const existing = await prisma.bOM.findUnique({
      where: { id: bomId },
      include: { lines: true }
    });
    if (!existing) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    if (existing.status !== "DRAFT") {
      res.status(400).json({ message: "Only Draft BOMs can be edited." });
      return;
    }
    const hasAccess = await ensureBomAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const validationPayload: z.infer<typeof createBomSchema> = {
      version: existing.version,
      bomType: existing.bomType,
      parentItemId: existing.parentItemId ?? undefined,
      formulaId: existing.formulaId ?? undefined,
      containerId: existing.containerId ?? undefined,
      type: existing.type as "PRODUCTION" | "COSTING" | "PLANNING",
      plantId: existing.plantId ?? undefined,
      effectiveDate: existing.effectiveDate ? existing.effectiveDate.toISOString() : undefined,
      lines: parsed.lines
    };
    await validateBomBusinessRules(validationPayload);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.bOMLine.deleteMany({ where: { bomId } });
      await tx.bOMLine.createMany({
        data: parsed.lines.map((line) => ({
          bomId,
          ...(typeof line.lineNumber === "number" ? { lineNumber: line.lineNumber } : {}),
          ...(line.itemId ? { itemId: line.itemId } : {}),
          ...(line.inputFormulaId ? { inputFormulaId: line.inputFormulaId } : {}),
          quantity: line.quantity,
          uom: line.uom,
          ...(typeof line.scrapFactor === "number" ? { scrapFactor: line.scrapFactor } : {}),
          ...(line.phaseStep ? { phaseStep: line.phaseStep } : {}),
          ...(line.operationStep ? { operationStep: line.operationStep } : {}),
          ...(line.referenceDesignator ? { referenceDesignator: line.referenceDesignator } : {})
        }))
      });
      return tx.bOM.findUnique({
        where: { id: bomId },
        include: { formula: true, parentItem: true, plant: true, lines: { include: { item: true, inputFormula: true } } }
      });
    });

    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "BOM",
      entityId: bomId,
      action: "UPDATE_STRUCTURE",
      ...(actorId ? { actorId } : {}),
      payload: { lineCount: parsed.lines.length }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/explosion", async (req, res, next) => {
  try {
    const bom = await prisma.bOM.findUnique({ where: { id: req.params.id }, include: { lines: { include: { item: true, inputFormula: true } } } });
    if (!bom) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    const hasAccess = await ensureBomAccess(req, bom.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json({
      bomId: bom.id,
      bomCode: bom.bomCode,
      version: bom.version,
      lines: bom.lines
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/cost-rollup", async (req, res, next) => {
  try {
    const bom = await prisma.bOM.findUnique({ where: { id: req.params.id }, select: { id: true, containerId: true } });
    if (!bom) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    const hasAccess = await ensureBomAccess(req, bom.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const lines = await prisma.bOMLine.findMany({ where: { bomId: req.params.id }, include: { item: true } });
    const estimatedCost = lines.reduce((sum, line) => sum + line.quantity, 0);
    res.json({ bomId: req.params.id, estimatedCost, currency: "USD", note: "Cost placeholder uses quantity until item standard cost is modeled." });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/copy", async (req, res, next) => {
  try {
    const bomId = String(req.params.id ?? "");
    const source = await prisma.bOM.findUnique({ where: { id: bomId }, include: { lines: true } });
    if (!source) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    const hasAccess = await ensureBomAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const bomCode = source.bomCode;
    const revisionScheme = await getRevisionScheme("BOM");
    const copied = await prisma.bOM.create({
      data: {
        bomCode,
        version: 1,
        revisionMajor: 1,
        revisionIteration: 1,
        revisionLabel: formatRevisionLabel(1, 1, revisionScheme),
        status: "DRAFT",
        ...(source.containerId ? { container: { connect: { id: source.containerId } } } : {}),
        bomType: source.bomType,
        ...(source.parentItemId ? { parentItem: { connect: { id: source.parentItemId } } } : {}),
        ...(source.formulaId ? { formula: { connect: { id: source.formulaId } } } : {}),
        type: source.type,
        ...(source.plantId ? { plant: { connect: { id: source.plantId } } } : {}),
        ...(source.effectiveDate ? { effectiveDate: source.effectiveDate } : {}),
        lines: {
          create: source.lines.map((line) => ({
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            inputFormulaId: line.inputFormulaId,
            quantity: line.quantity,
            uom: line.uom,
            scrapFactor: line.scrapFactor,
            phaseStep: line.phaseStep,
            operationStep: line.operationStep,
            referenceDesignator: line.referenceDesignator
          }))
        }
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "BOM",
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

router.post("/:id/revise", async (req, res, next) => {
  try {
    const bomId = String(req.params.id ?? "");
    const source = await prisma.bOM.findUnique({ where: { id: bomId }, include: { lines: true } });
    if (!source) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    const hasAccess = await ensureBomAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const latest = await prisma.bOM.findFirst({ where: { bomCode: source.bomCode }, orderBy: { version: "desc" } });
    const version = (latest?.version ?? source.version) + 1;
    const revisionScheme = await getRevisionScheme("BOM");
    const revised = await prisma.bOM.create({
      data: {
        bomCode: source.bomCode,
        version,
        revisionMajor: version,
        revisionIteration: 1,
        revisionLabel: formatRevisionLabel(version, 1, revisionScheme),
        status: "DRAFT",
        bomType: source.bomType,
        ...(source.containerId ? { container: { connect: { id: source.containerId } } } : {}),
        ...(source.parentItemId ? { parentItem: { connect: { id: source.parentItemId } } } : {}),
        ...(source.formulaId ? { formula: { connect: { id: source.formulaId } } } : {}),
        type: source.type,
        ...(source.plantId ? { plant: { connect: { id: source.plantId } } } : {}),
        ...(source.effectiveDate ? { effectiveDate: source.effectiveDate } : {}),
        lines: {
          create: source.lines.map((line) => ({
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            inputFormulaId: line.inputFormulaId,
            quantity: line.quantity,
            uom: line.uom,
            scrapFactor: line.scrapFactor,
            phaseStep: line.phaseStep,
            operationStep: line.operationStep,
            referenceDesignator: line.referenceDesignator
          }))
        }
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "BOM",
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

router.post("/:id/check-out", async (req, res, next) => {
  try {
    const bomId = String(req.params.id ?? "");
    const existing = await prisma.bOM.findUnique({ where: { id: bomId } });
    if (!existing) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    if (existing.status !== "DRAFT") {
      res.status(400).json({ message: "Only Draft BOMs can be checked out." });
      return;
    }
    const hasAccess = await ensureBomAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const updated = await prisma.bOM.update({
      where: { id: bomId },
      data: { status: "IN_REVIEW", revisionLabel: existing.revisionLabel }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "BOM",
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

router.post("/:id/check-in", async (req, res, next) => {
  try {
    const bomId = String(req.params.id ?? "");
    const existing = await prisma.bOM.findUnique({ where: { id: bomId } });
    if (!existing) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    if (existing.status !== "IN_REVIEW") {
      res.status(400).json({ message: "Only BOMs in review can be checked in." });
      return;
    }
    const hasAccess = await ensureBomAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const revisionScheme = await getRevisionScheme("BOM");
    const revisionMajor = existing.revisionMajor;
    const revisionIteration = existing.revisionIteration + 1;
    const updated = await prisma.bOM.update({
      where: { id: bomId },
      data: {
        status: "APPROVED",
        revisionIteration,
        revisionLabel: formatRevisionLabel(revisionMajor, revisionIteration, revisionScheme)
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "BOM",
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

router.delete("/:id", async (req, res, next) => {
  try {
    const bomId = String(req.params.id ?? "");
    const existing = await prisma.bOM.findUnique({ where: { id: bomId } });
    if (!existing) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    const hasAccess = await ensureBomAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await prisma.bOM.delete({ where: { id: bomId } });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "BOM",
      entityId: bomId,
      action: "DELETE",
      ...(actorId ? { actorId } : {}),
      payload: existing
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/:id/links", async (req, res, next) => {
  try {
    const bomId = String(req.params.id ?? "");
    const bom = await prisma.bOM.findUnique({
      where: { id: bomId },
      include: {
        formula: { select: { id: true, formulaCode: true, version: true, name: true, status: true } },
        parentItem: { select: { id: true, itemCode: true, name: true, itemType: true } },
        lines: {
          include: {
            item: { select: { id: true, itemCode: true, name: true, itemType: true } },
            inputFormula: { select: { id: true, formulaCode: true, version: true, name: true } }
          }
        }
      }
    });
    if (!bom) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }
    const hasAccess = await ensureBomAccess(req, bom.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    if (bom.formula && bom.formula.status && !["DRAFT", "IN_REVIEW", "APPROVED", "RELEASED", "OBSOLETE"].includes(bom.formula.status)) {
      res.status(404).json({ message: "BOM not found" });
      return;
    }

    const [relatedChanges, workflows, formulaSpecs, lineItemSpecs] = await Promise.all([
      bom.formula
        ? prisma.changeRequest.findMany({
            where: { affectedFormulas: { has: bom.formula.formulaCode } },
            select: {
              id: true,
              crNumber: true,
              title: true,
              type: true,
              priority: true,
              status: true,
              updatedAt: true
            },
            orderBy: { updatedAt: "desc" }
          })
        : Promise.resolve([]),
      prisma.workflowInstance.findMany({
        where: { entityType: "BOM", entityId: bomId },
        select: { id: true, currentState: true, updatedAt: true },
        orderBy: { updatedAt: "desc" }
      }),
      bom.formulaId
        ? prisma.specification.findMany({
            where: { formulaId: bom.formulaId },
            select: { id: true, specType: true, attribute: true, value: true, minValue: true, maxValue: true, uom: true, updatedAt: true },
            orderBy: { updatedAt: "desc" }
          })
        : Promise.resolve([]),
      prisma.specification.findMany({
        where: { itemId: { in: bom.lines.map((line) => line.itemId).filter((id): id is string => Boolean(id)) } },
        select: {
          id: true,
          itemId: true,
          specType: true,
          attribute: true,
          value: true,
          minValue: true,
          maxValue: true,
          uom: true,
          updatedAt: true
        },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    res.json({
      bom,
      relatedChanges,
      workflows,
      formulaSpecifications: formulaSpecs,
      lineItemSpecifications: lineItemSpecs
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export", async (_req, res) => {
  res.status(501).json({ message: "BOM ERP export scaffolded. Add SAP IDOC/CSV/JSON serializers next." });
});

export default router;
