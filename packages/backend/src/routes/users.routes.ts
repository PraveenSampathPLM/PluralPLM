import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../services/prisma.js";
import { authorize } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        include: { role: true, organization: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.user.count()
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const body = req.body as {
      email: string;
      name: string;
      password: string;
      roleId: string;
      organizationId?: string;
    };

    const passwordHash = await bcrypt.hash(body.password, 10);
    const created = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        roleId: body.roleId,
        passwordHash,
        organizationId: body.organizationId ?? null
      }
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/role", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const body = req.body as { roleId?: string };
    const roleId = body.roleId ?? "";
    const userId = typeof req.params.id === "string" ? req.params.id : "";
    const updated = await prisma.user.update({ where: { id: userId }, data: { roleId } });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
