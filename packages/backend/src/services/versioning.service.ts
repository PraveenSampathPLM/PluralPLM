import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

type VersionedEntityType = "ITEM" | "FORMULA" | "DOCUMENT" | "FG_STRUCTURE";

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function checkoutEntity(
  entityType: VersionedEntityType,
  entityId: string,
  userId: string
): Promise<{ message: string }> {
  if (entityType === "ITEM") {
    const item = await prisma.item.findUnique({ where: { id: entityId } });
    if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });
    if (item.status !== "IN_WORK") throw Object.assign(new Error("Only IN_WORK items can be checked out"), { statusCode: 400 });
    if (item.checkedOutById) {
      if (item.checkedOutById === userId) throw Object.assign(new Error("Already checked out by you"), { statusCode: 400 });
      throw Object.assign(new Error("Item is already checked out by another user"), { statusCode: 409 });
    }
    const snapshot = {
      name: item.name, description: item.description, uom: item.uom,
      density: item.density, viscosity: item.viscosity, pH: item.pH,
      flashPoint: item.flashPoint, regulatoryFlags: item.regulatoryFlags, attributes: item.attributes
    };
    await prisma.item.update({
      where: { id: entityId },
      data: { checkedOutById: userId, checkedOutAt: new Date(), checkoutSnapshot: snapshot }
    });
    return { message: "Item checked out" };
  }

  if (entityType === "FORMULA") {
    const formula = await prisma.formula.findUnique({ where: { id: entityId } });
    if (!formula) throw Object.assign(new Error("Formula not found"), { statusCode: 404 });
    if (formula.status !== "IN_WORK") throw Object.assign(new Error("Only IN_WORK formulas can be checked out"), { statusCode: 400 });
    if (formula.checkedOutById) {
      if (formula.checkedOutById === userId) throw Object.assign(new Error("Already checked out by you"), { statusCode: 400 });
      throw Object.assign(new Error("Formula is already checked out by another user"), { statusCode: 409 });
    }
    const snapshot = {
      name: formula.name, description: formula.description, targetYield: formula.targetYield,
      yieldUom: formula.yieldUom, batchSize: formula.batchSize, batchUom: formula.batchUom,
      processingInstructions: formula.processingInstructions, effectiveDate: formula.effectiveDate,
      expiryDate: formula.expiryDate
    };
    await prisma.formula.update({
      where: { id: entityId },
      data: { checkedOutById: userId, checkedOutAt: new Date(), checkoutSnapshot: snapshot }
    });
    return { message: "Formula checked out" };
  }

  if (entityType === "DOCUMENT") {
    const doc = await prisma.document.findUnique({ where: { id: entityId } });
    if (!doc) throw Object.assign(new Error("Document not found"), { statusCode: 404 });
    if (doc.status !== "DRAFT") throw Object.assign(new Error("Only DRAFT documents can be checked out"), { statusCode: 400 });
    if (doc.checkedOutById) {
      if (doc.checkedOutById === userId) throw Object.assign(new Error("Already checked out by you"), { statusCode: 400 });
      throw Object.assign(new Error("Document is already checked out by another user"), { statusCode: 409 });
    }
    const snapshot = { name: doc.name, description: doc.description, docType: doc.docType };
    await prisma.document.update({
      where: { id: entityId },
      data: { checkedOutById: userId, checkedOutAt: new Date(), checkoutSnapshot: snapshot }
    });
    return { message: "Document checked out" };
  }

  if (entityType === "FG_STRUCTURE") {
    const fg = await prisma.fGStructure.findUnique({ where: { id: entityId } });
    if (!fg) throw Object.assign(new Error("FG Structure not found"), { statusCode: 404 });
    if (fg.status !== "IN_WORK") throw Object.assign(new Error("Only IN_WORK FG structures can be checked out"), { statusCode: 400 });
    if (fg.checkedOutById) {
      if (fg.checkedOutById === userId) throw Object.assign(new Error("Already checked out by you"), { statusCode: 400 });
      throw Object.assign(new Error("FG Structure is already checked out by another user"), { statusCode: 409 });
    }
    const snapshot = { version: fg.version, status: fg.status, effectiveDate: fg.effectiveDate };
    await prisma.fGStructure.update({
      where: { id: entityId },
      data: { checkedOutById: userId, checkedOutAt: new Date(), checkoutSnapshot: snapshot }
    });
    return { message: "FG Structure checked out" };
  }

  throw Object.assign(new Error("Unsupported entity type"), { statusCode: 400 });
}

// ─── Check In ─────────────────────────────────────────────────────────────────

export async function checkinEntity(
  entityType: VersionedEntityType,
  entityId: string,
  userId: string,
  updates: Record<string, unknown>
): Promise<unknown> {
  if (entityType === "ITEM") {
    const item = await prisma.item.findUnique({ where: { id: entityId } });
    if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });
    if (item.checkedOutById !== userId) throw Object.assign(new Error("Item is not checked out by you"), { statusCode: 403 });
    const allowed = ["name", "description", "uom", "density", "viscosity", "pH", "flashPoint", "regulatoryFlags", "attributes"];
    const safeUpdates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) safeUpdates[key] = updates[key];
    }
    const updated = await prisma.item.update({
      where: { id: entityId },
      data: {
        ...safeUpdates,
        revisionIteration: item.revisionIteration + 1,
        revisionLabel: `${item.revisionMajor}.${item.revisionIteration + 1}`,
        checkedOutById: null,
        checkedOutAt: null,
        checkoutSnapshot: Prisma.JsonNull
      }
    });
    return updated;
  }

  if (entityType === "FORMULA") {
    const formula = await prisma.formula.findUnique({ where: { id: entityId } });
    if (!formula) throw Object.assign(new Error("Formula not found"), { statusCode: 404 });
    if (formula.checkedOutById !== userId) throw Object.assign(new Error("Formula is not checked out by you"), { statusCode: 403 });
    const allowed = ["name", "description", "targetYield", "yieldUom", "batchSize", "batchUom", "processingInstructions", "effectiveDate", "expiryDate"];
    const safeUpdates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) safeUpdates[key] = updates[key];
    }
    const updated = await prisma.formula.update({
      where: { id: entityId },
      data: {
        ...safeUpdates,
        revisionIteration: formula.revisionIteration + 1,
        revisionLabel: `${formula.revisionMajor}.${formula.revisionIteration + 1}`,
        checkedOutById: null,
        checkedOutAt: null,
        checkoutSnapshot: Prisma.JsonNull
      }
    });
    return updated;
  }

  if (entityType === "DOCUMENT") {
    const doc = await prisma.document.findUnique({ where: { id: entityId } });
    if (!doc) throw Object.assign(new Error("Document not found"), { statusCode: 404 });
    if (doc.checkedOutById !== userId) throw Object.assign(new Error("Document is not checked out by you"), { statusCode: 403 });
    const allowed = ["name", "description", "docType"];
    const safeUpdates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) safeUpdates[key] = updates[key];
    }
    const updated = await prisma.document.update({
      where: { id: entityId },
      data: {
        ...safeUpdates,
        revisionIteration: doc.revisionIteration + 1,
        revisionLabel: `${doc.revisionMajor}.${doc.revisionIteration + 1}`,
        checkedOutById: null,
        checkedOutAt: null,
        checkoutSnapshot: Prisma.JsonNull
      }
    });
    return updated;
  }

  if (entityType === "FG_STRUCTURE") {
    const fg = await prisma.fGStructure.findUnique({ where: { id: entityId } });
    if (!fg) throw Object.assign(new Error("FG Structure not found"), { statusCode: 404 });
    if (fg.checkedOutById !== userId) throw Object.assign(new Error("FG Structure is not checked out by you"), { statusCode: 403 });
    const updated = await prisma.fGStructure.update({
      where: { id: entityId },
      data: {
        revisionIteration: fg.revisionIteration + 1,
        revisionLabel: `${fg.revisionMajor}.${fg.revisionIteration + 1}`,
        checkedOutById: null,
        checkedOutAt: null,
        checkoutSnapshot: Prisma.JsonNull
      }
    });
    return updated;
  }

  throw Object.assign(new Error("Unsupported entity type"), { statusCode: 400 });
}

// ─── Undo Checkout ────────────────────────────────────────────────────────────

export async function undoCheckout(
  entityType: VersionedEntityType,
  entityId: string,
  userId: string,
  isAdmin: boolean
): Promise<{ message: string }> {
  if (entityType === "ITEM") {
    const item = await prisma.item.findUnique({ where: { id: entityId } });
    if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });
    if (!item.checkedOutById) throw Object.assign(new Error("Item is not checked out"), { statusCode: 400 });
    if (item.checkedOutById !== userId && !isAdmin) throw Object.assign(new Error("Only the owner or an admin can undo this checkout"), { statusCode: 403 });
    const snapshot = item.checkoutSnapshot as Record<string, unknown> | null;
    await prisma.item.update({
      where: { id: entityId },
      data: {
        ...(snapshot ?? {}),
        checkedOutById: null,
        checkedOutAt: null,
        checkoutSnapshot: Prisma.JsonNull
      }
    });
    return { message: "Checkout undone — item restored to pre-checkout state" };
  }

  if (entityType === "FORMULA") {
    const formula = await prisma.formula.findUnique({ where: { id: entityId } });
    if (!formula) throw Object.assign(new Error("Formula not found"), { statusCode: 404 });
    if (!formula.checkedOutById) throw Object.assign(new Error("Formula is not checked out"), { statusCode: 400 });
    if (formula.checkedOutById !== userId && !isAdmin) throw Object.assign(new Error("Only the owner or an admin can undo this checkout"), { statusCode: 403 });
    const snapshot = formula.checkoutSnapshot as Record<string, unknown> | null;
    await prisma.formula.update({
      where: { id: entityId },
      data: {
        ...(snapshot ?? {}),
        checkedOutById: null,
        checkedOutAt: null,
        checkoutSnapshot: Prisma.JsonNull
      }
    });
    return { message: "Checkout undone — formula restored to pre-checkout state" };
  }

  if (entityType === "DOCUMENT") {
    const doc = await prisma.document.findUnique({ where: { id: entityId } });
    if (!doc) throw Object.assign(new Error("Document not found"), { statusCode: 404 });
    if (!doc.checkedOutById) throw Object.assign(new Error("Document is not checked out"), { statusCode: 400 });
    if (doc.checkedOutById !== userId && !isAdmin) throw Object.assign(new Error("Only the owner or an admin can undo this checkout"), { statusCode: 403 });
    const snapshot = doc.checkoutSnapshot as Record<string, unknown> | null;
    await prisma.document.update({
      where: { id: entityId },
      data: {
        ...(snapshot ?? {}),
        checkedOutById: null,
        checkedOutAt: null,
        checkoutSnapshot: Prisma.JsonNull
      }
    });
    return { message: "Checkout undone — document restored to pre-checkout state" };
  }

  if (entityType === "FG_STRUCTURE") {
    const fg = await prisma.fGStructure.findUnique({ where: { id: entityId } });
    if (!fg) throw Object.assign(new Error("FG Structure not found"), { statusCode: 404 });
    if (!fg.checkedOutById) throw Object.assign(new Error("FG Structure is not checked out"), { statusCode: 400 });
    if (fg.checkedOutById !== userId && !isAdmin) throw Object.assign(new Error("Only the owner or an admin can undo this checkout"), { statusCode: 403 });
    const snapshot = fg.checkoutSnapshot as Record<string, unknown> | null;
    await prisma.fGStructure.update({
      where: { id: entityId },
      data: {
        ...(snapshot ?? {}),
        checkedOutById: null,
        checkedOutAt: null,
        checkoutSnapshot: Prisma.JsonNull
      }
    });
    return { message: "Checkout undone — FG Structure restored to pre-checkout state" };
  }

  throw Object.assign(new Error("Unsupported entity type"), { statusCode: 400 });
}

// ─── Revise ───────────────────────────────────────────────────────────────────

export async function reviseEntity(
  entityType: VersionedEntityType,
  entityId: string,
  userId: string
): Promise<unknown> {
  if (entityType === "ITEM") {
    const item = await prisma.item.findUnique({ where: { id: entityId } });
    if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });
    if (item.status !== "RELEASED") throw Object.assign(new Error("Only RELEASED items can be revised"), { statusCode: 400 });
    // Check no existing IN_WORK revision for this code
    const existing = await prisma.item.findFirst({
      where: { itemCode: item.itemCode, status: "IN_WORK" }
    });
    if (existing) throw Object.assign(new Error(`An IN_WORK revision already exists for item code ${item.itemCode}`), { statusCode: 409 });
    const newRevMajor = item.revisionMajor + 1;
    const created = await prisma.item.create({
      data: {
        itemCode: item.itemCode,
        revisionMajor: newRevMajor,
        revisionIteration: 1,
        revisionLabel: `${newRevMajor}.1`,
        name: item.name,
        description: item.description,
        industryType: item.industryType,
        itemType: item.itemType,
        uom: item.uom,
        density: item.density,
        viscosity: item.viscosity,
        pH: item.pH,
        flashPoint: item.flashPoint,
        regulatoryFlags: item.regulatoryFlags ?? Prisma.JsonNull,
        attributes: item.attributes ?? Prisma.JsonNull,
        containerId: item.containerId,
        status: "IN_WORK"
      }
    });
    return created;
  }

  if (entityType === "FORMULA") {
    const formula = await prisma.formula.findUnique({ where: { id: entityId }, include: { ingredients: true } });
    if (!formula) throw Object.assign(new Error("Formula not found"), { statusCode: 404 });
    if (formula.status !== "RELEASED") throw Object.assign(new Error("Only RELEASED formulas can be revised"), { statusCode: 400 });
    const existing = await prisma.formula.findFirst({
      where: { formulaCode: formula.formulaCode, status: "IN_WORK" }
    });
    if (existing) throw Object.assign(new Error(`An IN_WORK revision already exists for formula code ${formula.formulaCode}`), { statusCode: 409 });
    const newVersion = formula.version + 1;
    const created = await prisma.formula.create({
      data: {
        formulaCode: formula.formulaCode,
        version: newVersion,
        revisionMajor: formula.revisionMajor + 1,
        revisionIteration: 1,
        revisionLabel: `${formula.revisionMajor + 1}.1`,
        name: formula.name,
        description: formula.description,
        industryType: formula.industryType,
        targetYield: formula.targetYield,
        yieldUom: formula.yieldUom,
        batchSize: formula.batchSize,
        batchUom: formula.batchUom,
        processingInstructions: formula.processingInstructions,
        ownerId: userId,
        containerId: formula.containerId,
        status: "IN_WORK",
        ingredients: {
          create: formula.ingredients.map((ing) => ({
            itemId: ing.itemId,
            inputFormulaId: ing.inputFormulaId,
            quantity: ing.quantity,
            uom: ing.uom,
            percentage: ing.percentage,
            lowerLimit: ing.lowerLimit,
            upperLimit: ing.upperLimit,
            isOptional: ing.isOptional,
            substitutionGroup: ing.substitutionGroup,
            additionStep: ing.additionStep,
            additionSequence: ing.additionSequence,
            mixingTime: ing.mixingTime
          }))
        }
      }
    });
    return created;
  }

  if (entityType === "DOCUMENT") {
    const doc = await prisma.document.findUnique({ where: { id: entityId } });
    if (!doc) throw Object.assign(new Error("Document not found"), { statusCode: 404 });
    if (doc.status !== "RELEASED") throw Object.assign(new Error("Only RELEASED documents can be revised"), { statusCode: 400 });
    const existing = await prisma.document.findFirst({
      where: { docNumber: doc.docNumber, status: "DRAFT" }
    });
    if (existing) throw Object.assign(new Error(`A DRAFT revision already exists for document ${doc.docNumber}`), { statusCode: 409 });
    const newRevMajor = doc.revisionMajor + 1;
    const created = await prisma.document.create({
      data: {
        docNumber: doc.docNumber,
        name: doc.name,
        description: doc.description,
        fileName: doc.fileName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        docType: doc.docType,
        revisionMajor: newRevMajor,
        revisionIteration: 1,
        revisionLabel: `${newRevMajor}.1`,
        ownerId: userId,
        containerId: doc.containerId,
        status: "DRAFT"
      }
    });
    return created;
  }

  throw Object.assign(new Error("Revise not supported for this entity type"), { statusCode: 400 });
}
