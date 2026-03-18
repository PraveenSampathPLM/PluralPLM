import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../services/prisma.js";
import { env } from "../config/env.js";
import { writeAuditLog } from "../services/audit.service.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (!user) {
      await writeAuditLog({
        entityType: "AUTH",
        entityId: email,
        action: "LOGIN_FAILED",
        payload: { email, reason: "USER_NOT_FOUND" }
      });
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await writeAuditLog({
        entityType: "AUTH",
        entityId: user.id,
        actorId: user.id,
        action: "LOGIN_FAILED",
        payload: { email: user.email, reason: "INVALID_PASSWORD" }
      });
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const expiresIn = env.JWT_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>;
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role.name },
      env.JWT_SECRET,
      { expiresIn }
    );

    await writeAuditLog({
      entityType: "AUTH",
      entityId: user.id,
      actorId: user.id,
      action: "LOGIN_SUCCESS",
      payload: { email: user.email, role: user.role.name }
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role.name } });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", (_req, res) => {
  res.status(501).json({ message: "Refresh token flow to be implemented" });
});

router.post("/logout", (_req, res) => {
  res.status(204).send();
});

export default router;
