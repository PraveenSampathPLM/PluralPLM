import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { ensureContainerAccess } from "../services/container-access.service.js";

const router = Router();

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
      userId: req.user?.sub,
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
      if (!raw) {
        return [];
      }
      if (Array.isArray(raw)) {
        return raw.map((entry) => String(entry));
      }
      return String(raw)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    };

    const nutritionSpecs: Array<{ attribute: string; value: string | null; minValue: number | null; maxValue: number | null; uom: string | null }> = [];
    const buildComposition = async (formulaId: string, scale: number): Promise<void> => {
      if (visited.has(formulaId)) {
        return;
      }
      visited.add(formulaId);
      const current = await prisma.formula.findUnique({
        where: { id: formulaId },
        include: { ingredients: { include: { item: true } }, specs: true }
      });
      if (!current) {
        return;
      }
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
        if (line.inputFormulaId) {
          return true;
        }
        if (line.item) {
          return line.item.itemType !== "PACKAGING";
        }
        return false;
      });
      const totalQty = validLines.reduce((sum, line) => sum + (line.quantity || 0), 0);
      if (!totalQty) {
        return;
      }

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

    res.json({
      declaration,
      composition: sorted.map(({ name, code, percentage }) => ({ name, code, percentage })),
      allergens,
      nutrition: nutritionSpecs
    });
  } catch (error) {
    next(error);
  }
});

export default router;
