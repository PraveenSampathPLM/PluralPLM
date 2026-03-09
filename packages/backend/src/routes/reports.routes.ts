import { Router } from "express";
import { prisma } from "../services/prisma.js";

const router = Router();

router.get("/formula-card/:formulaId", async (req, res, next) => {
  try {
    const formula = await prisma.formula.findUnique({
      where: { id: req.params.formulaId },
      include: { ingredients: { include: { item: true } }, owner: true }
    });

    if (!formula) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }

    res.json({
      reportType: "FORMULA_CARD",
      generatedAt: new Date().toISOString(),
      formula
    });
  } catch (error) {
    next(error);
  }
});

router.get("/kpis", async (_req, res, next) => {
  try {
    const [formulaLifecycle, changesByStatus] = await Promise.all([
      prisma.formula.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.changeRequest.groupBy({ by: ["status"], _count: { _all: true } })
    ]);

    res.json({ formulaLifecycle, changesByStatus });
  } catch (error) {
    next(error);
  }
});

export default router;
