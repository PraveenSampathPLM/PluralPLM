import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { z } from "zod";
import { writeAuditLog } from "../services/audit.service.js";
import { authorize } from "../middleware/auth.middleware.js";
import { readSpecTemplates, updateSpecTemplates } from "../services/config-store.service.js";

const router = Router();
const readRoles = [
  "System Admin",
  "PLM Admin",
  "Formulation Chemist",
  "QA Manager",
  "Regulatory Affairs",
  "Production Manager",
  "Procurement",
  "Read-Only Viewer"
] as const;
const writeRoles = ["System Admin", "PLM Admin", "Formulation Chemist", "QA Manager", "Regulatory Affairs"] as const;

const specTypeSchema = z.enum([
  "PHYSICAL",
  "CHEMICAL",
  "APPEARANCE",
  "SAFETY",
  "PERFORMANCE",
  "REGULATORY",
  "PACKAGING",
  "NUTRITION",
  "MICROBIO",
  "ALLERGEN",
  "SENSORY"
]);
const scopeSchema = z.enum(["item", "formula"]).optional();

const specificationPayloadSchema = z
  .object({
    itemId: z.string().min(1).optional(),
    formulaId: z.string().min(1).optional(),
    specType: specTypeSchema,
    attribute: z.string().min(1),
    value: z.string().trim().optional(),
    uom: z.string().trim().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    testMethod: z.string().trim().optional()
  })
  .superRefine((input, ctx) => {
    const hasItem = Boolean(input.itemId);
    const hasFormula = Boolean(input.formulaId);
    if (hasItem === hasFormula) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one target is required: itemId or formulaId"
      });
    }

    if (typeof input.minValue === "number" && typeof input.maxValue === "number" && input.minValue > input.maxValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minValue must be less than or equal to maxValue",
        path: ["minValue"]
      });
    }

    const hasFixedValue = Boolean(input.value && input.value.length > 0);
    const hasRange = typeof input.minValue === "number" || typeof input.maxValue === "number";
    if (!hasFixedValue && !hasRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a fixed value or min/max limits"
      });
    }
  });

const specificationLineSchema = z
  .object({
    id: z.string().optional(),
    specType: specTypeSchema,
    attribute: z.string().min(1),
    value: z.string().trim().optional(),
    uom: z.string().trim().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    testMethod: z.string().trim().optional()
  })
  .superRefine((input, ctx) => {
    if (typeof input.minValue === "number" && typeof input.maxValue === "number" && input.minValue > input.maxValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minValue must be less than or equal to maxValue",
        path: ["minValue"]
      });
    }
    const hasFixedValue = Boolean(input.value && input.value.length > 0);
    const hasRange = typeof input.minValue === "number" || typeof input.maxValue === "number";
    if (!hasFixedValue && !hasRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a fixed value or min/max limits"
      });
    }
  });

const bulkUpsertSchema = z.object({
  targetType: z.enum(["item", "formula"]),
  targetId: z.string().min(1),
  replaceExisting: z.boolean().default(true),
  specs: z.array(specificationLineSchema).min(1, "At least one specification line is required")
});

const templateAttributeSchema = z.object({
  key: z.string().min(1),
  defaultUom: z.string().optional(),
  defaultTestMethod: z.string().optional(),
  valueKind: z.enum(["RANGE", "TEXT"]).optional()
});

const templateSchema = z.object({
  specType: z.string().min(1),
  label: z.string().min(1),
  attributes: z.array(templateAttributeSchema).min(1)
});

async function validateChemicalTarget(itemId?: string, formulaId?: string): Promise<void> {
  if (itemId) {
    const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
    if (!item) {
      throw new Error("Item does not exist");
    }
    return;
  }

  if (formulaId) {
    const formula = await prisma.formula.findUnique({ where: { id: formulaId }, select: { id: true } });
    if (!formula) {
      throw new Error("Formula does not exist");
    }
  }
}

router.get("/templates/:industry", authorize([...readRoles]), async (req, res, next) => {
  try {
    const industry = String(req.params.industry ?? "").toUpperCase();
    const templates = await readSpecTemplates(industry);
    res.json({ data: templates });
  } catch (error) {
    next(error);
  }
});

router.put("/templates/:industry", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const industry = String(req.params.industry ?? "").toUpperCase();
    const payload = z.array(templateSchema).min(1).parse(req.body);
    await updateSpecTemplates(industry, payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/", authorize([...readRoles]), async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const specType = req.query.specType ? chemicalSpecTypeSchema.parse(String(req.query.specType)) : undefined;
    const scope = scopeSchema.parse(req.query.scope ? String(req.query.scope) : undefined);
    const attribute = String(req.query.attribute ?? "").trim();
    const itemId = String(req.query.itemId ?? "").trim();
    const formulaId = String(req.query.formulaId ?? "").trim();
    if (itemId && formulaId) {
      res.status(400).json({ message: "Use either itemId or formulaId, not both" });
      return;
    }

    const where = {
      ...(scope === "item"
        ? { itemId: { not: null } }
        : scope === "formula"
          ? { formulaId: { not: null } }
          : {}),
      ...(itemId ? { itemId } : {}),
      ...(formulaId ? { formulaId } : {}),
      ...(specType ? { specType } : {}),
      ...(attribute ? { attribute: { contains: attribute, mode: "insensitive" as const } } : {})
    };

    const [data, total] = await Promise.all([
      prisma.specification.findMany({
        where,
        include: { item: true, formula: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" }
      }),
      prisma.specification.count({ where })
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.post("/bulk-upsert", authorize([...writeRoles]), async (req, res, next) => {
  try {
    const parsed = bulkUpsertSchema.parse(req.body);
    const itemId = parsed.targetType === "item" ? parsed.targetId : undefined;
    const formulaId = parsed.targetType === "formula" ? parsed.targetId : undefined;
    await validateChemicalTarget(itemId, formulaId);

    const existingForTarget = await prisma.specification.findMany({
      where: {
        ...(itemId ? { itemId } : {}),
        ...(formulaId ? { formulaId } : {})
      },
      select: { id: true }
    });

    const existingIds = new Set(existingForTarget.map((spec) => spec.id));
    const actorId = req.user?.sub;

    const result = await prisma.$transaction(async (tx) => {
      const upserted: Array<{ id: string; action: "created" | "updated" }> = [];

      for (const line of parsed.specs) {
        if (line.id && existingIds.has(line.id)) {
          await tx.specification.update({
            where: { id: line.id },
            data: {
              specType: line.specType,
              attribute: line.attribute,
              value: line.value ?? null,
              uom: line.uom ?? null,
              minValue: line.minValue ?? null,
              maxValue: line.maxValue ?? null,
              testMethod: line.testMethod ?? null
            }
          });
          upserted.push({ id: line.id, action: "updated" });
          continue;
        }

        const created = await tx.specification.create({
          data: {
            specType: line.specType,
            attribute: line.attribute,
            value: line.value ?? null,
            uom: line.uom ?? null,
            minValue: line.minValue ?? null,
            maxValue: line.maxValue ?? null,
            testMethod: line.testMethod ?? null,
            ...(itemId ? { itemId } : {}),
            ...(formulaId ? { formulaId } : {})
          }
        });
        upserted.push({ id: created.id, action: "created" });
      }

      let deletedCount = 0;
      if (parsed.replaceExisting) {
        const keepIds = new Set(upserted.map((entry) => entry.id));
        const toDelete = existingForTarget.filter((entry) => !keepIds.has(entry.id)).map((entry) => entry.id);
        if (toDelete.length > 0) {
          const deleted = await tx.specification.deleteMany({ where: { id: { in: toDelete } } });
          deletedCount = deleted.count;
        }
      }

      return { upserted, deletedCount };
    });

    await writeAuditLog({
      entityType: "SPECIFICATION_SET",
      entityId: parsed.targetId,
      action: "BULK_UPSERT",
      ...(actorId ? { actorId } : {}),
      payload: {
        targetType: parsed.targetType,
        targetId: parsed.targetId,
        replaceExisting: parsed.replaceExisting,
        createdCount: result.upserted.filter((entry) => entry.action === "created").length,
        updatedCount: result.upserted.filter((entry) => entry.action === "updated").length,
        deletedCount: result.deletedCount
      }
    });

    const data = await prisma.specification.findMany({
      where: {
        ...(itemId ? { itemId } : {}),
        ...(formulaId ? { formulaId } : {})
      },
      include: { item: true, formula: true },
      orderBy: [{ specType: "asc" }, { attribute: "asc" }]
    });

    res.json({
      data,
      summary: {
        createdCount: result.upserted.filter((entry) => entry.action === "created").length,
        updatedCount: result.upserted.filter((entry) => entry.action === "updated").length,
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize([...writeRoles]), async (req, res, next) => {
  try {
    const parsed = specificationPayloadSchema.parse(req.body);
    await validateChemicalTarget(parsed.itemId, parsed.formulaId);
    const created = await prisma.specification.create({
      data: {
        specType: parsed.specType,
        attribute: parsed.attribute,
        ...(parsed.value ? { value: parsed.value } : { value: null }),
        ...(parsed.uom ? { uom: parsed.uom } : { uom: null }),
        ...(typeof parsed.minValue === "number" ? { minValue: parsed.minValue } : {}),
        ...(typeof parsed.maxValue === "number" ? { maxValue: parsed.maxValue } : {}),
        ...(parsed.testMethod ? { testMethod: parsed.testMethod } : { testMethod: null }),
        ...(parsed.itemId ? { item: { connect: { id: parsed.itemId } } } : {}),
        ...(parsed.formulaId ? { formula: { connect: { id: parsed.formulaId } } } : {})
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "SPECIFICATION",
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

router.get("/:id", authorize([...readRoles]), async (req, res, next) => {
  try {
    const specId = String(req.params.id ?? "");
    const spec = await prisma.specification.findUnique({
      where: { id: specId },
      include: { item: true, formula: true }
    });
    if (!spec) {
      res.status(404).json({ message: "Specification not found" });
      return;
    }

    res.json(spec);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", authorize([...writeRoles]), async (req, res, next) => {
  try {
    const specId = String(req.params.id ?? "");
    const parsed = specificationPayloadSchema.parse(req.body);
    await validateChemicalTarget(parsed.itemId, parsed.formulaId);
    const existing = await prisma.specification.findUnique({ where: { id: specId } });
    if (!existing) {
      res.status(404).json({ message: "Specification not found" });
      return;
    }

    const updated = await prisma.specification.update({
      where: { id: specId },
      data: {
        specType: parsed.specType,
        attribute: parsed.attribute,
        value: parsed.value ?? null,
        uom: parsed.uom ?? null,
        minValue: parsed.minValue ?? null,
        maxValue: parsed.maxValue ?? null,
        testMethod: parsed.testMethod ?? null,
        itemId: parsed.itemId ?? null,
        formulaId: parsed.formulaId ?? null
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "SPECIFICATION",
      entityId: updated.id,
      action: "UPDATE",
      ...(actorId ? { actorId } : {}),
      payload: { before: existing, after: updated }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authorize([...writeRoles]), async (req, res, next) => {
  try {
    const specId = String(req.params.id ?? "");
    const existing = await prisma.specification.findUnique({ where: { id: specId } });
    if (!existing) {
      res.status(404).json({ message: "Specification not found" });
      return;
    }
    await prisma.specification.delete({ where: { id: specId } });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "SPECIFICATION",
      entityId: specId,
      action: "DELETE",
      ...(actorId ? { actorId } : {}),
      payload: existing
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/:id/history", authorize([...readRoles]), async (req, res, next) => {
  try {
    const specId = String(req.params.id ?? "");
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entityType: "SPECIFICATION", entityId: specId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.auditLog.count({ where: { entityType: "SPECIFICATION", entityId: specId } })
    ]);
    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/coa-generation", authorize([...readRoles]), async (_req, res) => {
  res.status(501).json({ message: "CoA generation endpoint scaffolded." });
});

export default router;
