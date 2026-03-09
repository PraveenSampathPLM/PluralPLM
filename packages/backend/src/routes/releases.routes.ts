import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";

const router = Router();

const createReleaseSchema = z.object({
  rrNumber: z.string().min(2).optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  containerId: z.string().optional(),
  targetItems: z.array(z.string()).default([]),
  targetBoms: z.array(z.string()).default([]),
  targetFormulas: z.array(z.string()).default([]),
  status: z.enum(["NEW", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "RELEASED", "REJECTED"]).default("NEW")
});

async function ensureReleaseAccess(
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
    entity: "RELEASE",
    action
  });
}

async function collectFormula(
  formulaId: string,
  items: Set<string>,
  formulas: Set<string>,
  visited: Set<string>
): Promise<void> {
  if (visited.has(formulaId)) {
    return;
  }
  visited.add(formulaId);

  const formula = await prisma.formula.findUnique({
    where: { id: formulaId },
    include: { ingredients: true, outputItem: true }
  });
  if (!formula) {
    return;
  }
  formulas.add(formula.formulaCode);

  if (formula.outputItem) {
    items.add(formula.outputItem.itemCode);
  }

  for (const ingredient of formula.ingredients) {
    if (ingredient.itemId) {
      const item = await prisma.item.findUnique({ where: { id: ingredient.itemId } });
      if (item) {
        items.add(item.itemCode);
      }
    }
    if (ingredient.inputFormulaId) {
      await collectFormula(ingredient.inputFormulaId, items, formulas, visited);
    }
  }
}

async function collectBom(
  bomId: string,
  items: Set<string>,
  formulas: Set<string>,
  boms: Set<string>
): Promise<void> {
  const bom = await prisma.bOM.findUnique({
    where: { id: bomId },
    include: { parentItem: true, formula: true, lines: true }
  });
  if (!bom) {
    return;
  }
  boms.add(bom.bomCode);

  if (bom.parentItem) {
    items.add(bom.parentItem.itemCode);
  }
  if (bom.formulaId) {
    await collectFormula(bom.formulaId, items, formulas, new Set());
  }

  for (const line of bom.lines) {
    if (line.itemId) {
      const item = await prisma.item.findUnique({ where: { id: line.itemId } });
      if (item) {
        items.add(item.itemCode);
      }
    }
    if (line.inputFormulaId) {
      await collectFormula(line.inputFormulaId, items, formulas, new Set());
    }
  }
}

async function collectFromItem(itemId: string, items: Set<string>, formulas: Set<string>, boms: Set<string>): Promise<void> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return;
  }
  items.add(item.itemCode);

  const formulaCandidates = await prisma.formula.findMany({
    where: {
      OR: [{ outputItemId: itemId }, { ingredients: { some: { itemId } } }]
    },
    select: { id: true }
  });
  for (const formula of formulaCandidates) {
    await collectFormula(formula.id, items, formulas, new Set());
  }

  const bomCandidates = await prisma.bOM.findMany({
    where: {
      OR: [{ parentItemId: itemId }, { lines: { some: { itemId } } }]
    },
    select: { id: true }
  });
  for (const bom of bomCandidates) {
    await collectBom(bom.id, items, formulas, boms);
  }
}

async function ensureWorkflowOnSubmit(releaseId: string, status: string, industry: string): Promise<void> {
  if (status !== "SUBMITTED") {
    return;
  }

  const existing = await prisma.workflowInstance.findFirst({
    where: { entityType: "RELEASE_REQUEST", entityId: releaseId }
  });
  if (existing) {
    return;
  }

  let definition = await prisma.workflowDefinition.findFirst({
    where: { industry, entityType: "RELEASE_REQUEST" }
  });
  if (!definition) {
    definition = await prisma.workflowDefinition.create({
      data: {
        name: "Release Management",
        industry,
        entityType: "RELEASE_REQUEST",
        states: ["NEW", "REVIEW", "APPROVAL", "RELEASED"],
        transitions: [
          { from: "NEW", to: "REVIEW", action: "SUBMIT" },
          { from: "REVIEW", to: "APPROVAL", action: "APPROVE" },
          { from: "APPROVAL", to: "RELEASED", action: "RELEASE" }
        ],
        actions: { stateAssignments: {} }
      }
    });
  }

  const statesResult = z.array(z.string()).safeParse(definition.states);
  if (!statesResult.success || statesResult.data.length === 0) {
    return;
  }

  const startState = statesResult.data.includes("REVIEW") ? "REVIEW" : statesResult.data[0];
  await prisma.workflowInstance.create({
    data: {
      definitionId: definition.id,
      entityId: releaseId,
      entityType: "RELEASE_REQUEST",
      currentState: startState,
      history: []
    }
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
    const where: Prisma.ReleaseRequestWhereInput = !isGlobalAdmin(req.user?.role)
      ? { AND: [{ OR: [{ containerId: null }, { containerId: { in: await getAccessibleContainerIds(userId, "RELEASE", "READ") } }] }] }
      : {};
    if (containerId) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { containerId }];
    }

    const [data, total] = await Promise.all([
      prisma.releaseRequest.findMany({
        where,
        include: { requestedBy: { include: { role: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.releaseRequest.count({ where })
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const requester = req.user?.sub;
    if (!requester) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const parsed = createReleaseSchema.parse(req.body);
    const hasAccess = await ensureReleaseAccess(req, parsed.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "No write access to selected container. Choose a container you can write to." });
      return;
    }
    const industry = parsed.containerId
      ? (await prisma.productContainer.findUnique({ where: { id: parsed.containerId }, select: { industry: true } }))?.industry ?? "CHEMICAL"
      : "CHEMICAL";
    const rrNumber = parsed.rrNumber ?? (await allocateNextSequenceValue("RELEASE_REQUEST"));

    const items = new Set<string>();
    const formulas = new Set<string>();
    const boms = new Set<string>();

    for (const itemId of parsed.targetItems) {
      await collectFromItem(itemId, items, formulas, boms);
    }
    for (const formulaId of parsed.targetFormulas) {
      await collectFormula(formulaId, items, formulas, new Set());
    }
    for (const bomId of parsed.targetBoms) {
      await collectBom(bomId, items, formulas, boms);
    }

    const created = await prisma.releaseRequest.create({
      data: {
        rrNumber,
        title: parsed.title,
        description: parsed.description ?? null,
        status: parsed.status,
        requestedById: requester,
        ...(parsed.containerId ? { containerId: parsed.containerId } : {}),
        targetItems: parsed.targetItems,
        targetBoms: parsed.targetBoms,
        targetFormulas: parsed.targetFormulas,
        affectedItems: Array.from(items),
        affectedFormulas: Array.from(formulas),
        affectedBoms: Array.from(boms)
      }
    });
    await ensureWorkflowOnSubmit(created.id, created.status, industry);

    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "RELEASE_REQUEST",
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
    const record = await prisma.releaseRequest.findUnique({ where: { id: req.params.id }, include: { requestedBy: true } });
    if (!record) {
      res.status(404).json({ message: "Release request not found" });
      return;
    }
    const hasAccess = await ensureReleaseAccess(req, record.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json(record);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.releaseRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ message: "Release request not found" });
      return;
    }
    const targetContainerId =
      typeof req.body?.containerId === "string" ? String(req.body.containerId) : req.body?.containerId === null ? null : existing.containerId;
    const hasAccess = await ensureReleaseAccess(req, targetContainerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const industry = targetContainerId
      ? (await prisma.productContainer.findUnique({ where: { id: targetContainerId }, select: { industry: true } }))?.industry ?? "CHEMICAL"
      : "CHEMICAL";
    const updated = await prisma.releaseRequest.update({ where: { id: req.params.id }, data: req.body });
    await ensureWorkflowOnSubmit(updated.id, updated.status, industry);
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "RELEASE_REQUEST",
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

router.delete("/:id", async (req, res, next) => {
  try {
    const releaseId = String(req.params.id ?? "");
    const existing = await prisma.releaseRequest.findUnique({ where: { id: releaseId } });
    if (!existing) {
      res.status(404).json({ message: "Release request not found" });
      return;
    }
    const hasAccess = await ensureReleaseAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await prisma.releaseRequest.delete({ where: { id: releaseId } });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "RELEASE_REQUEST",
      entityId: releaseId,
      action: "DELETE",
      ...(actorId ? { actorId } : {}),
      payload: existing
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
