import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { authorize } from "../middleware/auth.middleware.js";
import { Industry } from "@prisma/client";

type WorkflowTransitionEvent = {
  from: string;
  to: string;
  action: string;
  actorId: string;
  comment?: string;
  at: string;
};

type StateAssignment = {
  roles?: string[];
  users?: string[];
};

const router = Router();

const createDefinitionSchema = z.object({
  name: z.string().min(2),
  states: z.array(z.string().min(1)),
  transitions: z.array(z.object({ from: z.string(), to: z.string(), action: z.string() })),
  actions: z.unknown().optional(),
  entityType: z.string().min(2),
  industry: z.nativeEnum(Industry).optional()
});

const updateDefinitionSchema = createDefinitionSchema.partial();

const createInstanceSchema = z.object({
  definitionId: z.string().min(1),
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  currentState: z.string().min(1)
});

const transitionRuleSchema = z.object({
  from: z.string(),
  to: z.string(),
  action: z.string()
});

function getStateAssignments(definition: { actions?: unknown }): Record<string, StateAssignment> {
  const actions = definition.actions;
  if (!actions || typeof actions !== "object") {
    return {};
  }
  const stateAssignments = (actions as { stateAssignments?: Record<string, StateAssignment> }).stateAssignments;
  if (!stateAssignments || typeof stateAssignments !== "object") {
    return {};
  }
  return stateAssignments;
}

router.get("/definitions", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);

    const industry = typeof req.query.industry === "string" ? req.query.industry : undefined;
    const [data, total] = await Promise.all([
      prisma.workflowDefinition.findMany({
        ...(industry ? { where: { industry: industry as Industry } } : {}),
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" }
      }),
      prisma.workflowDefinition.count({ ...(industry ? { where: { industry: industry as Industry } } : {}) })
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.post("/definitions", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const parsed = createDefinitionSchema.parse(req.body);
    const created = await prisma.workflowDefinition.create({
      data: {
        name: parsed.name,
        states: parsed.states,
        transitions: parsed.transitions,
        actions: parsed.actions ?? {},
        entityType: parsed.entityType,
        industry: parsed.industry ?? "CHEMICAL"
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "WORKFLOW_DEFINITION",
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

router.put("/definitions/:id", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const definitionId = String(req.params.id ?? "");
    const existing = await prisma.workflowDefinition.findUnique({ where: { id: definitionId } });
    if (!existing) {
      res.status(404).json({ message: "Workflow definition not found" });
      return;
    }
    const parsed = updateDefinitionSchema.parse(req.body);
    const updated = await prisma.workflowDefinition.update({
      where: { id: definitionId },
      data: {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.states ? { states: parsed.states } : {}),
        ...(parsed.transitions ? { transitions: parsed.transitions } : {}),
        ...(parsed.actions ? { actions: parsed.actions } : {}),
        ...(parsed.entityType ? { entityType: parsed.entityType } : {}),
        ...(parsed.industry ? { industry: parsed.industry } : {})
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "WORKFLOW_DEFINITION",
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

router.get("/instances", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const entityIdRaw = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const entityIds = entityIdRaw ? entityIdRaw.split(",").map((value) => value.trim()).filter(Boolean) : [];
    const where =
      entityType || entityIds.length
        ? {
            ...(entityType ? { entityType } : {}),
            ...(entityIds.length ? { entityId: { in: entityIds } } : {})
          }
        : undefined;

    const [data, total] = await Promise.all([
      prisma.workflowInstance.findMany({
        ...(where ? { where } : {}),
        include: { definition: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" }
      }),
      prisma.workflowInstance.count({ ...(where ? { where } : {}) })
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.get("/tasks", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const instances = await prisma.workflowInstance.findMany({
      include: { definition: true },
      orderBy: { updatedAt: "desc" }
    });

    const tasks = [];
    for (const instance of instances) {
      let containerId: string | null = null;
      if (instance.entityType === "CHANGE_REQUEST") {
        const record = await prisma.changeRequest.findUnique({ where: { id: instance.entityId }, select: { containerId: true } });
        containerId = record?.containerId ?? null;
      } else if (instance.entityType === "RELEASE_REQUEST") {
        const record = await prisma.releaseRequest.findUnique({ where: { id: instance.entityId }, select: { containerId: true } });
        containerId = record?.containerId ?? null;
      } else if (instance.entityType === "FORMULA") {
        const record = await prisma.formula.findUnique({ where: { id: instance.entityId }, select: { containerId: true } });
        containerId = record?.containerId ?? null;
      } else if (instance.entityType === "BOM") {
        const record = await prisma.bOM.findUnique({ where: { id: instance.entityId }, select: { containerId: true } });
        containerId = record?.containerId ?? null;
      } else if (instance.entityType === "ITEM") {
        const record = await prisma.item.findUnique({ where: { id: instance.entityId }, select: { containerId: true } });
        containerId = record?.containerId ?? null;
      }

      const assignments = getStateAssignments(instance.definition);
      const assignment = assignments[instance.currentState] ?? {};
      const assignedRoles = assignment.roles ?? [];
      const description = typeof assignment.description === "string" ? assignment.description : null;

      let matchesRole = false;
      if (containerId && assignedRoles.length) {
        const membership = await prisma.containerMembership.findUnique({
          where: { containerId_userId: { containerId, userId } },
          include: { containerRole: true }
        });
        if (membership?.containerRole?.name) {
          matchesRole = assignedRoles.includes(membership.containerRole.name);
        }
      }

      if (matchesRole) {
        tasks.push({
          instanceId: instance.id,
          entityType: instance.entityType,
          entityId: instance.entityId,
          currentState: instance.currentState,
          definitionName: instance.definition.name,
          assignedRoles,
          assignedUsers: [],
          description
        });
      }
    }

    res.json({ data: tasks });
  } catch (error) {
    next(error);
  }
});

router.post("/instances", async (req, res, next) => {
  try {
    const parsed = createInstanceSchema.parse(req.body);
    const created = await prisma.workflowInstance.create({
      data: {
        ...parsed,
        history: []
      }
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post("/instances/:id/action", async (req, res, next) => {
  try {
    const action = String(req.body.action ?? "");
    const toState = String(req.body.toState ?? "");
    const comment = req.body.comment ? String(req.body.comment) : undefined;
    if (!action || !toState) {
      res.status(400).json({ message: "action and toState are required" });
      return;
    }

    const instance = await prisma.workflowInstance.findUnique({
      where: { id: req.params.id },
      include: { definition: true }
    });
    if (!instance) {
      res.status(404).json({ message: "Workflow instance not found" });
      return;
    }

    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const statesResult = z.array(z.string()).safeParse(instance.definition.states);
    if (!statesResult.success) {
      res.status(500).json({ message: "Workflow definition states are invalid" });
      return;
    }

    if (!statesResult.data.includes(toState)) {
      res.status(400).json({ message: `Invalid target state '${toState}'` });
      return;
    }

    const transitionsResult = z.array(transitionRuleSchema).safeParse(instance.definition.transitions);
    if (!transitionsResult.success) {
      res.status(500).json({ message: "Workflow definition transitions are invalid" });
      return;
    }

    const allowedTransition = transitionsResult.data.find(
      (transition) =>
        transition.from === instance.currentState &&
        transition.to === toState &&
        transition.action.toUpperCase() === action.toUpperCase()
    );
    if (!allowedTransition) {
      res.status(400).json({
        message: `Transition ${instance.currentState} -> ${toState} with action '${action}' is not allowed`
      });
      return;
    }

    const currentHistory = Array.isArray(instance.history) ? (instance.history as WorkflowTransitionEvent[]) : [];
    const transition: WorkflowTransitionEvent = {
      from: instance.currentState,
      to: toState,
      action: allowedTransition.action,
      actorId,
      ...(comment ? { comment } : {}),
      at: new Date().toISOString()
    };

    const updated = await prisma.workflowInstance.update({
      where: { id: req.params.id },
      data: {
        currentState: toState,
        history: [...currentHistory, transition]
      }
    });

    await writeAuditLog({
      entityType: "WORKFLOW_INSTANCE",
      entityId: updated.id,
      action: `TRANSITION_${action}`,
      actorId,
      payload: transition
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
