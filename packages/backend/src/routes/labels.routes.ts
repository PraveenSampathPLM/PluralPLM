import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { ensureContainerAccess } from "../services/container-access.service.js";
import { z } from "zod";

const router = Router();

// ─── Schema ────────────────────────────────────────────────────────────────────

const labelTemplateBodySchema = z.object({
  formulaId: z.string().min(1).optional(),
  containerId: z.string().optional(),
  productName: z.string().min(1),
  netWeight: z.string().default(""),
  ingredientStatement: z.string().default(""),
  allergenStatement: z.string().default(""),
  nutritionalInfo: z
    .object({
      per100g: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      perServing: z.record(z.string(), z.union([z.string(), z.number()])).optional()
    })
    .nullable()
    .optional(),
  regulatoryStatements: z.array(z.string()).default([]),
  shelfLife: z.string().default(""),
  storageConditions: z.string().default(""),
  batchFormat: z.string().default(""),
  countryOfOrigin: z.string().default(""),
  manufacturer: z.string().default("")
});

// ─── Helper: parse template data from document description ─────────────────────

type LabelTemplateData = z.infer<typeof labelTemplateBodySchema>;

function parseTemplateData(description: string | null | undefined): LabelTemplateData | null {
  if (!description) return null;
  try {
    const parsed = JSON.parse(description) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as LabelTemplateData;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── GET /api/labels — list all label templates ────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const formulaId = req.query.formulaId ? String(req.query.formulaId) : undefined;

    const docs = await prisma.document.findMany({
      where: {
        docType: "OTHER",
        name: { startsWith: "LABEL_TEMPLATE:" },
        ...(formulaId
          ? {
              description: {
                contains: `"formulaId":"${formulaId}"`
              }
            }
          : {})
      },
      include: {
        owner: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const results = docs.map((doc) => {
      const data = parseTemplateData(doc.description);
      return {
        id: doc.id,
        docNumber: doc.docNumber,
        productName: data?.productName ?? doc.name.replace("LABEL_TEMPLATE:", "").trim(),
        formulaId: data?.formulaId ?? null,
        status: doc.status,
        containerId: doc.containerId,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        owner: doc.owner,
        templateData: data
      };
    });

    // If formulaId filter was provided but the DB json contains filter missed some,
    // do a post-filter pass in memory as a safety net
    const filtered = formulaId
      ? results.filter((r) => r.formulaId === formulaId)
      : results;

    res.json({ data: filtered, total: filtered.length });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/labels — create label template ──────────────────────────────────

router.post("/", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parsed = labelTemplateBodySchema.parse(req.body);

    // Verify formula exists if provided
    let formulaCode: string | null = null;
    if (parsed.formulaId) {
      const formula = await prisma.formula.findUnique({
        where: { id: parsed.formulaId },
        select: { id: true, formulaCode: true, containerId: true }
      });
      if (!formula) {
        res.status(404).json({ message: "Formula not found" });
        return;
      }
      formulaCode = formula.formulaCode;
    }

    // Auto-generate a docNumber
    const count = await prisma.document.count({
      where: { name: { startsWith: "LABEL_TEMPLATE:" } }
    });
    const docNumber = `LBL-${String(count + 1).padStart(4, "0")}`;

    const doc = await prisma.document.create({
      data: {
        docNumber,
        name: `LABEL_TEMPLATE:${parsed.productName}`,
        description: JSON.stringify(parsed),
        fileName: `label-template-${docNumber}.json`,
        filePath: `label-templates/${docNumber}.json`,
        fileSize: 0,
        mimeType: "application/json",
        docType: "OTHER",
        status: "DRAFT",
        ownerId: userId,
        ...(parsed.containerId ? { containerId: parsed.containerId } : {})
      },
      include: { owner: { select: { id: true, name: true } } }
    });

    const data = parseTemplateData(doc.description);
    res.status(201).json({
      id: doc.id,
      docNumber: doc.docNumber,
      productName: data?.productName ?? "",
      formulaId: data?.formulaId ?? null,
      formulaCode,
      status: doc.status,
      containerId: doc.containerId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      owner: doc.owner,
      templateData: data
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/labels/:id — get single label template ──────────────────────────

router.get("/:id", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, name: { startsWith: "LABEL_TEMPLATE:" } },
      include: { owner: { select: { id: true, name: true } } }
    });

    if (!doc) {
      res.status(404).json({ message: "Label template not found" });
      return;
    }

    const hasAccess = await ensureContainerAccess({
      userId,
      userRole: req.user?.role,
      containerId: doc.containerId,
      entity: "DOCUMENT",
      action: "READ"
    });
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const data = parseTemplateData(doc.description);

    // Fetch formula details if linked
    let formula: { id: string; formulaCode: string; version: number; name: string; status: string } | null = null;
    if (data?.formulaId) {
      const f = await prisma.formula.findUnique({
        where: { id: data.formulaId },
        select: { id: true, formulaCode: true, version: true, name: true, status: true }
      });
      if (f) formula = f;
    }

    res.json({
      id: doc.id,
      docNumber: doc.docNumber,
      productName: data?.productName ?? "",
      formulaId: data?.formulaId ?? null,
      formula,
      status: doc.status,
      containerId: doc.containerId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      owner: doc.owner,
      templateData: data
    });
  } catch (error) {
    next(error);
  }
});

// ─── PATCH /api/labels/:id — update label template ────────────────────────────

router.patch("/:id", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, name: { startsWith: "LABEL_TEMPLATE:" } }
    });

    if (!doc) {
      res.status(404).json({ message: "Label template not found" });
      return;
    }

    const hasAccess = await ensureContainerAccess({
      userId,
      userRole: req.user?.role,
      containerId: doc.containerId,
      entity: "DOCUMENT",
      action: "WRITE"
    });
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // Merge existing data with new data
    const existingData = parseTemplateData(doc.description) ?? {};
    const updates = labelTemplateBodySchema.partial().parse(req.body);
    // Use a plain record to avoid exactOptionalPropertyTypes issues with the merge
    const merged: Record<string, unknown> = { ...existingData, ...updates };

    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        description: JSON.stringify(merged),
        name: `LABEL_TEMPLATE:${String(merged["productName"] ?? "")}`
      },
      include: { owner: { select: { id: true, name: true } } }
    });

    const data = parseTemplateData(updated.description);
    res.json({
      id: updated.id,
      docNumber: updated.docNumber,
      productName: data?.productName ?? "",
      formulaId: data?.formulaId ?? null,
      status: updated.status,
      containerId: updated.containerId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      owner: updated.owner,
      templateData: data
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/labels/:id ────────────────────────────────────────────────────

router.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, name: { startsWith: "LABEL_TEMPLATE:" } }
    });

    if (!doc) {
      res.status(404).json({ message: "Label template not found" });
      return;
    }

    const hasAccess = await ensureContainerAccess({
      userId,
      userRole: req.user?.role,
      containerId: doc.containerId,
      entity: "DOCUMENT",
      action: "WRITE"
    });
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    await prisma.document.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ─── Legacy: GET /api/labels/formulas/:id — kept for backward-compat ──────────

router.get("/formulas/:id", async (req, res, next) => {
  try {
    const formula = await prisma.formula.findUnique({
      where: { id: req.params.id },
      include: { ingredients: { include: { item: true, inputFormula: true } }, specs: true }
    });
    if (!formula) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }
    const hasAccess = await ensureContainerAccess({
      userId: req.user?.sub ?? "",
      userRole: req.user?.role,
      containerId: formula.containerId,
      entity: "FORMULA",
      action: "READ"
    });
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const visited = new Set<string>();
    type Contribution = { code: string; name: string; weight: number; allergens: string[] };
    const contributions = new Map<string, Contribution>();

    const addContribution = (code: string, name: string, weight: number, allergens: string[]) => {
      const existing = contributions.get(code);
      if (existing) {
        existing.weight += weight;
        existing.allergens = Array.from(new Set([...existing.allergens, ...allergens]));
      } else {
        contributions.set(code, { code, name, weight, allergens });
      }
    };

    const extractAllergens = (attributes: unknown): string[] => {
      if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
        return [];
      }
      const raw = (attributes as Record<string, unknown>).allergens;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.map((entry) => String(entry));
      return String(raw).split(",").map((entry) => entry.trim()).filter(Boolean);
    };

    const nutritionSpecs: Array<{ attribute: string; value: string | null; minValue: number | null; maxValue: number | null; uom: string | null }> = [];
    const buildComposition = async (formulaId: string, scale: number): Promise<void> => {
      if (visited.has(formulaId)) return;
      visited.add(formulaId);
      const current = await prisma.formula.findUnique({
        where: { id: formulaId },
        include: { ingredients: { include: { item: true } }, specs: true }
      });
      if (!current) return;
      if (!nutritionSpecs.length && current.specs?.length) {
        const nutrition = current.specs.filter((spec) => spec.specType === "NUTRITION");
        if (nutrition.length) {
          nutritionSpecs.push(
            ...nutrition.map((spec) => ({
              attribute: spec.attribute,
              value: spec.value ?? null,
              minValue: spec.minValue ?? null,
              maxValue: spec.maxValue ?? null,
              uom: spec.uom ?? null
            }))
          );
        }
      }

      const validLines = current.ingredients.filter((line) => {
        if (line.inputFormulaId) return true;
        if (line.item) return line.item.itemType !== "PACKAGING";
        return false;
      });
      const totalQty = validLines.reduce((sum, line) => sum + (line.quantity || 0), 0);
      if (!totalQty) return;

      for (const line of validLines) {
        const ratio = (line.quantity || 0) / totalQty;
        const nextScale = scale * ratio;
        if (line.inputFormulaId) {
          await buildComposition(line.inputFormulaId, nextScale);
          continue;
        }
        if (line.item) {
          addContribution(line.item.itemCode, line.item.name, nextScale, extractAllergens(line.item.attributes));
        }
      }
    };

    await buildComposition(formula.id, 1);

    const totalWeight = Array.from(contributions.values()).reduce((sum, entry) => sum + entry.weight, 0);
    const composition = Array.from(contributions.values()).map((entry) => ({
      name: entry.name,
      code: entry.code,
      percentage: totalWeight ? Number(((entry.weight / totalWeight) * 100).toFixed(2)) : null,
      allergens: entry.allergens
    }));

    const sorted = [...composition].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
    const declaration = sorted.map((entry) => entry.name);
    const allergens = Array.from(new Set(sorted.flatMap((entry) => entry.allergens)));

    // Find linked FG item via FGStructure (used to auto-populate product name on label)
    const fgStructure = await prisma.fGStructure.findFirst({
      where: { formulaId: formula.id },
      include: { fgItem: { select: { id: true, itemCode: true, name: true } } },
      orderBy: { createdAt: "desc" }
    });
    const outputItem = fgStructure?.fgItem
      ? { id: fgStructure.fgItem.id, itemCode: fgStructure.fgItem.itemCode, name: fgStructure.fgItem.name }
      : null;

    res.json({
      declaration,
      composition: sorted.map(({ name, code, percentage }) => ({ name, code, percentage })),
      allergens,
      nutrition: nutritionSpecs,
      outputItem
    });
  } catch (error) {
    next(error);
  }
});

export default router;
