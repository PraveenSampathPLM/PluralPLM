import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { authorize } from "../middleware/auth.middleware.js";
import { Industry } from "@prisma/client";
import {
  getStateAssignments,
  parseTransitions,
  getRoutingOptions,
  toCanonicalLifecycle,
  getObjectRoute,
  getEntityContainerId,
  getEntityPriority,
  createTaskForState,
  spawnWorkflowInstance,
  executeWorkflowTransition
} from "../services/workflow.service.js";

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

// ─── Workflow Definitions ─────────────────────────────────────────────────────

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
    await writeAuditLog({ entityType: "WORKFLOW_DEFINITION", entityId: created.id, action: "CREATE", ...(actorId ? { actorId } : {}), payload: created });
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
    await writeAuditLog({ entityType: "WORKFLOW_DEFINITION", entityId: updated.id, action: "UPDATE", ...(actorId ? { actorId } : {}), payload: updated });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ─── Workflow Instances ───────────────────────────────────────────────────────

router.get("/instances", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const entityIdRaw = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const entityIds = entityIdRaw ? entityIdRaw.split(",").map((v) => v.trim()).filter(Boolean) : [];
    const where = entityType || entityIds.length
      ? { ...(entityType ? { entityType } : {}), ...(entityIds.length ? { entityId: { in: entityIds } } : {}) }
      : undefined;

    const [data, total] = await Promise.all([
      prisma.workflowInstance.findMany({
        ...(where ? { where } : {}),
        include: {
          definition: true,
          tasks: {
            include: {
              assignedToUser: { select: { id: true, name: true, email: true } },
              completedBy: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: "asc" }
          }
        },
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

router.post("/instances", async (req, res, next) => {
  try {
    const parsed = createInstanceSchema.parse(req.body);
    const definition = await prisma.workflowDefinition.findUnique({ where: { id: parsed.definitionId } });
    if (!definition) {
      res.status(400).json({ message: "Workflow definition not found" });
      return;
    }

    const statesResult = z.array(z.string()).safeParse(definition.states);
    if (!statesResult.success || !statesResult.data.includes(parsed.currentState)) {
      res.status(400).json({ message: `Invalid starting state '${parsed.currentState}'` });
      return;
    }

    const instance = await spawnWorkflowInstance({
      definitionId: parsed.definitionId,
      entityId: parsed.entityId,
      entityType: parsed.entityType,
      currentState: parsed.currentState
    });

    res.status(201).json(instance);
  } catch (error) {
    next(error);
  }
});

router.post("/instances/:id/action", async (req, res, next) => {
  try {
    const action = String(req.body.action ?? "");
    const toState = String(req.body.toState ?? "");
    const comment = req.body.comment ? String(req.body.comment) : undefined;
    const actorId = req.user?.sub;

    if (!action || !toState) {
      res.status(400).json({ message: "action and toState are required" });
      return;
    }
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { instance, promotedLifecycle } = await executeWorkflowTransition({
      instanceId: req.params.id,
      action,
      toState,
      actorId,
      ...(comment ? { comment } : {})
    });

    await writeAuditLog({
      entityType: "WORKFLOW_INSTANCE",
      entityId: instance.id,
      action: `TRANSITION_${action.toUpperCase()}`,
      actorId,
      payload: { from: instance.currentState, to: toState, comment, promotedLifecycle }
    });

    res.json(instance);
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 400) {
      res.status(statusCode).json({ message: (error as Error).message });
      return;
    }
    next(error);
  }
});

// ─── Task Inbox ───────────────────────────────────────────────────────────────

router.get("/tasks", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Resolve user's role per container for filtering
    const memberships = await prisma.containerMembership.findMany({
      where: { userId },
      include: { containerRole: { select: { name: true } } }
    });
    const roleByContainer = new Map(memberships.map((m) => [m.containerId, m.containerRole.name]));
    const myContainerIds = memberships.map((m) => m.containerId);

    // Resolve status filter (default: OPEN only)
    const statusParam = typeof req.query.status === "string" ? req.query.status.toUpperCase() : "OPEN";
    const statusFilter = statusParam === "ALL" ? undefined : (statusParam as "OPEN" | "COMPLETED" | "CANCELLED");
    const entityIdParam = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const entityTypeParam = typeof req.query.entityType === "string" ? req.query.entityType : undefined;

    // Fetch tasks the user could possibly see
    const tasks = await prisma.task.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(entityIdParam ? { entityId: entityIdParam } : {}),
        ...(entityTypeParam ? { entityType: entityTypeParam } : {}),
        OR: [
          { assignedToUserId: userId },
          { containerId: null },
          { containerId: { in: myContainerIds } }
        ]
      },
      include: {
        workflowInstance: { include: { definition: true } },
        assignedToUser: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } }
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]
    });

    // Filter by role assignment
    const visible = tasks.filter((task) => {
      if (!task.workflowInstance) return false;
      if (task.assignedToUserId === userId) return true;
      if (task.assignedRoles.length === 0) return true;
      const myRole = task.containerId ? roleByContainer.get(task.containerId) : null;
      return myRole ? task.assignedRoles.includes(myRole) : false;
    });

    const result = visible.map((task) => {
      const transitions = parseTransitions(task.workflowInstance.definition.transitions);
      const routingOptions = getRoutingOptions(task.state, transitions);
      const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() : false;
      return {
        id: task.id,
        instanceId: task.workflowInstanceId,
        title: task.title,
        description: task.description,
        state: task.state,
        status: task.status,
        priority: task.priority,
        assignedRoles: task.assignedRoles,
        assignedToUser: task.assignedToUser,
        dueDate: task.dueDate,
        isOverdue,
        entityType: task.entityType,
        entityId: task.entityId,
        containerId: task.containerId,
        definitionName: task.workflowInstance.definition.name,
        routingOptions,
        objectRoute: getObjectRoute(task.entityType, task.entityId),
        canonicalStatus: toCanonicalLifecycle(task.state),
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        completedBy: task.completedBy,
        comment: task.comment
      };
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/tasks/:taskId", async (req, res, next) => {
  try {
    const taskId = String(req.params.taskId ?? "");
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        workflowInstance: { include: { definition: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true } }
      }
    });
    if (!task || !task.workflowInstance) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const transitions = parseTransitions(task.workflowInstance.definition.transitions);
    const routingOptions = getRoutingOptions(task.state, transitions);
    const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() : false;

    res.json({
      ...task,
      routingOptions,
      objectRoute: getObjectRoute(task.entityType, task.entityId),
      canonicalStatus: toCanonicalLifecycle(task.state),
      isOverdue,
      workflowHistory: task.workflowInstance.history
    });
  } catch (error) {
    next(error);
  }
});

router.post("/tasks/:taskId/route", async (req, res, next) => {
  try {
    const taskId = String(req.params.taskId ?? "");
    const action = String(req.body.action ?? "");
    const toState = String(req.body.toState ?? "");
    const comment = req.body.comment ? String(req.body.comment).trim() : "";
    const actorId = req.user?.sub;

    if (!action || !toState) {
      res.status(400).json({ message: "action and toState are required" });
      return;
    }
    if (!comment) {
      res.status(400).json({ message: "A signoff comment is required to route this task." });
      return;
    }
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { workflowInstance: true }
    });
    if (!task || !task.workflowInstance) {
      res.status(404).json({ message: "Task not found" });
      return;
    }
    if (task.status !== "OPEN") {
      res.status(400).json({ message: "Task is already completed or cancelled" });
      return;
    }

    const { instance, promotedLifecycle } = await executeWorkflowTransition({
      instanceId: task.workflowInstanceId,
      action,
      toState,
      actorId,
      comment
    });

    await writeAuditLog({
      entityType: "WORKFLOW_INSTANCE",
      entityId: instance.id,
      action: `TRANSITION_${action.toUpperCase()}`,
      actorId,
      payload: { taskId, from: task.state, to: toState, comment, promotedLifecycle }
    });

    res.json({ message: "Task routed successfully", promotedLifecycle });
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 400) {
      res.status(statusCode).json({ message: (error as Error).message });
      return;
    }
    next(error);
  }
});

router.patch("/tasks/:taskId/assign", async (req, res, next) => {
  try {
    const taskId = String(req.params.taskId ?? "");
    const assignedToUserId = req.body.assignedToUserId ? String(req.body.assignedToUserId) : null;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { assignedToUserId }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
