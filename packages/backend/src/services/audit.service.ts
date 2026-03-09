import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

interface AuditInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  payload?: unknown;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const baseData = {
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    payload: input.payload ?? Prisma.JsonNull
  };

  await prisma.auditLog.create({
    data: {
      ...baseData,
      ...(input.actorId ? { actorId: input.actorId } : {})
    }
  });
}
