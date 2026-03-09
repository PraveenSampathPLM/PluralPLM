import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";

const router = Router();
const createChangeSchema = z.object({
  crNumber: z.string().min(2).optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  type: z.enum(["ECR", "ECO", "ECN", "DCO"]).default("ECR"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  containerId: z.string().optional(),
  affectedItems: z.array(z.string()).default([]),
  affectedFormulas: z.array(z.string()).default([]),
  proposedChanges: z.unknown().optional(),
  impactAssessment: z.string().optional(),
  status: z.enum(["NEW", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "IMPLEMENTED"]).default("NEW")
});

async function ensureWorkflowOnSubmit(changeId: string, status: string, industry: string): Promise<void> {
  if (status !== "SUBMITTED") {
    return;
  }

  const existing = await prisma.workflowInstance.findFirst({
    where: { entityType: "CHANGE_REQUEST", entityId: changeId }
  });
  if (existing) {
    return;
  }

  let definition = await prisma.workflowDefinition.findFirst({
    where: { industry, entityType: "CHANGE_REQUEST" }
  });
  if (!definition) {
    definition = await prisma.workflowDefinition.create({
      data: {
        name: "Change Management",
        industry,
        entityType: "CHANGE_REQUEST",
        states: ["NEW", "ASSESSMENT", "REVIEW", "APPROVAL", "IMPLEMENTATION"],
        transitions: [
          { from: "NEW", to: "ASSESSMENT", action: "SUBMIT" },
          { from: "ASSESSMENT", to: "REVIEW", action: "FORWARD" },
          { from: "REVIEW", to: "APPROVAL", action: "RECOMMEND" },
          { from: "APPROVAL", to: "IMPLEMENTATION", action: "APPROVE" }
        ],
        actions: { stateAssignments: {} }
      }
    });
  }

  const statesResult = z.array(z.string()).safeParse(definition.states);
  if (!statesResult.success || statesResult.data.length === 0) {
    return;
  }

  const startState = statesResult.data.includes("ASSESSMENT") ? "ASSESSMENT" : statesResult.data[0];
  await prisma.workflowInstance.create({
    data: {
      definitionId: definition.id,
      entityId: changeId,
      entityType: "CHANGE_REQUEST",
      currentState: startState,
      history: []
    }
  });
}

async function ensureChangeAccess(
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
    entity: "CHANGE",
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
    const where: Prisma.ChangeRequestWhereInput = !isGlobalAdmin(req.user?.role)
      ? { AND: [{ OR: [{ containerId: null }, { containerId: { in: await getAccessibleContainerIds(userId, "CHANGE", "READ") } }] }] }
      : {};
    if (containerId) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { containerId }];
    }

    const [data, total] = await Promise.all([
      prisma.changeRequest.findMany({
        where,
        include: { requestedBy: { include: { role: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.changeRequest.count({ where })
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

    const parsed = createChangeSchema.parse(req.body);
    const hasAccess = await ensureChangeAccess(req, parsed.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "No write access to selected container. Choose a container you can write to." });
      return;
    }
    const industry = parsed.containerId
      ? (await prisma.productContainer.findUnique({ where: { id: parsed.containerId }, select: { industry: true } }))?.industry ?? "CHEMICAL"
      : "CHEMICAL";
    const crNumber = parsed.crNumber ?? (await allocateNextSequenceValue("CHANGE_REQUEST"));
    const created = await prisma.changeRequest.create({
      data: {
        crNumber,
        title: parsed.title,
        description: parsed.description ?? null,
        type: parsed.type,
        priority: parsed.priority,
        ...(parsed.containerId ? { containerId: parsed.containerId } : {}),
        requestedById: requester,
        affectedItems: parsed.affectedItems,
        affectedFormulas: parsed.affectedFormulas,
        ...(parsed.proposedChanges ? { proposedChanges: parsed.proposedChanges as Prisma.InputJsonValue } : {}),
        ...(parsed.impactAssessment ? { impactAssessment: parsed.impactAssessment } : {}),
        status: parsed.status
      }
    });
    await ensureWorkflowOnSubmit(created.id, created.status, industry);
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "CHANGE_REQUEST",
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
    const record = await prisma.changeRequest.findUnique({ where: { id: req.params.id }, include: { requestedBy: true } });
    if (!record) {
      res.status(404).json({ message: "Change request not found" });
      return;
    }
    const hasAccess = await ensureChangeAccess(req, record.containerId, "READ");
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
    const existing = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ message: "Change request not found" });
      return;
    }
    const targetContainerId =
      typeof req.body?.containerId === "string" ? String(req.body.containerId) : req.body?.containerId === null ? null : existing.containerId;
    const hasAccess = await ensureChangeAccess(req, targetContainerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const industry = targetContainerId
      ? (await prisma.productContainer.findUnique({ where: { id: targetContainerId }, select: { industry: true } }))?.industry ?? "CHEMICAL"
      : "CHEMICAL";
    const updated = await prisma.changeRequest.update({ where: { id: req.params.id }, data: req.body });
    await ensureWorkflowOnSubmit(updated.id, updated.status, industry);
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "CHANGE_REQUEST",
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
    const changeId = String(req.params.id ?? "");
    const existing = await prisma.changeRequest.findUnique({ where: { id: changeId } });
    if (!existing) {
      res.status(404).json({ message: "Change request not found" });
      return;
    }
    const hasAccess = await ensureChangeAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await prisma.changeRequest.delete({ where: { id: changeId } });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "CHANGE_REQUEST",
      entityId: changeId,
      action: "DELETE",
      ...(actorId ? { actorId } : {}),
      payload: existing
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/:id/impact-analysis", async (req, res, next) => {
  try {
    const change = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
    if (!change) {
      res.status(404).json({ message: "Change request not found" });
      return;
    }
    const hasAccess = await ensureChangeAccess(req, change.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const impactedFormulas = await prisma.formula.findMany({ where: { formulaCode: { in: change.affectedFormulas } } });
    const impactedItems = await prisma.item.findMany({ where: { itemCode: { in: change.affectedItems } } });

    res.json({
      impactedFormulas,
      impactedItems,
      estimatedImpact: {
        regulatoryFlags: impactedItems.filter((item) => Boolean(item.regulatoryFlags)).length,
        downstreamFormulaCount: impactedFormulas.length
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/redline", async (_req, res) => {
  res.status(501).json({ message: "Redline comparison endpoint scaffolded. Add before/after snapshots next." });
});

export default router;
