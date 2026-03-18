import { prisma } from "./prisma.js";
import { TaskPriority } from "@prisma/client";
import { z } from "zod";

export type StateAssignment = {
  roles?: string[];
  users?: string[];
  description?: string;
  slaHours?: number;
};

export type TransitionRule = { from: string; to: string; action: string; label?: string; style?: string };

export type WorkflowTransitionEvent = {
  from: string;
  to: string;
  action: string;
  actorId: string;
  comment?: string;
  at: string;
};

const transitionRuleSchema = z.object({
  from: z.string(),
  to: z.string(),
  action: z.string(),
  label: z.string().optional(),
  style: z.string().optional()
});

export function getStateAssignments(definition: { actions?: unknown }): Record<string, StateAssignment> {
  const actions = definition.actions;
  if (!actions || typeof actions !== "object") return {};
  const sa = (actions as { stateAssignments?: Record<string, StateAssignment> }).stateAssignments;
  if (!sa || typeof sa !== "object") return {};
  return sa;
}

export function parseTransitions(value: unknown): TransitionRule[] {
  const parsed = z.array(transitionRuleSchema).safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.map((t) => ({
    from: t.from,
    to: t.to,
    action: t.action,
    ...(t.label !== undefined ? { label: t.label } : {}),
    ...(t.style !== undefined ? { style: t.style } : {})
  }));
}

export function getRoutingOptions(currentState: string, transitions: TransitionRule[]) {
  return transitions
    .filter((t) => t.from === currentState)
    .map((t) => ({ action: t.action, toState: t.to, label: t.label ?? t.action, style: t.style ?? "default" }));
}

export function toCanonicalLifecycle(state: string): "IN_WORK" | "UNDER_REVIEW" | "RELEASED" | "OBSOLETE" | null {
  const n = state.trim().toUpperCase();
  if (!n) return null;
  if (n.includes("OBSOLETE")) return "OBSOLETE";
  if (n.includes("RELEASE") || n.includes("IMPLEMENT") || n.includes("CLOSE")) return "RELEASED";
  if (n.includes("REVIEW") || n.includes("APPROVAL") || n.includes("ASSESS")) return "UNDER_REVIEW";
  if (n.includes("WORK") || n.includes("NEW") || n.includes("DRAFT") || n.includes("REJECT")) return "IN_WORK";
  return null;
}

export function getObjectRoute(entityType: string, entityId: string): string | null {
  if (entityType === "CHANGE_REQUEST") return `/changes/${entityId}`;
  if (entityType === "RELEASE_REQUEST") return `/releases/${entityId}`;
  if (entityType === "FORMULA") return `/formulas/${entityId}`;
  if (entityType === "BOM" || entityType === "FG") return `/fg/${entityId}`;
  if (entityType === "ITEM") return `/items/${entityId}`;
  return null;
}

export async function getEntityContainerId(entityType: string, entityId: string): Promise<string | null> {
  if (entityType === "CHANGE_REQUEST") {
    return (await prisma.changeRequest.findUnique({ where: { id: entityId }, select: { containerId: true } }))?.containerId ?? null;
  }
  if (entityType === "RELEASE_REQUEST") {
    return (await prisma.releaseRequest.findUnique({ where: { id: entityId }, select: { containerId: true } }))?.containerId ?? null;
  }
  if (entityType === "FORMULA") {
    return (await prisma.formula.findUnique({ where: { id: entityId }, select: { containerId: true } }))?.containerId ?? null;
  }
  if (entityType === "BOM" || entityType === "FG") {
    return (await prisma.fGStructure.findUnique({ where: { id: entityId }, select: { containerId: true } }))?.containerId ?? null;
  }
  if (entityType === "ITEM") {
    return (await prisma.item.findUnique({ where: { id: entityId }, select: { containerId: true } }))?.containerId ?? null;
  }
  return null;
}

const PRIORITY_MAP: Record<string, TaskPriority> = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
};

export async function getEntityPriority(entityType: string, entityId: string): Promise<TaskPriority> {
  if (entityType === "CHANGE_REQUEST") {
    const cr = await prisma.changeRequest.findUnique({ where: { id: entityId }, select: { priority: true } });
    return PRIORITY_MAP[cr?.priority ?? "MEDIUM"] ?? "MEDIUM";
  }
  return "MEDIUM";
}

export async function createTaskForState(params: {
  workflowInstanceId: string;
  entityType: string;
  entityId: string;
  state: string;
  definitionName: string;
  stateAssignments: Record<string, StateAssignment>;
  containerId: string | null;
  priority: TaskPriority;
}): Promise<void> {
  const { workflowInstanceId, entityType, entityId, state, definitionName, stateAssignments, containerId, priority } = params;
  const assignment = stateAssignments[state] ?? {};
  const assignedRoles: string[] = assignment.roles ?? [];
  const description = typeof assignment.description === "string" ? assignment.description : null;
  const slaHours = typeof assignment.slaHours === "number" ? assignment.slaHours : null;
  const dueDate = slaHours ? new Date(Date.now() + slaHours * 60 * 60 * 1000) : null;

  await prisma.task.create({
    data: {
      workflowInstanceId,
      title: `${definitionName} — ${state}`,
      ...(description ? { description } : {}),
      state,
      status: "OPEN",
      priority,
      assignedRoles,
      ...(dueDate ? { dueDate } : {}),
      entityType,
      entityId,
      ...(containerId ? { containerId } : {})
    }
  });
}

export async function completeOpenTasksForInstance(
  workflowInstanceId: string,
  actorId: string,
  comment?: string
): Promise<void> {
  await prisma.task.updateMany({
    where: { workflowInstanceId, status: "OPEN" },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedByUserId: actorId,
      ...(comment ? { comment } : {})
    }
  });
}

export async function promoteByItemCodes(
  itemCodes: string[],
  targetStatus: "IN_WORK" | "UNDER_REVIEW" | "RELEASED" | "OBSOLETE"
): Promise<void> {
  if (itemCodes.length === 0) return;

  const latestItems = await prisma.item.findMany({
    where: { itemCode: { in: itemCodes } },
    distinct: ["itemCode"],
    orderBy: [{ itemCode: "asc" }, { revisionMajor: "desc" }, { revisionIteration: "desc" }],
    select: { id: true }
  });
  if (latestItems.length > 0) {
    await prisma.item.updateMany({ where: { id: { in: latestItems.map((i) => i.id) } }, data: { status: targetStatus } });
  }

  const fgStructures = await prisma.fGStructure.findMany({
    where: { fgItem: { itemCode: { in: itemCodes } } },
    orderBy: [{ fgItemId: "asc" }, { version: "desc" }],
    select: { id: true, fgItemId: true }
  });
  const latestFgIds: string[] = [];
  const seen = new Set<string>();
  for (const fg of fgStructures) {
    if (seen.has(fg.fgItemId)) continue;
    seen.add(fg.fgItemId);
    latestFgIds.push(fg.id);
  }
  if (latestFgIds.length > 0) {
    await prisma.fGStructure.updateMany({ where: { id: { in: latestFgIds } }, data: { status: targetStatus } });
  }
}

export async function promoteByFormulaCodes(
  formulaCodes: string[],
  targetStatus: "IN_WORK" | "UNDER_REVIEW" | "RELEASED" | "OBSOLETE"
): Promise<void> {
  if (formulaCodes.length === 0) return;
  const latestFormulas = await prisma.formula.findMany({
    where: { formulaCode: { in: formulaCodes } },
    distinct: ["formulaCode"],
    orderBy: [{ formulaCode: "asc" }, { version: "desc" }],
    select: { id: true }
  });
  if (latestFormulas.length > 0) {
    await prisma.formula.updateMany({ where: { id: { in: latestFormulas.map((f) => f.id) } }, data: { status: targetStatus } });
  }
}

export async function promoteLinkedObjects(
  entityType: string,
  entityId: string,
  targetStatus: "IN_WORK" | "UNDER_REVIEW" | "RELEASED" | "OBSOLETE"
): Promise<void> {
  if (entityType === "CHANGE_REQUEST") {
    const record = await prisma.changeRequest.findUnique({
      where: { id: entityId },
      select: { affectedItems: true, affectedFormulas: true, targetAction: true }
    });
    if (!record) return;
    // When the CR reaches RELEASED lifecycle, use the CR's targetAction to determine final object status
    let effectiveStatus = targetStatus;
    if (targetStatus === "RELEASED" && record.targetAction === "OBSOLETE") {
      effectiveStatus = "OBSOLETE";
    }
    await Promise.all([
      promoteByItemCodes(record.affectedItems, effectiveStatus),
      promoteByFormulaCodes(record.affectedFormulas, effectiveStatus)
    ]);
    return;
  }
  if (entityType === "RELEASE_REQUEST") {
    const record = await prisma.releaseRequest.findUnique({ where: { id: entityId }, select: { affectedItems: true, affectedFormulas: true } });
    if (!record) return;
    await Promise.all([promoteByItemCodes(record.affectedItems, targetStatus), promoteByFormulaCodes(record.affectedFormulas, targetStatus)]);
  }
}

export async function updateChangeOrReleaseStatus(entityType: string, entityId: string, lifecycle: string): Promise<void> {
  if (entityType === "CHANGE_REQUEST") {
    const mapped = lifecycle === "RELEASED" ? "IMPLEMENTED" : lifecycle === "UNDER_REVIEW" ? "UNDER_REVIEW" : "SUBMITTED";
    await prisma.changeRequest.update({ where: { id: entityId }, data: { status: mapped } });
    return;
  }
  if (entityType === "RELEASE_REQUEST") {
    const mapped = lifecycle === "RELEASED" ? "RELEASED" : lifecycle === "UNDER_REVIEW" ? "UNDER_REVIEW" : "SUBMITTED";
    await prisma.releaseRequest.update({ where: { id: entityId }, data: { status: mapped } });
  }
}

// ─── Spawn a new workflow instance and create the initial task ───────────────
export async function spawnWorkflowInstance(params: {
  definitionId: string;
  entityId: string;
  entityType: string;
  currentState: string;
  containerId?: string | null;
}): Promise<{ id: string }> {
  const { definitionId, entityId, entityType, currentState } = params;
  const containerId = params.containerId ?? (await getEntityContainerId(entityType, entityId));

  const definition = await prisma.workflowDefinition.findUniqueOrThrow({ where: { id: definitionId } });

  const instance = await prisma.workflowInstance.create({
    data: { definitionId, entityId, entityType, currentState, history: [] }
  });

  const priority = await getEntityPriority(entityType, entityId);
  const stateAssignments = getStateAssignments(definition);
  await createTaskForState({
    workflowInstanceId: instance.id,
    entityType,
    entityId,
    state: currentState,
    definitionName: definition.name,
    stateAssignments,
    containerId,
    priority
  });

  return instance;
}

// ─── Execute a workflow transition: validate → complete tasks → create new task → promote ──
export async function executeWorkflowTransition(params: {
  instanceId: string;
  action: string;
  toState: string;
  actorId: string;
  comment?: string;
}): Promise<{ instance: { id: string; currentState: string; history: unknown }; promotedLifecycle: string | null }> {
  const { instanceId, action, toState, actorId, comment } = params;

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { definition: true }
  });
  if (!instance) throw Object.assign(new Error("Workflow instance not found"), { statusCode: 404 });

  const statesResult = z.array(z.string()).safeParse(instance.definition.states);
  if (!statesResult.success) throw new Error("Workflow definition states are invalid");
  if (!statesResult.data.includes(toState)) throw Object.assign(new Error(`Invalid target state '${toState}'`), { statusCode: 400 });

  const transitions = parseTransitions(instance.definition.transitions);
  const allowed = transitions.find(
    (t) => t.from === instance.currentState && t.to === toState && t.action.toUpperCase() === action.toUpperCase()
  );
  if (!allowed) {
    throw Object.assign(
      new Error(`Transition ${instance.currentState} → ${toState} with action '${action}' is not allowed`),
      { statusCode: 400 }
    );
  }

  const currentHistory = Array.isArray(instance.history) ? (instance.history as WorkflowTransitionEvent[]) : [];
  const transition: WorkflowTransitionEvent = {
    from: instance.currentState,
    to: toState,
    action: allowed.action,
    actorId,
    ...(comment ? { comment } : {}),
    at: new Date().toISOString()
  };

  const updated = await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: { currentState: toState, history: [...currentHistory, transition] }
  });

  // Complete open tasks for this instance, then create new task for next state
  await completeOpenTasksForInstance(instanceId, actorId, comment);

  const containerId = await getEntityContainerId(instance.entityType, instance.entityId);
  const priority = await getEntityPriority(instance.entityType, instance.entityId);
  const stateAssignments = getStateAssignments(instance.definition);

  // Only create a task for non-terminal states (states that have outgoing transitions or role assignments)
  const outgoingTransitions = transitions.filter((t) => t.from === toState);
  const hasAssignment = Boolean(stateAssignments[toState]);
  if (outgoingTransitions.length > 0 || hasAssignment) {
    await createTaskForState({
      workflowInstanceId: instanceId,
      entityType: instance.entityType,
      entityId: instance.entityId,
      state: toState,
      definitionName: instance.definition.name,
      stateAssignments,
      containerId,
      priority
    });
  }

  // Promote linked objects if Change/Release
  const promotedLifecycle = toCanonicalLifecycle(toState);
  if (promotedLifecycle && (instance.entityType === "CHANGE_REQUEST" || instance.entityType === "RELEASE_REQUEST")) {
    await updateChangeOrReleaseStatus(instance.entityType, instance.entityId, promotedLifecycle);
    await promoteLinkedObjects(instance.entityType, instance.entityId, promotedLifecycle);
  }

  return { instance: updated, promotedLifecycle };
}
