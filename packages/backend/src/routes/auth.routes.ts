import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../services/prisma.js";
import { env } from "../config/env.js";

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
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const expiresIn = env.JWT_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>;
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role.name },
      env.JWT_SECRET,
      { expiresIn }
    );

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
