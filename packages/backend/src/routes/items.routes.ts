import { Router } from "express";
import { Prisma, ItemType } from "@prisma/client";
import { prisma } from "../services/prisma.js";
import { writeAuditLog } from "../services/audit.service.js";
import { z } from "zod";
import { allocateNextSequenceValue } from "../services/config-store.service.js";
import { formatRevisionLabel, getRevisionScheme } from "../services/revision.service.js";
import { ensureContainerAccess, getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";

const router = Router();

const createItemSchema = z.object({
  itemCode: z.string().min(2).optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  itemType: z.enum(["RAW_MATERIAL", "INTERMEDIATE", "FINISHED_GOOD", "PACKAGING"]),
  uom: z.string().min(1),
  density: z.number().optional(),
  viscosity: z.number().optional(),
  pH: z.number().optional(),
  flashPoint: z.number().optional(),
  casNumber: z.string().optional(),
  reachRegistration: z.string().optional(),
  sdsLink: z.string().optional(),
  ghsClassification: z.string().optional(),
  boilingPoint: z.number().optional(),
  containerId: z.string().optional(),
  customAttributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "OBSOLETE", "UNDER_CHANGE"]).default("DRAFT")
});

async function ensureItemAccess(
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
    entity: "ITEM",
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
    const search = String(req.query.search ?? "");
    const itemType = req.query.itemType ? String(req.query.itemType) : "";
    const containerId = String(req.query.containerId ?? "").trim();
    const attributeFiltersRaw = req.query.attributeFilters ? String(req.query.attributeFilters) : "";
    const attributeBoolean = String(req.query.attributeBoolean ?? "AND").toUpperCase() === "OR" ? "OR" : "AND";

    const andFilters: Prisma.ItemWhereInput[] = [];
    if (!isGlobalAdmin(req.user?.role)) {
      const accessibleContainerIds = await getAccessibleContainerIds(userId, "ITEM", "READ");
      andFilters.push({ OR: [{ containerId: null }, { containerId: { in: accessibleContainerIds } }] });
    }
    if (containerId) {
      andFilters.push({ containerId });
    }
    const where: Prisma.ItemWhereInput = {
      ...(itemType && Object.values(ItemType).includes(itemType as ItemType) ? { itemType: itemType as ItemType } : {}),
      ...(search
        ? {
            OR: [
              { itemCode: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(andFilters.length ? { AND: andFilters } : {})
    };

    if (attributeFiltersRaw) {
      try {
        const parsed = JSON.parse(attributeFiltersRaw) as Array<{
          key?: string;
          op?: string;
          value?: unknown;
          type?: string;
        }>;
        const clauses: Prisma.ItemWhereInput[] = [];
        for (const entry of parsed) {
          if (!entry?.key) continue;
          const op = String(entry.op ?? "").toLowerCase();
          const type = String(entry.type ?? "text");
          let value: unknown = entry.value;
          if (type === "number") {
            const num = Number(entry.value);
            if (Number.isNaN(num)) continue;
            value = num;
          } else if (type === "boolean") {
            value = String(entry.value).toLowerCase() === "true";
          } else {
            value = String(entry.value ?? "");
            if (!value) continue;
          }

          const path = ["customAttributes", entry.key];
          const jsonFilter: Prisma.JsonFilter = { path };
          switch (op) {
            case "contains":
              jsonFilter.string_contains = String(value);
              break;
            case "equals":
              jsonFilter.equals = value as Prisma.InputJsonValue;
              break;
            case "gt":
              jsonFilter.gt = value as Prisma.InputJsonValue;
              break;
            case "gte":
              jsonFilter.gte = value as Prisma.InputJsonValue;
              break;
            case "lt":
              jsonFilter.lt = value as Prisma.InputJsonValue;
              break;
            case "lte":
              jsonFilter.lte = value as Prisma.InputJsonValue;
              break;
            default:
              jsonFilter.equals = value as Prisma.InputJsonValue;
          }
          clauses.push({ attributes: jsonFilter });
        }
        if (clauses.length) {
          if (attributeBoolean === "OR") {
            where.OR = [...(where.OR ?? []), ...clauses];
          } else {
            where.AND = [...(where.AND ?? []), ...clauses];
          }
        }
      } catch (error) {
        // ignore bad attribute filters to avoid breaking search
      }
    }

    const data = await prisma.item.findMany({
      where,
      distinct: ["itemCode"],
      orderBy: [{ itemCode: "asc" }, { revisionMajor: "desc" }, { revisionIteration: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    const total = (await prisma.item.groupBy({ by: ["itemCode"], where })).length;

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createItemSchema.parse(req.body);
    if (!parsed.containerId) {
      res.status(400).json({ message: "Container is required" });
      return;
    }
    const container = await prisma.productContainer.findUnique({ where: { id: parsed.containerId } });
    if (!container) {
      res.status(400).json({ message: "Invalid container" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, parsed.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "No write access to selected container. Choose a container you can write to." });
      return;
    }
    const sequenceEntity =
      parsed.itemType === "FINISHED_GOOD" ? "ITEM_FINISHED_GOOD" : parsed.itemType === "PACKAGING" ? "ITEM_PACKAGING" : "ITEM";
    const itemCode = parsed.itemCode ?? (await allocateNextSequenceValue(sequenceEntity));
    const revisionScheme = await getRevisionScheme("ITEM");
    const revisionMajor = 1;
    const revisionIteration = 1;
    const created = await prisma.item.create({
      data: {
        itemCode,
        revisionMajor,
        revisionIteration,
        revisionLabel: formatRevisionLabel(revisionMajor, revisionIteration, revisionScheme),
        name: parsed.name,
        description: parsed.description ?? null,
        industryType: container.industry,
        itemType: parsed.itemType,
        uom: parsed.uom,
        ...(typeof parsed.density === "number" ? { density: parsed.density } : {}),
        ...(typeof parsed.viscosity === "number" ? { viscosity: parsed.viscosity } : {}),
        ...(typeof parsed.pH === "number" ? { pH: parsed.pH } : {}),
        ...(typeof parsed.flashPoint === "number" ? { flashPoint: parsed.flashPoint } : {}),
        ...(parsed.containerId ? { containerId: parsed.containerId } : {}),
        status: parsed.status,
        regulatoryFlags: {
          REACH: Boolean(parsed.reachRegistration),
          SDS: Boolean(parsed.sdsLink)
        },
        attributes: {
          casNumber: parsed.casNumber ?? "",
          reachRegistration: parsed.reachRegistration ?? "",
          sdsLink: parsed.sdsLink ?? "",
          ghsClassification: parsed.ghsClassification ?? "",
          boilingPoint: parsed.boilingPoint ?? null,
          customAttributes: (parsed.customAttributes ?? {}) as Prisma.InputJsonValue
        }
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "ITEM",
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
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, item.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/history", async (req, res, next) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, item.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const history = await prisma.item.findMany({
      where: { itemCode: item.itemCode },
      orderBy: [{ revisionMajor: "desc" }, { revisionIteration: "desc" }]
    });
    res.json({ currentId: item.id, history });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const parsed = createItemSchema.partial().parse(req.body);
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const targetContainerId = parsed.containerId ?? item.containerId;
    if (!targetContainerId) {
      res.status(400).json({ message: "Container is required" });
      return;
    }
    const container = await prisma.productContainer.findUnique({ where: { id: targetContainerId } });
    if (!container) {
      res.status(400).json({ message: "Invalid container" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, targetContainerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const needsAttributeMerge =
      parsed.casNumber !== undefined ||
      parsed.reachRegistration !== undefined ||
      parsed.sdsLink !== undefined ||
      parsed.ghsClassification !== undefined ||
      parsed.boilingPoint !== undefined ||
      parsed.customAttributes !== undefined;

    const existingItem = needsAttributeMerge ? item : null;

    if (needsAttributeMerge && !existingItem) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const existingAttributes =
      existingItem && existingItem.attributes && typeof existingItem.attributes === "object" && !Array.isArray(existingItem.attributes)
        ? (existingItem.attributes as Record<string, unknown>)
        : {};

    const existingCustomAttributes =
      existingAttributes.customAttributes && typeof existingAttributes.customAttributes === "object" && !Array.isArray(existingAttributes.customAttributes)
        ? (existingAttributes.customAttributes as Record<string, unknown>)
        : {};

    const updated = await prisma.item.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.itemCode ? { itemCode: parsed.itemCode } : {}),
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.description ? { description: parsed.description } : {}),
        ...(parsed.itemType ? { itemType: parsed.itemType } : {}),
        ...(parsed.uom ? { uom: parsed.uom } : {}),
        ...(typeof parsed.density === "number" ? { density: parsed.density } : {}),
        ...(typeof parsed.viscosity === "number" ? { viscosity: parsed.viscosity } : {}),
        ...(typeof parsed.pH === "number" ? { pH: parsed.pH } : {}),
        ...(typeof parsed.flashPoint === "number" ? { flashPoint: parsed.flashPoint } : {}),
        industryType: container.industry,
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.containerId !== undefined ? { containerId: parsed.containerId || null } : {}),
        ...(needsAttributeMerge
          ? {
              attributes: {
                casNumber: parsed.casNumber ?? String(existingAttributes.casNumber ?? ""),
                reachRegistration: parsed.reachRegistration ?? String(existingAttributes.reachRegistration ?? ""),
                sdsLink: parsed.sdsLink ?? String(existingAttributes.sdsLink ?? ""),
                ghsClassification: parsed.ghsClassification ?? String(existingAttributes.ghsClassification ?? ""),
                boilingPoint:
                  typeof parsed.boilingPoint === "number"
                    ? parsed.boilingPoint
                    : typeof existingAttributes.boilingPoint === "number"
                      ? existingAttributes.boilingPoint
                      : null,
                customAttributes: {
                  ...existingCustomAttributes,
                  ...(parsed.customAttributes ?? {})
                } as Prisma.InputJsonValue
              }
            }
          : {})
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "ITEM",
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

router.get("/:id/where-used", async (req, res, next) => {
  try {
    const itemId = req.params.id;
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, item.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const formulas = await prisma.formulaIngredient.findMany({ where: { itemId }, include: { formula: true } });
    res.json({ data: formulas.map((entry) => entry.formula), total: formulas.length, page: 1, pageSize: formulas.length || 1 });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/history", async (req, res, next) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, item.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const logs = await prisma.auditLog.findMany({ where: { entityType: "ITEM", entityId: req.params.id }, orderBy: { createdAt: "desc" } });
    res.json({ data: logs, total: logs.length, page: 1, pageSize: logs.length || 1 });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/copy", async (req, res, next) => {
  try {
    const itemId = String(req.params.id ?? "");
    const source = await prisma.item.findUnique({ where: { id: itemId } });
    if (!source) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const sequenceEntity =
      source.itemType === "FINISHED_GOOD" ? "ITEM_FINISHED_GOOD" : source.itemType === "PACKAGING" ? "ITEM_PACKAGING" : "ITEM";
    const itemCode = await allocateNextSequenceValue(sequenceEntity);
    const revisionScheme = await getRevisionScheme("ITEM");
    const revisionMajor = 1;
    const revisionIteration = 1;
    const copied = await prisma.item.create({
      data: {
        itemCode,
        revisionMajor,
        revisionIteration,
        revisionLabel: formatRevisionLabel(revisionMajor, revisionIteration, revisionScheme),
        name: `${source.name} Copy`,
        description: source.description,
        industryType: source.industryType,
        itemType: source.itemType,
        uom: source.uom,
        density: source.density,
        viscosity: source.viscosity,
        pH: source.pH,
        flashPoint: source.flashPoint,
        containerId: source.containerId,
        regulatoryFlags: source.regulatoryFlags ?? Prisma.JsonNull,
        attributes: source.attributes ?? Prisma.JsonNull,
        status: "DRAFT"
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "ITEM",
      entityId: copied.id,
      action: "COPY",
      ...(actorId ? { actorId } : {}),
      payload: { sourceId: source.id }
    });
    res.status(201).json(copied);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/revise", async (req, res, next) => {
  try {
    const itemId = String(req.params.id ?? "");
    const source = await prisma.item.findUnique({ where: { id: itemId } });
    if (!source) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, source.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const revisionScheme = await getRevisionScheme("ITEM");
    const revisionMajor = source.revisionMajor + 1;
    const revisionIteration = 1;
    const revised = await prisma.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: {
          itemCode: source.itemCode,
          revisionMajor,
          revisionIteration,
          revisionLabel: formatRevisionLabel(revisionMajor, revisionIteration, revisionScheme),
          name: source.name,
          description: source.description,
          industryType: source.industryType,
          itemType: source.itemType,
          uom: source.uom,
          density: source.density,
          viscosity: source.viscosity,
          pH: source.pH,
          flashPoint: source.flashPoint,
          containerId: source.containerId,
          regulatoryFlags: source.regulatoryFlags ?? Prisma.JsonNull,
          attributes: source.attributes ?? Prisma.JsonNull,
          status: "DRAFT"
        }
      });

      const specs = await tx.specification.findMany({ where: { itemId: source.id } });
      if (specs.length) {
        await tx.specification.createMany({
          data: specs.map((spec) => ({
            itemId: created.id,
            containerId: spec.containerId ?? source.containerId ?? undefined,
            specType: spec.specType,
            attribute: spec.attribute,
            value: spec.value ?? null,
            uom: spec.uom ?? null,
            minValue: spec.minValue ?? null,
            maxValue: spec.maxValue ?? null,
            testMethod: spec.testMethod ?? null
          }))
        });
      }

      const links = await tx.documentLink.findMany({ where: { entityType: "ITEM", entityId: source.id } });
      if (links.length) {
        await tx.documentLink.createMany({
          data: links.map((link) => ({
            documentId: link.documentId,
            entityType: "ITEM",
            entityId: created.id
          })),
          skipDuplicates: true
        });
      }

      return created;
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "ITEM",
      entityId: revised.id,
      action: "REVISE",
      ...(actorId ? { actorId } : {}),
      payload: { sourceId: source.id }
    });
    res.status(201).json(revised);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/check-out", async (req, res, next) => {
  try {
    const itemId = String(req.params.id ?? "");
    const existing = await prisma.item.findUnique({ where: { id: itemId } });
    if (!existing) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (existing.status !== "DRAFT") {
      res.status(400).json({ message: "Checkout is only allowed for items in DRAFT status." });
      return;
    }
    const updated = await prisma.item.update({ where: { id: itemId }, data: { status: "UNDER_CHANGE" } });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "ITEM",
      entityId: updated.id,
      action: "CHECK_OUT",
      ...(actorId ? { actorId } : {}),
      payload: updated
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/check-in", async (req, res, next) => {
  try {
    const itemId = String(req.params.id ?? "");
    const existing = await prisma.item.findUnique({ where: { id: itemId } });
    if (!existing) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (existing.status !== "UNDER_CHANGE") {
      res.status(400).json({ message: "Check-in is only allowed for items that are checked out." });
      return;
    }
    const revisionScheme = await getRevisionScheme("ITEM");
    const revisionMajor = existing.revisionMajor;
    const revisionIteration = existing.revisionIteration + 1;
    const updated = await prisma.item.update({
      where: { id: itemId },
      data: {
        status: "ACTIVE",
        revisionIteration,
        revisionLabel: formatRevisionLabel(revisionMajor, revisionIteration, revisionScheme)
      }
    });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "ITEM",
      entityId: updated.id,
      action: "CHECK_IN",
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
    const itemId = String(req.params.id ?? "");
    const existing = await prisma.item.findUnique({ where: { id: itemId } });
    if (!existing) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, existing.containerId, "WRITE");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await prisma.item.delete({ where: { id: itemId } });
    const actorId = req.user?.sub;
    await writeAuditLog({
      entityType: "ITEM",
      entityId: itemId,
      action: "DELETE",
      ...(actorId ? { actorId } : {}),
      payload: existing
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/:id/links", async (req, res, next) => {
  try {
    const itemId = String(req.params.id ?? "");
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, itemCode: true, name: true, industryType: true, containerId: true }
    });
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    const hasAccess = await ensureItemAccess(req, item.containerId, "READ");
    if (!hasAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const [formulaUsages, bomUsages, specifications, relatedChanges, workflows] = await Promise.all([
      prisma.formulaIngredient.findMany({
        where: { itemId, formula: { industryType: item.industryType } },
        include: {
          formula: {
            select: { id: true, formulaCode: true, version: true, name: true, status: true }
          }
        },
        orderBy: [{ formula: { formulaCode: "asc" } }, { additionSequence: "asc" }]
      }),
      prisma.bOMLine.findMany({
        where: {
          itemId,
          bom: {
            OR: [{ formula: { industryType: item.industryType } }, { formulaId: null }]
          }
        },
        include: {
          bom: {
            select: {
              id: true,
              bomCode: true,
              version: true,
              type: true,
              formula: { select: { id: true, formulaCode: true, version: true, name: true } }
            }
          }
        },
        orderBy: [{ bom: { bomCode: "asc" } }, { bom: { version: "desc" } }]
      }),
      prisma.specification.findMany({
        where: { itemId },
        select: {
          id: true,
          specType: true,
          attribute: true,
          value: true,
          minValue: true,
          maxValue: true,
          uom: true,
          testMethod: true,
          updatedAt: true
        },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.changeRequest.findMany({
        where: { affectedItems: { has: item.itemCode } },
        select: {
          id: true,
          crNumber: true,
          title: true,
          type: true,
          priority: true,
          status: true,
          updatedAt: true
        },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.workflowInstance.findMany({
        where: { entityType: "ITEM", entityId: itemId },
        select: { id: true, currentState: true, updatedAt: true },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    res.json({
      item,
      formulaUsages,
      bomUsages,
      specifications,
      relatedChanges,
      workflows
    });
  } catch (error) {
    next(error);
  }
});

export default router;
