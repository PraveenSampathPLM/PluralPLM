import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { Industry } from "@prisma/client";
import { writeAuditLog } from "../services/audit.service.js";
import { CONTAINER_PERMISSIONS, hasContainerAdminAccess, isGlobalAdmin } from "../services/container-access.service.js";

const router = Router();

const createContainerSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  industry: z.nativeEnum(Industry)
});

const createRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.enum(CONTAINER_PERMISSIONS)).min(1)
});

const assignMemberSchema = z.object({
  userId: z.string().min(1),
  containerRoleId: z.string().min(1)
});

router.get("/permissions", (_req, res) => {
  res.json({ data: CONTAINER_PERMISSIONS });
});

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const roleName = req.user?.role;

    if (isGlobalAdmin(roleName)) {
      const data = await prisma.productContainer.findMany({
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true, formulas: true, boms: true, memberships: true } }
        },
        orderBy: { updatedAt: "desc" }
      });
      res.json({ data, total: data.length, page: 1, pageSize: data.length || 1 });
      return;
    }

    const data = await prisma.productContainer.findMany({
      where: { memberships: { some: { userId } } },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true, formulas: true, boms: true, memberships: true } }
      },
      orderBy: { updatedAt: "desc" }
    });
    res.json({ data, total: data.length, page: 1, pageSize: data.length || 1 });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    const roleName = req.user?.role;
    if (!actorId || !isGlobalAdmin(roleName)) {
      res.status(403).json({ message: "Only System Admin or PLM Admin can create containers" });
      return;
    }
    const parsed = createContainerSchema.parse(req.body);
    const container = await prisma.productContainer.create({
      data: {
        code: parsed.code,
        name: parsed.name,
        description: parsed.description ?? null,
        industry: parsed.industry,
        ...(parsed.ownerId ? { ownerId: parsed.ownerId } : {})
      }
    });

    const adminRole = await prisma.containerRole.create({
      data: {
        containerId: container.id,
        name: "Container Admin",
        description: "Full administration for this container",
        permissions: [...CONTAINER_PERMISSIONS]
      }
    });

    await prisma.containerMembership.create({
      data: {
        containerId: container.id,
        userId: actorId,
        containerRoleId: adminRole.id
      }
    });

    await writeAuditLog({
      entityType: "CONTAINER",
      entityId: container.id,
      action: "CREATE",
      actorId,
      payload: container
    });
    res.status(201).json(container);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const containerId = String(req.params.id ?? "");
    const hasAccess = await hasContainerAdminAccess(actorId, req.user?.role, containerId);
    if (!hasAccess) {
      res.status(403).json({ message: "Container admin access required" });
      return;
    }

    const payload = z
      .object({
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
        ownerId: z.string().nullable().optional()
      })
      .parse(req.body);

    const updated = await prisma.productContainer.update({
      where: { id: containerId },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description || null } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.ownerId !== undefined ? { ownerId: payload.ownerId } : {})
      }
    });

    await writeAuditLog({
      entityType: "CONTAINER",
      entityId: updated.id,
      action: "UPDATE",
      actorId,
      payload: updated
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/roles", async (req, res, next) => {
  try {
    const containerId = String(req.params.id ?? "");
    const data = await prisma.containerRole.findMany({ where: { containerId }, orderBy: { name: "asc" } });
    res.json({ data, total: data.length, page: 1, pageSize: data.length || 1 });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/roles", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const containerId = String(req.params.id ?? "");
    const hasAccess = await hasContainerAdminAccess(actorId, req.user?.role, containerId);
    if (!hasAccess) {
      res.status(403).json({ message: "Container admin access required" });
      return;
    }

    const parsed = createRoleSchema.parse(req.body);
    const created = await prisma.containerRole.create({
      data: {
        containerId,
        name: parsed.name,
        description: parsed.description ?? null,
        permissions: parsed.permissions
      }
    });
    await writeAuditLog({
      entityType: "CONTAINER_ROLE",
      entityId: created.id,
      action: "CREATE",
      actorId,
      payload: created
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put("/roles/:roleId", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const roleId = String(req.params.roleId ?? "");
    const existing = await prisma.containerRole.findUnique({ where: { id: roleId } });
    if (!existing) {
      res.status(404).json({ message: "Container role not found" });
      return;
    }
    const hasAccess = await hasContainerAdminAccess(actorId, req.user?.role, existing.containerId);
    if (!hasAccess) {
      res.status(403).json({ message: "Container admin access required" });
      return;
    }

    const parsed = createRoleSchema.partial().parse(req.body);
    const updated = await prisma.containerRole.update({
      where: { id: roleId },
      data: {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description || null } : {}),
        ...(parsed.permissions ? { permissions: parsed.permissions } : {})
      }
    });
    await writeAuditLog({
      entityType: "CONTAINER_ROLE",
      entityId: updated.id,
      action: "UPDATE",
      actorId,
      payload: updated
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/roles/:roleId", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const roleId = String(req.params.roleId ?? "");
    const existing = await prisma.containerRole.findUnique({
      where: { id: roleId },
      include: { _count: { select: { members: true } } }
    });
    if (!existing) {
      res.status(404).json({ message: "Container role not found" });
      return;
    }
    const hasAccess = await hasContainerAdminAccess(actorId, req.user?.role, existing.containerId);
    if (!hasAccess) {
      res.status(403).json({ message: "Container admin access required" });
      return;
    }
    if (existing._count.members > 0) {
      res.status(400).json({ message: "Cannot delete a role with active members" });
      return;
    }
    await prisma.containerRole.delete({ where: { id: roleId } });
    await writeAuditLog({
      entityType: "CONTAINER_ROLE",
      entityId: roleId,
      action: "DELETE",
      actorId
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/:id/members", async (req, res, next) => {
  try {
    const containerId = String(req.params.id ?? "");
    const data = await prisma.containerMembership.findMany({
      where: { containerId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        containerRole: true
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ data, total: data.length, page: 1, pageSize: data.length || 1 });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/members", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const containerId = String(req.params.id ?? "");
    const hasAccess = await hasContainerAdminAccess(actorId, req.user?.role, containerId);
    if (!hasAccess) {
      res.status(403).json({ message: "Container admin access required" });
      return;
    }
    const parsed = assignMemberSchema.parse(req.body);
    const role = await prisma.containerRole.findUnique({ where: { id: parsed.containerRoleId } });
    if (!role || role.containerId !== containerId) {
      res.status(400).json({ message: "Container role does not belong to this container" });
      return;
    }

    const created = await prisma.containerMembership.upsert({
      where: { containerId_userId: { containerId, userId: parsed.userId } },
      update: { containerRoleId: parsed.containerRoleId },
      create: { containerId, userId: parsed.userId, containerRoleId: parsed.containerRoleId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        containerRole: true
      }
    });
    await writeAuditLog({
      entityType: "CONTAINER_MEMBERSHIP",
      entityId: created.id,
      action: "UPSERT",
      actorId,
      payload: { containerId, userId: parsed.userId, containerRoleId: parsed.containerRoleId }
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.delete("/members/:membershipId", async (req, res, next) => {
  try {
    const actorId = req.user?.sub;
    if (!actorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const membershipId = String(req.params.membershipId ?? "");
    const existing = await prisma.containerMembership.findUnique({ where: { id: membershipId } });
    if (!existing) {
      res.status(404).json({ message: "Container membership not found" });
      return;
    }
    const hasAccess = await hasContainerAdminAccess(actorId, req.user?.role, existing.containerId);
    if (!hasAccess) {
      res.status(403).json({ message: "Container admin access required" });
      return;
    }
    await prisma.containerMembership.delete({ where: { id: membershipId } });
    await writeAuditLog({
      entityType: "CONTAINER_MEMBERSHIP",
      entityId: membershipId,
      action: "DELETE",
      actorId
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/user-options", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const hasAdmin = isGlobalAdmin(req.user?.role);
    if (!hasAdmin) {
      res.status(403).json({ message: "Only admins can list all users for membership assignment" });
      return;
    }
    const data = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: { select: { name: true } } },
      orderBy: { name: "asc" }
    });
    res.json({ data, total: data.length, page: 1, pageSize: data.length || 1 });
  } catch (error) {
    next(error);
  }
});

export default router;
