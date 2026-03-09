import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({ message: "Validation failed", issues: error.issues });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ message: "Duplicate value violates unique constraint", meta: error.meta });
      return;
    }
    res.status(400).json({ message: error.message, code: error.code });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  res.status(500).json({ message });
}
