import { Router } from "express";
import { Industry, Prisma } from "@prisma/client";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";
import { spawnWorkflowInstance } from "../services/workflow.service.js";
import { reviseEntity } from "../services/versioning.service.js";

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
  affectedDocuments: z.array(z.string()).default([]),
  proposedChanges: z.unknown().optional(),
  impactAssessment: z.string().optional(),
  status: z.enum(["NEW", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "IMPLEMENTED"]).default("NEW")
});

async function ensureWorkflowOnSubmit(changeId: string, status: string, industry: string, containerId?: string | null): Promise<void> {
  if (status !== "SUBMITTED") return;

  const existing = await prisma.workflowInstance.findFirst({
    where: { entityType: "CHANGE_REQUEST", entityId: changeId }
  });
  if (existing) return;

  let definition = await prisma.workflowDefinition.findFirst({
    where: { industry: industry as Industry, entityType: "CHANGE_REQUEST" }
  });
  if (!definition) {
    definition = await prisma.workflowDefinition.create({
      data: {
        name: "Change Management",
        industry: industry as Industry,
        entityType: "CHANGE_REQUEST",
        states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
        transitions: [
          { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT" },
          { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES" },
          { from: "UNDER_REVIEW", to: "RELEASED", action: "APPROVE" }
        ],
        actions: {
          stateAssignments: {
            UNDER_REVIEW: { roles: [], description: "Review and approve the change request.", slaHours: 72 },
            RELEASED: { roles: [], description: "Change implemented and closed." }
          }
        }
      }
    });
  }

  const statesResult = z.array(z.string()).safeParse(definition.states);
  if (!statesResult.success || statesResult.data.length === 0) return;

  const startState = statesResult.data.includes("UNDER_REVIEW") ? "UNDER_REVIEW" : (statesResult.data[0] ?? "IN_WORK");
  await spawnWorkflowInstance({
    definitionId: definition.id,
    entityId: changeId,
    entityType: "CHANGE_REQUEST",
    currentState: startState,
    containerId: containerId ?? null
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

    // ── Business rule: all affected objects must be RELEASED ──────────────────
    if (parsed.affectedItems.length > 0) {
      const releasedItems = await prisma.item.findMany({
        where: { itemCode: { in: parsed.affectedItems }, status: "RELEASED" },
        select: { itemCode: true }
      });
      const releasedCodes = new Set(releasedItems.map((i) => i.itemCode));
      const notReleased = parsed.affectedItems.filter((code) => !releasedCodes.has(code));
      if (notReleased.length > 0) {
        res.status(422).json({
          message: `Change requests can only be raised on Released objects. The following items are not Released: ${notReleased.join(", ")}. Release them first, then raise the change.`
        });
        return;
      }
    }
    if (parsed.affectedFormulas.length > 0) {
      const releasedFormulas = await prisma.formula.findMany({
        where: { formulaCode: { in: parsed.affectedFormulas }, status: "RELEASED" },
        select: { formulaCode: true }
      });
      const releasedCodes = new Set(releasedFormulas.map((f) => f.formulaCode));
      const notReleased = parsed.affectedFormulas.filter((code) => !releasedCodes.has(code));
      if (notReleased.length > 0) {
        res.status(422).json({
          message: `Change requests can only be raised on Released objects. The following formulas are not Released: ${notReleased.join(", ")}. Release them first, then raise the change.`
        });
        return;
      }
    }
    if (parsed.affectedDocuments.length > 0) {
      const releasedDocs = await prisma.document.findMany({
        where: { docNumber: { in: parsed.affectedDocuments }, status: "RELEASED" },
        select: { docNumber: true }
      });
      const releasedCodes = new Set(releasedDocs.map((d) => d.docNumber));
      const notReleased = parsed.affectedDocuments.filter((code) => !releasedCodes.has(code));
      if (notReleased.length > 0) {
        res.status(422).json({
          message: `Change requests can only be raised on Released objects. The following documents are not Released: ${notReleased.join(", ")}. Release them first, then raise the change.`
        });
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const industry = parsed.containerId
      ? (await prisma.productContainer.findUnique({ where: { id: parsed.containerId }, select: { industry: true } }))?.industry ?? "CHEMICAL"
      : "CHEMICAL";
    const crNumber = parsed.crNumber ?? (await allocateNextSequenceValue("CHANGE_REQUEST", parsed.containerId));

    // Merge documents from proposedChanges.affectedDocuments (legacy) with affectedDocuments field
    const legacyDocCodes: string[] = (() => {
      try {
        const pc = parsed.proposedChanges as Record<string, unknown> | null | undefined;
        if (Array.isArray(pc?.affectedDocuments)) return pc!.affectedDocuments as string[];
      } catch { /* ignore */ }
      return [];
    })();
    const mergedDocuments = Array.from(new Set([...parsed.affectedDocuments, ...legacyDocCodes]));

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
        affectedDocuments: mergedDocuments,
        ...(parsed.proposedChanges ? { proposedChanges: parsed.proposedChanges as Prisma.InputJsonValue } : {}),
        ...(parsed.impactAssessment ? { impactAssessment: parsed.impactAssessment } : {}),
        status: parsed.status
      }
    });
    await ensureWorkflowOnSubmit(created.id, created.status, industry, parsed.containerId);

    // ── Auto-revise all affected Released objects to a new In Work draft ──────
    const revisedEntities: Array<{ type: string; code: string; newRevisionLabel: string }> = [];
    for (const code of parsed.affectedItems) {
      const latestReleased = await prisma.item.findFirst({
        where: { itemCode: code, status: "RELEASED" },
        orderBy: [{ revisionMajor: "desc" }, { revisionIteration: "desc" }]
      });
      if (latestReleased) {
        try {
          const revised = await reviseEntity("ITEM", latestReleased.id, requester) as { revisionLabel?: string };
          revisedEntities.push({ type: "ITEM", code, newRevisionLabel: String(revised.revisionLabel ?? "") });
        } catch {
          // item may already have a draft revision — skip silently
        }
      }
    }
    for (const code of parsed.affectedFormulas) {
      const latestReleased = await prisma.formula.findFirst({
        where: { formulaCode: code, status: "RELEASED" },
        orderBy: [{ revisionMajor: "desc" }, { revisionIteration: "desc" }]
      });
      if (latestReleased) {
        try {
          const revised = await reviseEntity("FORMULA", latestReleased.id, requester) as { revisionLabel?: string };
          revisedEntities.push({ type: "FORMULA", code, newRevisionLabel: String(revised.revisionLabel ?? "") });
        } catch {
          // formula may already have a draft revision — skip silently
        }
      }
    }
    for (const code of mergedDocuments) {
      const latestReleased = await prisma.document.findFirst({
        where: { docNumber: code, status: "RELEASED" },
        orderBy: [{ revisionMajor: "desc" }, { revisionIteration: "desc" }]
      });
      if (latestReleased) {
        try {
          const revised = await reviseEntity("DOCUMENT", latestReleased.id, requester) as { revisionLabel?: string };
          revisedEntities.push({ type: "DOCUMENT", code, newRevisionLabel: String(revised.revisionLabel ?? "") });
        } catch {
          // document may already have a draft revision — skip silently
        }
      }
    }
    // Store revision log in proposedChanges if not already set
    if (revisedEntities.length > 0) {
      const existingChanges = (parsed.proposedChanges as Record<string, unknown> | null | undefined) ?? {};
      await prisma.changeRequest.update({
        where: { id: created.id },
        data: {
          proposedChanges: {
            ...existingChanges,
            autoRevisedEntities: revisedEntities
          } as Prisma.InputJsonValue
        }
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "CHANGE_REQUEST",
      entityId: created.id,
      action: "CREATE",
      ...(actorId ? { actorId } : {}),
      payload: created
    });
    res.status(201).json({ ...created, revisedEntities });
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
    await ensureWorkflowOnSubmit(updated.id, updated.status, industry, updated.containerId);
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

router.get("/:id/affected-objects", async (req, res, next) => {
  try {
    const change = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
    if (!change) { res.status(404).json({ message: "Change request not found" }); return; }
    const hasAccess = await ensureChangeAccess(req, change.containerId, "READ");
    if (!hasAccess) { res.status(403).json({ message: "Forbidden" }); return; }
    const [items, formulas, documents] = await Promise.all([
      change.affectedItems.length
        ? prisma.item.findMany({ where: { itemCode: { in: change.affectedItems } }, select: { id: true, itemCode: true, name: true, status: true, itemType: true } })
        : Promise.resolve([]),
      change.affectedFormulas.length
        ? prisma.formula.findMany({ where: { formulaCode: { in: change.affectedFormulas } }, select: { id: true, formulaCode: true, name: true, status: true } })
        : Promise.resolve([]),
      change.affectedDocuments.length
        ? prisma.document.findMany({ where: { docNumber: { in: change.affectedDocuments } }, select: { id: true, docNumber: true, name: true, status: true, docType: true, revisionLabel: true } })
        : Promise.resolve([])
    ]);
    res.json({ items, formulas, documents });
  } catch (error) { next(error); }
});

router.post("/:id/affected-objects", async (req, res, next) => {
  try {
    const change = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
    if (!change) { res.status(404).json({ message: "Change request not found" }); return; }
    const hasAccess = await ensureChangeAccess(req, change.containerId, "WRITE");
    if (!hasAccess) { res.status(403).json({ message: "Forbidden" }); return; }
    const type = String(req.body.type ?? "");
    const code = String(req.body.code ?? "").trim();
    if (!type || !code) { res.status(400).json({ message: "type and code are required" }); return; }
    if (type === "ITEM") {
      const item = await prisma.item.findFirst({ where: { itemCode: code } });
      if (!item) { res.status(404).json({ message: `Item with code '${code}' not found` }); return; }
      if (change.affectedItems.includes(code)) { res.status(400).json({ message: "Item already linked" }); return; }
      await prisma.changeRequest.update({ where: { id: req.params.id }, data: { affectedItems: { push: code } } });
    } else if (type === "FORMULA") {
      const formula = await prisma.formula.findFirst({ where: { formulaCode: code } });
      if (!formula) { res.status(404).json({ message: `Formula with code '${code}' not found` }); return; }
      if (change.affectedFormulas.includes(code)) { res.status(400).json({ message: "Formula already linked" }); return; }
      await prisma.changeRequest.update({ where: { id: req.params.id }, data: { affectedFormulas: { push: code } } });
    } else if (type === "DOCUMENT") {
      const document = await prisma.document.findFirst({ where: { docNumber: code } });
      if (!document) { res.status(404).json({ message: `Document with code '${code}' not found` }); return; }
      if (change.affectedDocuments.includes(code)) { res.status(400).json({ message: "Document already linked" }); return; }
      await prisma.changeRequest.update({ where: { id: req.params.id }, data: { affectedDocuments: { push: code } } });
    } else {
      res.status(400).json({ message: "type must be ITEM, FORMULA, or DOCUMENT" }); return;
    }
    res.json({ message: "Added" });
  } catch (error) { next(error); }
});

router.delete("/:id/affected-objects/:type/:code", async (req, res, next) => {
  try {
    const change = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
    if (!change) { res.status(404).json({ message: "Change request not found" }); return; }
    const hasAccess = await ensureChangeAccess(req, change.containerId, "WRITE");
    if (!hasAccess) { res.status(403).json({ message: "Forbidden" }); return; }
    const type = String(req.params.type ?? "");
    const code = String(req.params.code ?? "");
    if (type === "ITEM") {
      await prisma.changeRequest.update({ where: { id: req.params.id }, data: { affectedItems: change.affectedItems.filter((c) => c !== code) } });
    } else if (type === "FORMULA") {
      await prisma.changeRequest.update({ where: { id: req.params.id }, data: { affectedFormulas: change.affectedFormulas.filter((c) => c !== code) } });
    } else if (type === "DOCUMENT") {
      await prisma.changeRequest.update({ where: { id: req.params.id }, data: { affectedDocuments: change.affectedDocuments.filter((c) => c !== code) } });
    }
    res.status(204).send();
  } catch (error) { next(error); }
});

export default router;
