import { Router } from "express";
import { prisma } from "../services/prisma.js";

const router = Router();

router.get("/checker/:formulaId", async (req, res, next) => {
  try {
    const formula = await prisma.formula.findUnique({ where: { id: req.params.formulaId }, include: { ingredients: { include: { item: true } } } });
    if (!formula) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }

    const flagged = formula.ingredients
      .map((ingredient) => ingredient.item)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => item.regulatoryFlags && Object.keys(item.regulatoryFlags as object).length > 0);

    res.json({
      formulaId: formula.id,
      status: flagged.length > 0 ? "REVIEW_REQUIRED" : "PASS",
      flaggedItems: flagged
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reports", async (_req, res) => {
  res.json({ message: "Compliance reporting scaffolded. Add REACH/FDA/FSSAI templates next." });
});

export default router;
