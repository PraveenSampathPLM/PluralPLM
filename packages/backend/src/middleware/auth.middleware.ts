import type { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthTokenPayload } from "@plm/shared";

function toAuthTokenPayload(payload: string | JwtPayload): AuthTokenPayload | null {
  if (typeof payload === "string") {
    return null;
  }

  const { sub, email, role } = payload;
  if (typeof sub !== "string" || typeof email !== "string" || typeof role !== "string") {
    return null;
  }

  return { sub, email, role };
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const payload = toAuthTokenPayload(decoded);
    if (!payload) {
      res.status(401).json({ message: "Invalid token payload" });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

export function authorize(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}
