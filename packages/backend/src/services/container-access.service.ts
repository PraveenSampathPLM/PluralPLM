import { prisma } from "./prisma.js";

export type DomainEntity = "ITEM" | "FORMULA" | "BOM" | "CHANGE" | "RELEASE" | "SPECIFICATION" | "DOCUMENT";
export type DomainAction = "READ" | "WRITE";

export const CONTAINER_PERMISSIONS = [
  "CONTAINER_ADMIN",
  "ITEM_READ",
  "ITEM_WRITE",
  "FORMULA_READ",
  "FORMULA_WRITE",
  "BOM_READ",
  "BOM_WRITE",
  "CHANGE_READ",
  "CHANGE_WRITE",
  "RELEASE_READ",
  "RELEASE_WRITE",
  "SPEC_READ",
  "SPEC_WRITE",
  "DOCUMENT_READ",
  "DOCUMENT_WRITE"
] as const;

const adminRoles = new Set(["System Admin", "PLM Admin"]);

export function isGlobalAdmin(roleName: string | undefined): boolean {
  return Boolean(roleName && adminRoles.has(roleName));
}

function permissionKeys(entity: DomainEntity, action: DomainAction): string[] {
  if (entity === "ITEM") {
    return action === "READ" ? ["ITEM_READ", "ITEM_WRITE", "CONTAINER_ADMIN"] : ["ITEM_WRITE", "CONTAINER_ADMIN"];
  }
  if (entity === "FORMULA") {
    return action === "READ" ? ["FORMULA_READ", "FORMULA_WRITE", "CONTAINER_ADMIN"] : ["FORMULA_WRITE", "CONTAINER_ADMIN"];
  }
  if (entity === "BOM") {
    return action === "READ" ? ["BOM_READ", "BOM_WRITE", "CONTAINER_ADMIN"] : ["BOM_WRITE", "CONTAINER_ADMIN"];
  }
  if (entity === "CHANGE") {
    return action === "READ" ? ["CHANGE_READ", "CHANGE_WRITE", "CONTAINER_ADMIN"] : ["CHANGE_WRITE", "CONTAINER_ADMIN"];
  }
  if (entity === "RELEASE") {
    return action === "READ" ? ["RELEASE_READ", "RELEASE_WRITE", "CONTAINER_ADMIN"] : ["RELEASE_WRITE", "CONTAINER_ADMIN"];
  }
  if (entity === "DOCUMENT") {
    return action === "READ" ? ["DOCUMENT_READ", "DOCUMENT_WRITE", "CONTAINER_ADMIN"] : ["DOCUMENT_WRITE", "CONTAINER_ADMIN"];
  }
  return action === "READ" ? ["SPEC_READ", "SPEC_WRITE", "CONTAINER_ADMIN"] : ["SPEC_WRITE", "CONTAINER_ADMIN"];
}

function toPermissionSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set<string>();
  }
  return new Set(value.filter((entry): entry is string => typeof entry === "string"));
}

export async function getAccessibleContainerIds(userId: string, entity: DomainEntity, action: DomainAction): Promise<string[]> {
  const memberships = await prisma.containerMembership.findMany({
    where: { userId },
    include: { containerRole: true }
  });

  const needed = permissionKeys(entity, action);
  return memberships
    .filter((membership) => {
      const granted = toPermissionSet(membership.containerRole.permissions);
      return needed.some((permission) => granted.has(permission));
    })
    .map((membership) => membership.containerId);
}

export async function ensureContainerAccess(input: {
  userId: string;
  userRole: string | undefined;
  containerId: string | null | undefined;
  entity: DomainEntity;
  action: DomainAction;
}): Promise<boolean> {
  if (isGlobalAdmin(input.userRole)) {
    return true;
  }
  if (!input.containerId) {
    return input.action === "READ";
  }
  const allowed = await getAccessibleContainerIds(input.userId, input.entity, input.action);
  return allowed.includes(input.containerId);
}

export async function hasContainerAdminAccess(userId: string, userRole: string | undefined, containerId: string): Promise<boolean> {
  if (isGlobalAdmin(userRole)) {
    return true;
  }
  const membership = await prisma.containerMembership.findUnique({
    where: { containerId_userId: { containerId, userId } },
    include: { containerRole: true }
  });
  if (!membership) {
    return false;
  }
  const granted = toPermissionSet(membership.containerRole.permissions);
  return granted.has("CONTAINER_ADMIN");
}
