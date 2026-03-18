import { Router } from "express";
import { Industry, Prisma } from "@prisma/client";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";
import { spawnWorkflowInstance } from "../services/workflow.service.js";

const router = Router();

const createReleaseSchema = z.object({
  rrNumber: z.string().min(2).optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  containerId: z.string().optional(),
  targetItems: z.array(z.string()).default([]),
  targetFormulas: z.array(z.string()).default([]),
  targetDocuments: z.array(z.string()).default([]),
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
    include: { ingredients: true }
  });
  if (!formula) {
    return;
  }
  formulas.add(formula.formulaCode);

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

async function collectFromItem(itemId: string, items: Set<string>, formulas: Set<string>): Promise<void> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return;
  }
  items.add(item.itemCode);

  const formulaCandidates = await prisma.formula.findMany({
    where: { ingredients: { some: { itemId } } },
    select: { id: true }
  });
  for (const formula of formulaCandidates) {
    await collectFormula(formula.id, items, formulas, new Set());
  }
}

async function ensureWorkflowOnSubmit(releaseId: string, status: string, industry: string, containerId?: string | null): Promise<void> {
  if (status !== "SUBMITTED") return;

  const existing = await prisma.workflowInstance.findFirst({
    where: { entityType: "RELEASE_REQUEST", entityId: releaseId }
  });
  if (existing) return;

  let definition = await prisma.workflowDefinition.findFirst({
    where: { industry: industry as Industry, entityType: "RELEASE_REQUEST" }
  });
  if (!definition) {
    definition = await prisma.workflowDefinition.create({
      data: {
        name: "Release Management",
        industry: industry as Industry,
        entityType: "RELEASE_REQUEST",
        states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
        transitions: [
          { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT" },
          { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES" },
          { from: "UNDER_REVIEW", to: "RELEASED", action: "RELEASE" }
        ],
        actions: {
          stateAssignments: {
            UNDER_REVIEW: { roles: [], description: "Review the release package and approve for release.", slaHours: 48 },
            RELEASED: { roles: [], description: "Release finalised. Objects promoted to RELEASED." }
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
    entityId: releaseId,
    entityType: "RELEASE_REQUEST",
    currentState: startState,
    containerId: containerId ?? null
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

    // ── Business rule: all target objects must be In Work (not Released/Obsolete) ──
    if (parsed.targetItems.length > 0) {
      const targetItemRecords = await prisma.item.findMany({
        where: { id: { in: parsed.targetItems } },
        select: { id: true, itemCode: true, status: true }
      });
      const notInWork = targetItemRecords.filter((i) => i.status !== "IN_WORK");
      if (notInWork.length > 0) {
        const details = notInWork.map((i) => `${i.itemCode} (${i.status})`).join(", ");
        res.status(422).json({
          message: `Release requests can only be raised on In Work objects. The following items are not In Work: ${details}. A Change Request must be raised first to revise any Released objects.`
        });
        return;
      }
    }
    if (parsed.targetFormulas.length > 0) {
      const targetFormulaRecords = await prisma.formula.findMany({
        where: { id: { in: parsed.targetFormulas } },
        select: { id: true, formulaCode: true, status: true }
      });
      const notInWork = targetFormulaRecords.filter((f) => f.status !== "IN_WORK");
      if (notInWork.length > 0) {
        const details = notInWork.map((f) => `${f.formulaCode} (${f.status})`).join(", ");
        res.status(422).json({
          message: `Release requests can only be raised on In Work objects. The following formulas are not In Work: ${details}. A Change Request must be raised first to revise any Released objects.`
        });
        return;
      }
    }
    if (parsed.targetDocuments.length > 0) {
      const targetDocRecords = await prisma.document.findMany({
        where: { id: { in: parsed.targetDocuments } },
        select: { id: true, docNumber: true, status: true }
      });
      const notDraft = targetDocRecords.filter((d) => d.status !== "DRAFT");
      if (notDraft.length > 0) {
        const details = notDraft.map((d) => `${d.docNumber} (${d.status})`).join(", ");
        res.status(422).json({
          message: `Release requests can only be raised on Draft documents. The following documents are not in Draft status: ${details}.`
        });
        return;
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    const industry = parsed.containerId
      ? (await prisma.productContainer.findUnique({ where: { id: parsed.containerId }, select: { industry: true } }))?.industry ?? "CHEMICAL"
      : "CHEMICAL";
    const rrNumber = parsed.rrNumber ?? (await allocateNextSequenceValue("RELEASE_REQUEST", parsed.containerId));

    const items = new Set<string>();
    const formulas = new Set<string>();

    for (const itemId of parsed.targetItems) {
      await collectFromItem(itemId, items, formulas);
    }
    for (const formulaId of parsed.targetFormulas) {
      await collectFormula(formulaId, items, formulas, new Set());
    }

    // Resolve document codes from IDs for targetDocuments
    const targetDocRecords = parsed.targetDocuments.length
      ? await prisma.document.findMany({ where: { id: { in: parsed.targetDocuments } }, select: { docNumber: true } })
      : [];
    const affectedDocumentCodes = targetDocRecords.map((d) => d.docNumber);

    const created = await prisma.releaseRequest.create({
      data: {
        rrNumber,
        title: parsed.title,
        description: parsed.description ?? null,
        status: parsed.status,
        requestedById: requester,
        ...(parsed.containerId ? { containerId: parsed.containerId } : {}),
        targetItems: parsed.targetItems,
        targetFormulas: parsed.targetFormulas,
        affectedItems: Array.from(items),
        affectedFormulas: Array.from(formulas),
        affectedDocuments: affectedDocumentCodes
      }
    });
    await ensureWorkflowOnSubmit(created.id, created.status, industry, parsed.containerId);

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
    await ensureWorkflowOnSubmit(updated.id, updated.status, industry, updated.containerId);
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

router.get("/:id/affected-objects", async (req, res, next) => {
  try {
    const release = await prisma.releaseRequest.findUnique({ where: { id: req.params.id } });
    if (!release) { res.status(404).json({ message: "Release request not found" }); return; }
    const hasAccess = await ensureReleaseAccess(req, release.containerId, "READ");
    if (!hasAccess) { res.status(403).json({ message: "Forbidden" }); return; }
    const [items, formulas, documents] = await Promise.all([
      release.affectedItems.length
        ? prisma.item.findMany({ where: { itemCode: { in: release.affectedItems } }, select: { id: true, itemCode: true, name: true, status: true, itemType: true } })
        : Promise.resolve([]),
      release.affectedFormulas.length
        ? prisma.formula.findMany({ where: { formulaCode: { in: release.affectedFormulas } }, select: { id: true, formulaCode: true, name: true, status: true } })
        : Promise.resolve([]),
      release.affectedDocuments.length
        ? prisma.document.findMany({ where: { docNumber: { in: release.affectedDocuments } }, select: { id: true, docNumber: true, name: true, status: true, docType: true, revisionLabel: true } })
        : Promise.resolve([])
    ]);
    res.json({ items, formulas, documents });
  } catch (error) { next(error); }
});

router.post("/:id/affected-objects", async (req, res, next) => {
  try {
    const release = await prisma.releaseRequest.findUnique({ where: { id: req.params.id } });
    if (!release) { res.status(404).json({ message: "Release request not found" }); return; }
    const hasAccess = await ensureReleaseAccess(req, release.containerId, "WRITE");
    if (!hasAccess) { res.status(403).json({ message: "Forbidden" }); return; }
    const type = String(req.body.type ?? "");
    const code = String(req.body.code ?? "").trim();
    if (!type || !code) { res.status(400).json({ message: "type and code are required" }); return; }
    if (type === "ITEM") {
      const item = await prisma.item.findFirst({ where: { itemCode: code } });
      if (!item) { res.status(404).json({ message: `Item with code '${code}' not found` }); return; }
      if (release.affectedItems.includes(code)) { res.status(400).json({ message: "Item already linked" }); return; }
      await prisma.releaseRequest.update({ where: { id: req.params.id }, data: { affectedItems: { push: code } } });
    } else if (type === "FORMULA") {
      const formula = await prisma.formula.findFirst({ where: { formulaCode: code } });
      if (!formula) { res.status(404).json({ message: `Formula with code '${code}' not found` }); return; }
      if (release.affectedFormulas.includes(code)) { res.status(400).json({ message: "Formula already linked" }); return; }
      await prisma.releaseRequest.update({ where: { id: req.params.id }, data: { affectedFormulas: { push: code } } });
    } else if (type === "DOCUMENT") {
      const document = await prisma.document.findFirst({ where: { docNumber: code } });
      if (!document) { res.status(404).json({ message: `Document with code '${code}' not found` }); return; }
      if (release.affectedDocuments.includes(code)) { res.status(400).json({ message: "Document already linked" }); return; }
      await prisma.releaseRequest.update({ where: { id: req.params.id }, data: { affectedDocuments: { push: code } } });
    } else {
      res.status(400).json({ message: "type must be ITEM, FORMULA, or DOCUMENT" }); return;
    }
    res.json({ message: "Added" });
  } catch (error) { next(error); }
});

router.delete("/:id/affected-objects/:type/:code", async (req, res, next) => {
  try {
    const release = await prisma.releaseRequest.findUnique({ where: { id: req.params.id } });
    if (!release) { res.status(404).json({ message: "Release request not found" }); return; }
    const hasAccess = await ensureReleaseAccess(req, release.containerId, "WRITE");
    if (!hasAccess) { res.status(403).json({ message: "Forbidden" }); return; }
    const type = String(req.params.type ?? "");
    const code = String(req.params.code ?? "");
    if (type === "ITEM") {
      await prisma.releaseRequest.update({ where: { id: req.params.id }, data: { affectedItems: release.affectedItems.filter((c) => c !== code) } });
    } else if (type === "FORMULA") {
      await prisma.releaseRequest.update({ where: { id: req.params.id }, data: { affectedFormulas: release.affectedFormulas.filter((c) => c !== code) } });
    } else if (type === "DOCUMENT") {
      await prisma.releaseRequest.update({ where: { id: req.params.id }, data: { affectedDocuments: release.affectedDocuments.filter((c) => c !== code) } });
    }
    res.status(204).send();
  } catch (error) { next(error); }
});

export default router;
