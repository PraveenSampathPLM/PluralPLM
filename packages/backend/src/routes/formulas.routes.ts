import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { formatRevisionLabel, getRevisionScheme } from "../services/revision.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";
import PDFDocument from "pdfkit";
import { checkoutEntity, checkinEntity, undoCheckout, reviseEntity } from "../services/versioning.service.js";

const router = Router();

const createFormulaSchema = z.object({
  formulaCode: z.string().min(2).optional(),
  version: z.number().int().positive().default(1),
  name: z.string().min(2),
  description: z.string().optional(),
  targetYield: z.number().optional(),
  yieldUom: z.string().optional(),
  batchSize: z.number().optional(),
  batchUom: z.string().optional(),
  containerId: z.string().optional(),
  processingInstructions: z.string().optional(),
  status: z.enum(["IN_WORK", "UNDER_REVIEW", "RELEASED"]).default("IN_WORK"),
  ingredients: z
    .array(
      z.object({
        itemId: z.string().min(1).optional(),
        inputFormulaId: z.string().min(1).optional(),
        quantity: z.number().positive(),
        uom: z.string().min(1),
        percentage: z.number().optional(),
        additionSequence: z.number().int().positive().optional()
      }).superRefine((line, ctx) => {
        const hasItem = Boolean(line.itemId);
        const hasInputFormula = Boolean(line.inputFormulaId);
        if (hasItem === hasInputFormula) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each line must reference exactly one source: itemId or inputFormulaId"
          });
        }
      })
    )
    .min(1, "At least one ingredient is required")
});

const updateFormulaSchema = z.object({
  recipeType: z.enum(["FORMULA_RECIPE", "FINISHED_GOOD_RECIPE"]).optional(),
  outputItemId: z.string().nullable().optional(),
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  processingInstructions: z.string().optional(),
  status: z.enum(["IN_WORK", "UNDER_REVIEW", "RELEASED"]).optional(),
  containerId: z.string().nullable().optional()
});

const updateFormulaStructureSchema = z.object({
  outputItemId: z.string().nullable().optional(),
  ingredients: z
    .array(
      z
        .object({
          itemId: z.string().min(1).optional(),
          inputFormulaId: z.string().min(1).optional(),
          quantity: z.number().positive(),
          uom: z.string().min(1),
          percentage: z.number().optional(),
          additionSequence: z.number().int().positive().optional()
        })
        .superRefine((line, ctx) => {
          const hasItem = Boolean(line.itemId);
          const hasInputFormula = Boolean(line.inputFormulaId);
          if (hasItem === hasInputFormula) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Each line must reference exactly one source: itemId or inputFormulaId"
            });
          }
        })
    )
    .min(1, "At least one ingredient is required")
});

async function ensureFormulaAccess(
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
    entity: "FORMULA",
    action
  });
}

async function validateRecipeBusinessRules(
  input: z.infer<typeof createFormulaSchema>,
  industry: string
): Promise<void> {
  const itemIds = Array.from(new Set(input.ingredients.map((line) => line.itemId).filter((id): id is string => Boolean(id))));
  const inputFormulaIds = Array.from(
    new Set(input.ingredients.map((line) => line.inputFormulaId).filter((id): id is string => Boolean(id)))
  );

  const [items, inputFormulas] = await Promise.all([
    itemIds.length ? prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, itemType: true } }) : Promise.resolve([]),
    inputFormulaIds.length
      ? prisma.formula.findMany({
          where: { id: { in: inputFormulaIds } },
          select: { id: true, industryType: true, status: true }
        })
      : Promise.resolve([])
  ]);

  const itemById = new Map(items.map((item) => [item.id, item]));
  const formulaById = new Map(inputFormulas.map((formula) => [formula.id, formula]));

  for (const [index, line] of input.ingredients.entries()) {
    if (line.itemId) {
      const item = itemById.get(line.itemId);
      if (!item) {
        throw new Error(`Line ${index + 1}: item not found.`);
      }
      if (!["RAW_MATERIAL", "INTERMEDIATE"].includes(item.itemType)) {
        throw new Error(`Line ${index + 1}: Formula Recipe accepts only RAW_MATERIAL or INTERMEDIATE item inputs.`);
      }
    }

    if (line.inputFormulaId) {
      const inputFormula = formulaById.get(line.inputFormulaId);
      if (!inputFormula) {
        throw new Error(`Line ${index + 1}: input formula not found.`);
      }
      if (inputFormula.industryType !== industry) {
        throw new Error(`Line ${index + 1}: input formula must match container industry.`);
      }
    }
  }
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
    const andFilters: Prisma.FormulaWhereInput[] = [];
    if (!isGlobalAdmin(req.user?.role)) {
      const accessibleContainerIds = await getAccessibleContainerIds(userId, "FORMULA", "READ");
      andFilters.push({ OR: [{ containerId: null }, { containerId: { in: accessibleContainerIds } }] });
    }
    if (containerId) {
      andFilters.push({ containerId });
    }
    const where: Prisma.FormulaWhereInput = {
      ...(andFilters.length ? { AND: andFilters } : {})
    };
    const data = await prisma.formula.findMany({
      where,
      include: { ingredients: { include: { item: true, inputFormula: true } }, owner: true },
      distinct: ["formulaCode"],
      orderBy: [{ formulaCode: "asc" }, { version: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    const total = (await prisma.formula.groupBy({ by: ["formulaCode"], where })).length;
    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createFormulaSchema.parse(req.body);
    if (!parsed.containerId) {
      res.status(400).json({ message: "Container is required" });
      return;
    }
    const container = await prisma.productContainer.findUnique({ where: { id: parsed.containerId } });
    if (!container) {
      res.status(400).json({ message: "Invalid container" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, parsed.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "No write access to selected container. Choose a container you can write to." });
      return;
    }
    const formulaCode = parsed.formulaCode ?? (await allocateNextSequenceValue("FORMULA", parsed.containerId));
    const revisionScheme = await getRevisionScheme("FORMULA");
    const revisionMajor = parsed.version;
    const revisionIteration = 1;
    const ownerId = req.user?.sub;
    if (!ownerId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    await validateRecipeBusinessRules(parsed, container.industry);

    const created = await prisma.formula.create({
      data: {
        formulaCode,
        version: parsed.version,
        revisionMajor,
        revisionIteration,
        revisionLabel: formatRevisionLabel(revisionMajor, revisionIteration, revisionScheme),
        name: parsed.name,
        description: parsed.description ?? null,
        industryType: container.industry,
        ...(typeof parsed.targetYield === "number" ? { targetYield: parsed.targetYield } : {}),
        ...(parsed.yieldUom ? { yieldUom: parsed.yieldUom } : {}),
        ...(typeof parsed.batchSize === "number" ? { batchSize: parsed.batchSize } : {}),
        ...(parsed.batchUom ? { batchUom: parsed.batchUom } : {}),
        ...(parsed.containerId ? { containerId: parsed.containerId } : {}),
        ...(parsed.processingInstructions ? { processingInstructions: parsed.processingInstructions } : {}),
        status: parsed.status,
        ownerId,
        ingredients: {
          createMany: {
            data: parsed.ingredients.map((ingredient) => ({
              ...(ingredient.itemId ? { itemId: ingredient.itemId } : {}),
              ...(ingredient.inputFormulaId ? { inputFormulaId: ingredient.inputFormulaId } : {}),
              quantity: ingredient.quantity,
              uom: ingredient.uom,
              ...(typeof ingredient.percentage === "number" ? { percentage: ingredient.percentage } : {}),
              ...(typeof ingredient.additionSequence === "number" ? { additionSequence: ingredient.additionSequence } : {})
            }))
          }
        }
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FORMULA",
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

router.post("/:id/clone", async (req, res, next) => {
  try {
    const source = await prisma.formula.findUnique({ where: { id: req.params.id }, include: { ingredients: true } });
    if (!source) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const latest = await prisma.formula.findFirst({ where: { formulaCode: source.formulaCode }, orderBy: { version: "desc" } });
    const version = (latest?.version ?? source.version) + 1;

    const cloned = await prisma.formula.create({
      data: {
        formulaCode: source.formulaCode,
        version,
        revisionMajor: version,
        revisionIteration: 1,
        revisionLabel: formatRevisionLabel(version, 1, await getRevisionScheme("FORMULA")),
        name: `${source.name} v${version}`,
        description: source.description,
        industryType: source.industryType,
        ownerId: source.ownerId,
        containerId: source.containerId,
        status: "IN_WORK",
        ingredients: {
          create: source.ingredients.map((ingredient) => ({
            ...(ingredient.itemId ? { itemId: ingredient.itemId } : {}),
            ...(ingredient.inputFormulaId ? { inputFormulaId: ingredient.inputFormulaId } : {}),
            quantity: ingredient.quantity,
            uom: ingredient.uom,
            percentage: ingredient.percentage,
            lowerLimit: ingredient.lowerLimit,
            upperLimit: ingredient.upperLimit,
            isOptional: ingredient.isOptional,
            substitutionGroup: ingredient.substitutionGroup,
            additionStep: ingredient.additionStep,
            additionSequence: ingredient.additionSequence,
            mixingTime: ingredient.mixingTime
          }))
        }
      }
    });

    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FORMULA",
      entityId: cloned.id,
      action: "CLONE",
      ...(actorId ? { actorId } : {}),
      payload: { sourceId: source.id }
    });
    res.status(201).json(cloned);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/copy", async (req, res, next) => {
  try {
    const sourceId = String(req.params.id ?? "");
    const source = await prisma.formula.findUnique({ where: { id: sourceId }, include: { ingredients: true } });
    if (!source) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const copyCode = await allocateNextSequenceValue("FORMULA", source.containerId);
    const revisionScheme = await getRevisionScheme("FORMULA");
    const copied = await prisma.formula.create({
      data: {
        formulaCode: copyCode,
        version: 1,
        revisionMajor: 1,
        revisionIteration: 1,
        revisionLabel: formatRevisionLabel(1, 1, revisionScheme),
        name: `${source.name} Copy`,
        description: source.description,
        industryType: source.industryType,
        ownerId: source.ownerId,
        containerId: source.containerId,
        status: "IN_WORK",
        ...(typeof source.targetYield === "number" ? { targetYield: source.targetYield } : {}),
        ...(source.yieldUom ? { yieldUom: source.yieldUom } : {}),
        ...(typeof source.batchSize === "number" ? { batchSize: source.batchSize } : {}),
        ...(source.batchUom ? { batchUom: source.batchUom } : {}),
        ...(source.processingInstructions ? { processingInstructions: source.processingInstructions } : {}),
        ingredients: {
          create: source.ingredients.map((ingredient) => ({
            ...(ingredient.itemId ? { itemId: ingredient.itemId } : {}),
            ...(ingredient.inputFormulaId ? { inputFormulaId: ingredient.inputFormulaId } : {}),
            quantity: ingredient.quantity,
            uom: ingredient.uom,
            percentage: ingredient.percentage,
            lowerLimit: ingredient.lowerLimit,
            upperLimit: ingredient.upperLimit,
            isOptional: ingredient.isOptional,
            substitutionGroup: ingredient.substitutionGroup,
            additionStep: ingredient.additionStep,
            additionSequence: ingredient.additionSequence,
            mixingTime: ingredient.mixingTime
          }))
        }
      }
    });

    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FORMULA",
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
    const sourceId = String(req.params.id ?? "");
    const source = await prisma.formula.findUnique({ where: { id: sourceId }, include: { ingredients: true } });
    if (!source) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const latest = await prisma.formula.findFirst({ where: { formulaCode: source.formulaCode }, orderBy: { version: "desc" } });
    const version = (latest?.version ?? source.version) + 1;
    const revisionScheme = await getRevisionScheme("FORMULA");
    const revised = await prisma.formula.create({
      data: {
        formulaCode: source.formulaCode,
        version,
        revisionMajor: version,
        revisionIteration: 1,
        revisionLabel: formatRevisionLabel(version, 1, revisionScheme),
        name: source.name,
        description: source.description,
        industryType: source.industryType,
        ownerId: source.ownerId,
        containerId: source.containerId,
        status: "IN_WORK",
        ...(typeof source.targetYield === "number" ? { targetYield: source.targetYield } : {}),
        ...(source.yieldUom ? { yieldUom: source.yieldUom } : {}),
        ...(typeof source.batchSize === "number" ? { batchSize: source.batchSize } : {}),
        ...(source.batchUom ? { batchUom: source.batchUom } : {}),
        ...(source.processingInstructions ? { processingInstructions: source.processingInstructions } : {}),
        ingredients: {
          create: source.ingredients.map((ingredient) => ({
            ...(ingredient.itemId ? { itemId: ingredient.itemId } : {}),
            ...(ingredient.inputFormulaId ? { inputFormulaId: ingredient.inputFormulaId } : {}),
            quantity: ingredient.quantity,
            uom: ingredient.uom,
            percentage: ingredient.percentage,
            lowerLimit: ingredient.lowerLimit,
            upperLimit: ingredient.upperLimit,
            isOptional: ingredient.isOptional,
            substitutionGroup: ingredient.substitutionGroup,
            additionStep: ingredient.additionStep,
            additionSequence: ingredient.additionSequence,
            mixingTime: ingredient.mixingTime
          }))
        }
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FORMULA",
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
    const formulaId = String(req.params.id ?? "");
    const existing = await prisma.formula.findUnique({ where: { id: formulaId } });
    if (!existing) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const updated = await prisma.formula.update({ where: { id: formulaId }, data: { status: "UNDER_REVIEW" } });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FORMULA",
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
    const formulaId = String(req.params.id ?? "");
    const existing = await prisma.formula.findUnique({ where: { id: formulaId } });
    if (!existing) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    if (existing.status !== "UNDER_REVIEW") {
      res.status(400).json({ message: "Only formulas under review can be checked in." });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // Validate that ingredient percentages sum to 100%
    const ingredients = await prisma.formulaIngredient.findMany({
      where: { formulaId },
      select: { percentage: true }
    });
    const ingredientsWithPercentage = ingredients.filter((i) => i.percentage !== null && i.percentage !== undefined);
    if (ingredientsWithPercentage.length > 0) {
      const total = ingredientsWithPercentage.reduce((sum, i) => sum + (i.percentage ?? 0), 0);
      const rounded = Math.round(total * 1000) / 1000;
      if (rounded !== 100) {
        res.status(400).json({
          message: `Check-in blocked: ingredient percentages must sum to 100%. Current total: ${rounded.toFixed(3)}%.`
        });
        return;
      }
    }

    const revisionScheme = await getRevisionScheme("FORMULA");
    const revisionMajor = existing.revisionMajor;
    const revisionIteration = existing.revisionIteration + 1;
    const updated = await prisma.formula.update({
      where: { id: formulaId },
      data: {
        status: "RELEASED",
        revisionIteration,
        revisionLabel: formatRevisionLabel(revisionMajor, revisionIteration, revisionScheme)
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FORMULA",
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

router.get("/compare/:leftId/:rightId", async (req, res, next) => {
  try {
    const [left, right] = await Promise.all([
      prisma.formula.findUnique({ where: { id: req.params.leftId }, include: { ingredients: { include: { item: true, inputFormula: true } } } }),
      prisma.formula.findUnique({ where: { id: req.params.rightId }, include: { ingredients: { include: { item: true, inputFormula: true } } } })
    ]);

    if (!left || !right) {
      res.status(404).json({ message: "One or both formula versions not found" });
      return;
    }
    const [leftAllowed, rightAllowed] = await Promise.all([
      ensureFormulaAccess(req, left.containerId, "READ"),
      ensureFormulaAccess(req, right.containerId, "READ")
    ]);
    if (!leftAllowed || !rightAllowed) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json({ left, right });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const formula = await prisma.formula.findUnique({
      where: { id: req.params.id },
      include: { ingredients: { include: { item: true, inputFormula: true } }, owner: true, checkedOutBy: { select: { id: true, name: true } } }
    });

    if (!formula) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, formula.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json(formula);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/history", async (req, res, next) => {
  try {
    const formula = await prisma.formula.findUnique({ where: { id: req.params.id } });
    if (!formula) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, formula.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const history = await prisma.formula.findMany({
      where: { formulaCode: formula.formulaCode },
      orderBy: [{ version: "desc" }]
    });
    res.json({ currentId: formula.id, history });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const formulaId = String(req.params.id ?? "");
    const parsed = updateFormulaSchema.parse(req.body);
    const existing = await prisma.formula.findUnique({ where: { id: formulaId } });
    if (!existing) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const targetContainerId = parsed.containerId !== undefined ? parsed.containerId : existing.containerId;
    const hasAccess = await ensureFormulaAccess(req, targetContainerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const updated = await prisma.formula.update({
      where: { id: formulaId },
      data: {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description || null } : {}),
        ...(parsed.processingInstructions !== undefined ? { processingInstructions: parsed.processingInstructions || null } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.containerId !== undefined ? { containerId: parsed.containerId } : {})
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FORMULA",
      entityId: updated.id,
      action: "UPDATE",
      ...(actorId ? { actorId } : {}),
      payload: updated
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/structure", async (req, res, next) => {
  try {
    const formulaId = String(req.params.id ?? "");
    const parsed = updateFormulaStructureSchema.parse(req.body);
    const existing = await prisma.formula.findUnique({ where: { id: formulaId }, include: { ingredients: true } });
    if (!existing) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    if (existing.status !== "IN_WORK") {
      res.status(400).json({ message: "Only IN_WORK formulations can be edited." });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const validationPayload = {
      formulaCode: existing.formulaCode,
      version: existing.version,
      name: existing.name,
      description: existing.description ?? undefined,
      targetYield: existing.targetYield ?? undefined,
      yieldUom: existing.yieldUom ?? undefined,
      batchSize: existing.batchSize ?? undefined,
      batchUom: existing.batchUom ?? undefined,
      containerId: existing.containerId ?? undefined,
      processingInstructions: existing.processingInstructions ?? undefined,
      status: existing.status,
      ingredients: parsed.ingredients
    };
    await validateRecipeBusinessRules(validationPayload, existing.industryType);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.formulaIngredient.deleteMany({ where: { formulaId } });
      await tx.formulaIngredient.createMany({
        data: parsed.ingredients.map((ingredient) => ({
          formulaId,
          ...(ingredient.itemId ? { itemId: ingredient.itemId } : {}),
          ...(ingredient.inputFormulaId ? { inputFormulaId: ingredient.inputFormulaId } : {}),
          quantity: ingredient.quantity,
          uom: ingredient.uom,
          ...(typeof ingredient.percentage === "number" ? { percentage: ingredient.percentage } : {}),
          ...(typeof ingredient.additionSequence === "number" ? { additionSequence: ingredient.additionSequence } : {})
        }))
      });
      return tx.formula.findUnique({
        where: { id: formulaId },
        include: { ingredients: { include: { item: true, inputFormula: true } }, owner: true }
      });
    });

    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FORMULA",
      entityId: formulaId,
      action: "UPDATE_STRUCTURE",
      ...(actorId ? { actorId } : {}),
      payload: { ingredientCount: parsed.ingredients.length }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const formulaId = String(req.params.id ?? "");
    const existing = await prisma.formula.findUnique({ where: { id: formulaId } });
    if (!existing) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (existing.status === "RELEASED") {
      res.status(409).json({ message: "Cannot delete a Released formula. Obsolete it first." });
      return;
    }
    await prisma.formula.delete({ where: { id: formulaId } });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "FORMULA",
      entityId: formulaId,
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
    const formulaId = String(req.params.id ?? "");
    const formula = await prisma.formula.findUnique({
      where: { id: formulaId },
      include: {
        ingredients: {
          include: {
            item: { select: { id: true, itemCode: true, name: true, itemType: true, status: true } },
            inputFormula: { select: { id: true, formulaCode: true, version: true, name: true, status: true } }
          }
        }
      }
    });

    if (!formula) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, formula.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const [fgStructures, specifications, relatedChanges, workflows] = await Promise.all([
      prisma.fGStructure.findMany({
        where: { formulaId },
        include: {
          fgItem: { select: { id: true, itemCode: true, name: true, itemType: true, status: true } },
          packagingLines: { include: { item: { select: { id: true, itemCode: true, name: true } } } }
        },
        orderBy: [{ version: "desc" }]
      }),
      prisma.specification.findMany({
        where: { formulaId },
        select: {
          id: true,
          specType: true,
          attribute: true,
          value: true,
          minValue: true,
          maxValue: true,
          uom: true,
          testMethod: true,
          updatedAt: true
        },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.changeRequest.findMany({
        where: { affectedFormulas: { has: formula.formulaCode } },
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
      }),
      prisma.workflowInstance.findMany({
        where: { entityType: "FORMULA", entityId: formulaId },
        select: { id: true, currentState: true, updatedAt: true },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    const boms = fgStructures.map((fg) => ({
      id: fg.id,
      bomCode: `${fg.fgItem.itemCode}-FG-BOM`,
      version: fg.version,
      type: "FG_BOM"
    }));

    res.json({
      formula: {
        id: formula.id,
        formulaCode: formula.formulaCode,
        version: formula.version,
        name: formula.name,
        status: formula.status,
        ingredients: formula.ingredients
      },
      boms,
      specifications,
      relatedChanges,
      workflows
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/checkout", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const result = await checkoutEntity("FORMULA", req.params.id, userId);
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
    const result = await checkinEntity("FORMULA", req.params.id, userId, req.body ?? {});
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
    const result = await undoCheckout("FORMULA", req.params.id, userId, isAdmin);
    res.json(result);
  } catch (error: unknown) {
    const e = error as { statusCode?: number; message?: string };
    if (e.statusCode) { res.status(e.statusCode).json({ message: e.message }); return; }
    next(error);
  }
});

router.post("/:id/revise-versioned", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const result = await reviseEntity("FORMULA", req.params.id, userId);
    res.json(result);
  } catch (error: unknown) {
    const e = error as { statusCode?: number; message?: string };
    if (e.statusCode) { res.status(e.statusCode).json({ message: e.message }); return; }
    next(error);
  }
});

router.get("/:id/pdf-export", async (_req, res) => {
  res.status(501).json({ message: "PDF export endpoint scaffolded; implementation pending" });
});

router.get("/:id/msds-pdf", async (req, res, next) => {
  try {
    const formula = await prisma.formula.findUnique({
      where: { id: req.params.id },
      include: {
        ingredients: { include: { item: true, inputFormula: true } },
        specs: true
      }
    });

    if (!formula) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureFormulaAccess(req, formula.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const title = `Safety Data Sheet (SDS)`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${formula.formulaCode}-MSDS.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    const specsByType = formula.specs.reduce<Record<string, typeof formula.specs>>((acc, spec) => {
      acc[spec.specType] = [...(acc[spec.specType] ?? []), spec];
      return acc;
    }, {});

    const marginBottom = 50;
    const addHeader = () => {
      doc.save();
      doc.font("Helvetica");
      doc.rect(40, 28, 28, 28).fill("#0F2027");
      doc.fillColor("#E67E22").font("Helvetica-Bold").fontSize(16).text("P", 48, 32);
      doc.fillColor("#111").font("Helvetica-Bold").fontSize(16).text("Plural PLM", 78, 32);
      doc.font("Helvetica").fontSize(9).fillColor("#555").text("Safety Data Sheet (SDS)", 78, 50);
      doc.moveDown(2);
      doc.fillColor("#111").font("Helvetica-Bold").fontSize(12).text(`${formula.name}`);
      doc.font("Helvetica").fontSize(10).fillColor("#555").text(`Formula Code: ${formula.formulaCode}  |  Version: ${formula.version}`);
      doc.text(`Status: ${formula.status}`);
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();
      doc.strokeColor("#e5e7eb").moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown();
      doc.restore();
    };

    const drawWatermark = () => {
      const text = String(formula.status ?? "IN_WORK").toUpperCase();
      doc.save();
      doc.fillColor("#94a3b8").opacity(0.12);
      doc.font("Helvetica-Bold").fontSize(64);
      doc.rotate(-30, { origin: [200, 400] });
      doc.text(text, 120, 340, { width: 400, align: "center" });
      doc.restore();
    };

    const ensureSpace = (height: number) => {
      if (doc.y + height > doc.page.height - marginBottom) {
        doc.addPage();
        drawWatermark();
        addHeader();
      }
    };

    doc.on("pageAdded", () => {
      drawWatermark();
      addHeader();
    });

    const setSectionTitle = (text: string) => {
      doc.x = 40;
      ensureSpace(20);
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111").text(text, { underline: true });
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(10).fillColor("#111");
    };

    const renderSpecLines = (types: string[]) => {
      const rows = types.flatMap((type) => specsByType[type] ?? []);
      if (!rows.length) {
        doc.x = 40;
        doc.text("Not available.");
        doc.moveDown();
        return;
      }
      rows.forEach((spec) => {
        doc.x = 40;
        const range =
          spec.minValue !== null || spec.maxValue !== null
            ? `[${spec.minValue ?? "—"} - ${spec.maxValue ?? "—"} ${spec.uom ?? ""}]`
            : spec.value ?? "—";
        ensureSpace(14);
        doc.text(`${spec.attribute}: ${range}${spec.testMethod ? ` (${spec.testMethod})` : ""}`);
      });
      doc.moveDown();
    };

    drawWatermark();
    addHeader();

    setSectionTitle("1. Identification");
    doc.text(`Product identifier: ${formula.formulaCode}`);
    doc.text(`Product name: ${formula.name}`);
    doc.text("Recommended use: Polymer formulation / finished good recipe.");
    doc.text("Restrictions on use: Industrial use only.");
    doc.text("Supplier: Plural PLM (Demo)");
    doc.text("Emergency phone: Not available.");
    doc.moveDown();

    setSectionTitle("2. Hazard(s) Identification");
    renderSpecLines(["SAFETY", "REGULATORY"]);

    setSectionTitle("3. Composition/Information on Ingredients");
    if (!formula.ingredients.length) {
      doc.text("Not available.");
      doc.moveDown();
    } else {
      const tableX = 40;
      const colWidths: [number, number, number, number, number] = [90, 140, 190, 70, 75];
      const drawTableHeader = () => {
        const startY = doc.y;
        doc.rect(tableX, startY, colWidths.reduce((a, b) => a + b, 0), 18).fill("#f1f5f9");
        doc.fillColor("#111").font("Helvetica-Bold").fontSize(9);
        doc.text("Code", tableX + 4, startY + 4, { width: colWidths[0] - 8 });
        doc.text("CAS", tableX + colWidths[0] + 4, startY + 4, { width: colWidths[1] - 8 });
        doc.text("Ingredient", tableX + colWidths[0] + colWidths[1] + 4, startY + 4, { width: colWidths[2] - 8 });
        doc.text("Percent", tableX + colWidths[0] + colWidths[1] + colWidths[2] + 4, startY + 4, { width: colWidths[3] - 8 });
        doc.text("Quantity", tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 4, startY + 4, { width: colWidths[4] - 8 });
        doc.strokeColor("#e5e7eb").rect(tableX, startY, colWidths.reduce((a, b) => a + b, 0), 18).stroke();
        doc.font("Helvetica").fontSize(9);
        doc.y = startY + 18;
      };

      drawTableHeader();

      for (const line of formula.ingredients) {
        const name = line.item?.name ?? line.inputFormula?.name ?? "Ingredient";
        const code = line.item?.itemCode ?? line.inputFormula?.formulaCode ?? "";
        const cas =
          line.item &&
          line.item.attributes &&
          typeof line.item.attributes === "object" &&
          !Array.isArray(line.item.attributes)
            ? String((line.item.attributes as Record<string, unknown>).casNumber ?? "—")
            : "—";
        const percent = line.percentage !== null && line.percentage !== undefined ? `${line.percentage}%` : "Not specified";
        const qty = `${line.quantity} ${line.uom}`;

        const rowHeight = Math.max(
          doc.heightOfString(code, { width: colWidths[0] - 8 }),
          doc.heightOfString(cas, { width: colWidths[1] - 8 }),
          doc.heightOfString(name, { width: colWidths[2] - 8 }),
          doc.heightOfString(percent, { width: colWidths[3] - 8 }),
          doc.heightOfString(qty, { width: colWidths[4] - 8 })
        ) + 8;

        ensureSpace(rowHeight + 6);
        if (doc.y < 80) {
          drawTableHeader();
        }

        const rowY = doc.y;
        doc.fillColor("#111").fontSize(9);
        doc.text(code, tableX + 4, rowY + 4, { width: colWidths[0] - 8 });
        doc.text(cas, tableX + colWidths[0] + 4, rowY + 4, { width: colWidths[1] - 8 });
        doc.text(name, tableX + colWidths[0] + colWidths[1] + 4, rowY + 4, { width: colWidths[2] - 8 });
        doc.text(percent, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 4, rowY + 4, { width: colWidths[3] - 8 });
        doc.text(qty, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 4, rowY + 4, { width: colWidths[4] - 8 });
        doc.strokeColor("#e5e7eb").rect(tableX, rowY, colWidths.reduce((a, b) => a + b, 0), rowHeight).stroke();
        doc.y = rowY + rowHeight;
      }
      doc.x = 40;
      doc.moveDown(2);
    }

    setSectionTitle("4. First-Aid Measures");
    doc.text("General advice: Seek medical attention if symptoms persist.");
    doc.text("Inhalation: Move to fresh air. Get medical advice if discomfort continues.");
    doc.text("Skin contact: Wash with soap and water. Remove contaminated clothing.");
    doc.text("Eye contact: Rinse cautiously with water for several minutes.");
    doc.text("Ingestion: Rinse mouth. Do not induce vomiting.");
    doc.moveDown();

    setSectionTitle("5. Fire-Fighting Measures");
    doc.text("Suitable extinguishing media: Dry chemical, foam, CO2.");
    doc.text("Specific hazards: Combustion products may include CO/CO2.");
    doc.text("Protective equipment: Self-contained breathing apparatus.");
    doc.moveDown();

    setSectionTitle("6. Accidental Release Measures");
    doc.text("Personal precautions: Avoid dust. Use appropriate PPE.");
    doc.text("Environmental precautions: Prevent runoff to drains.");
    doc.text("Methods for cleanup: Collect mechanically, dispose properly.");
    doc.moveDown();

    setSectionTitle("7. Handling and Storage");
    renderSpecLines(["PACKAGING", "PERFORMANCE"]);

    setSectionTitle("8. Exposure Controls/Personal Protection");
    doc.text("Engineering controls: Local exhaust ventilation.");
    doc.text("Personal protective equipment: Safety glasses, gloves as needed.");
    doc.text("Exposure limits: Not available.");
    doc.moveDown();

    setSectionTitle("9. Physical and Chemical Properties");
    renderSpecLines(["PHYSICAL", "CHEMICAL", "APPEARANCE"]);

    setSectionTitle("10. Stability and Reactivity");
    doc.text("Reactivity: Stable under recommended conditions.");
    doc.text("Conditions to avoid: Excessive heat.");
    doc.text("Incompatible materials: Strong oxidizers.");
    doc.text("Hazardous decomposition: CO/CO2, hydrocarbons.");
    doc.moveDown();

    setSectionTitle("11. Toxicological Information");
    doc.text("Toxicity: Not available.");
    doc.text("Skin corrosion/irritation: Not available.");
    doc.text("Serious eye damage/irritation: Not available.");
    doc.text("Respiratory sensitization: Not available.");
    doc.moveDown();

    setSectionTitle("12. Ecological Information");
    doc.text("Ecotoxicity: Not available.");
    doc.text("Persistence and degradability: Not available.");
    doc.text("Bioaccumulative potential: Not available.");
    doc.moveDown();

    setSectionTitle("13. Disposal Considerations");
    doc.text("Dispose in accordance with local regulations.");
    doc.moveDown();

    setSectionTitle("14. Transport Information");
    doc.text("UN number: Not available.");
    doc.text("Proper shipping name: Not regulated.");
    doc.moveDown();

    setSectionTitle("15. Regulatory Information");
    renderSpecLines(["REGULATORY"]);

    setSectionTitle("16. Other Information");
    doc.text("Prepared by: Plural PLM (auto-generated).");
    doc.text("Revision date: " + new Date().toLocaleDateString());
    doc.moveDown();

    doc.fontSize(9).fillColor("#666").text("This SDS is auto-generated from PLM data. Validate before regulatory use.");
    doc.end();
  } catch (error) {
    next(error);
  }
});

// GET /api/formulas/:id/audit — fetch audit log entries for this formula
router.get("/:id/audit", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const formula = await prisma.formula.findUnique({ where: { id: req.params.id } });
    if (!formula) { res.status(404).json({ message: "Formula not found" }); return; }
    const hasAccess = await ensureFormulaAccess(req, formula.containerId, "READ");
    if (!hasAccess) { res.status(403).json({ message: "Forbidden" }); return; }
    const entries = await prisma.auditLog.findMany({
      where: { entityType: "FORMULA", entityId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    const actorIds = [...new Set(entries.map((e) => e.actorId).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a.name]));
    res.json({
      data: entries.map((e) => ({
        id: e.id,
        action: e.action,
        actorId: e.actorId,
        actorName: e.actorId ? (actorMap.get(e.actorId) ?? e.actorId) : "System",
        createdAt: e.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/formulas/:id/product-thread ─────────────────────────────────────

router.get("/:id/product-thread", async (req, res, next) => {
  try {
    const formulaId = String(req.params.id ?? "");
    const formula = await prisma.formula.findUnique({
      where: { id: formulaId },
      include: {
        ingredients: {
          include: {
            item: { select: { id: true, itemCode: true, name: true, itemType: true, status: true } },
            inputFormula: { select: { id: true, formulaCode: true, version: true, name: true } }
          }
        }
      }
    });

    if (!formula) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }

    const hasAccess = await ensureFormulaAccess(req, formula.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const [documentLinks, specifications, allChanges, allReleases, npdProjects] = await Promise.all([
      prisma.documentLink.findMany({
        where: { entityType: "FORMULA", entityId: formulaId },
        include: {
          document: { select: { id: true, docNumber: true, name: true, docType: true, status: true } }
        }
      }),
      prisma.specification.findMany({
        where: { formulaId },
        select: { id: true, specType: true, attribute: true }
      }),
      prisma.changeRequest.findMany({
        where: { affectedFormulas: { has: formula.formulaCode } },
        select: { id: true, crNumber: true, title: true, priority: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.releaseRequest.findMany({
        where: { targetFormulas: { has: formula.formulaCode } },
        select: { id: true, rrNumber: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.npdProject.findMany({
        where: { formulaId },
        select: { id: true, projectCode: true, name: true, stage: true, status: true },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    // Locate output FG item via FGStructure relation
    const fgStructure = await prisma.fGStructure.findFirst({
      where: { formulaId },
      include: { fgItem: { select: { id: true, itemCode: true, name: true, itemType: true, status: true } } },
      orderBy: { version: "desc" }
    });
    const outputItem = fgStructure?.fgItem ?? null;

    // Action items
    const actionItems: Array<{ nodeType: string; severity: "HIGH" | "MEDIUM" | "LOW"; message: string }> = [];

    // Output FG item node
    const outputItemCompleteness = outputItem ? 100 : 0;
    const outputItemIssues: string[] = [];
    if (!outputItem) {
      outputItemIssues.push("No output FG item linked");
      actionItems.push({ nodeType: "outputItem", severity: "HIGH", message: "No output Finished Good item linked to this formula." });
    }

    // Ingredients node
    const ingredientCount = formula.ingredients.length;
    const ingredientCompleteness = Math.min(100, ingredientCount * 20);
    const ingredientIssues: string[] = [];
    if (ingredientCount === 0) {
      ingredientIssues.push("No ingredients defined");
      actionItems.push({ nodeType: "ingredients", severity: "MEDIUM", message: "No ingredients defined for this formula." });
    }

    // Documents node
    const documentCount = documentLinks.length;
    const documentCompleteness = Math.min(100, documentCount * 25);
    const documentIssues: string[] = [];
    if (documentCount === 0) {
      documentIssues.push("No documents linked");
      actionItems.push({ nodeType: "documents", severity: "LOW", message: "No documents linked to this formula." });
    }

    // Specifications node
    const specCount = specifications.length;
    const specCompleteness = specCount > 0 ? 100 : 0;
    const specIssues: string[] = [];
    if (specCount === 0) {
      specIssues.push("No specifications linked");
    }

    // Changes node
    const openChanges = allChanges.filter((c) => !["APPROVED", "IMPLEMENTED", "REJECTED"].includes(c.status));
    const criticalChanges = openChanges.filter((c) => c.priority === "HIGH" || c.priority === "CRITICAL");

    // Releases node
    const latestRelease = allReleases[0] ?? null;

    // NPD Projects node
    const activeNpd = npdProjects.filter((p) => p.status === "ACTIVE");

    // Overall completeness (weighted average)
    const weights = [
      { score: outputItemCompleteness, max: 100, weight: 30 },
      { score: ingredientCompleteness, max: 100, weight: 30 },
      { score: documentCompleteness, max: 100, weight: 20 },
      { score: specCompleteness, max: 100, weight: 20 }
    ];
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const overallCompleteness = Math.round(
      weights.reduce((sum, w) => sum + (w.score / w.max) * w.weight, 0) / totalWeight * 100
    );

    res.json({
      formula: {
        id: formula.id,
        formulaCode: formula.formulaCode,
        name: formula.name,
        version: formula.version,
        status: formula.status
      },
      overallCompleteness,
      actionItems,
      nodes: {
        outputItem: {
          count: outputItem ? 1 : 0,
          completeness: outputItemCompleteness,
          maxScore: 100,
          issues: outputItemIssues,
          item: outputItem
            ? {
                id: outputItem.id,
                itemCode: outputItem.itemCode,
                name: outputItem.name,
                itemType: outputItem.itemType,
                status: outputItem.status
              }
            : null
        },
        ingredients: {
          count: ingredientCount,
          completeness: ingredientCompleteness,
          maxScore: 100,
          issues: ingredientIssues,
          items: formula.ingredients.map((ing) => ({
            id: ing.id,
            name: ing.item?.name ?? ing.inputFormula?.name ?? "Unknown",
            code: ing.item?.itemCode ?? ing.inputFormula?.formulaCode ?? "",
            quantity: ing.quantity,
            uom: ing.uom
          }))
        },
        documents: {
          count: documentCount,
          completeness: documentCompleteness,
          maxScore: 100,
          issues: documentIssues,
          items: documentLinks.map((dl) => ({
            id: dl.document.id,
            docNumber: dl.document.docNumber,
            name: dl.document.name,
            docType: dl.document.docType,
            status: dl.document.status
          }))
        },
        specifications: {
          count: specCount,
          completeness: specCompleteness,
          maxScore: 100,
          issues: specIssues,
          items: specifications.map((s) => ({ id: s.id, specType: s.specType, attribute: s.attribute }))
        },
        changes: {
          openCount: openChanges.length,
          criticalCount: criticalChanges.length,
          items: openChanges.slice(0, 10).map((c) => ({
            id: c.id,
            crNumber: c.crNumber,
            title: c.title,
            priority: c.priority,
            status: c.status
          }))
        },
        releases: {
          latestStatus: latestRelease?.status ?? null,
          items: allReleases.slice(0, 10).map((r) => ({
            id: r.id,
            releaseCode: r.rrNumber,
            status: r.status
          }))
        },
        npdProjects: {
          count: npdProjects.length,
          activeCount: activeNpd.length,
          items: npdProjects.map((p) => ({
            id: p.id,
            projectCode: p.projectCode,
            name: p.name,
            stage: p.stage
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

