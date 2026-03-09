import express from "express";
import cors from "cors";
import {
  authRoutes,
  usersRoutes,
  itemRoutes,
  formulaRoutes,
  bomRoutes,
  changesRoutes,
  workflowsRoutes,
  specificationsRoutes,
  complianceRoutes,
  reportsRoutes,
  dashboardRoutes,
  configRoutes,
  containersRoutes,
  releasesRoutes,
  documentsRoutes,
  labelsRoutes
} from "./routes/index.js";
import { authenticate } from "./middleware/auth.middleware.js";
import { errorMiddleware } from "./middleware/error.middleware.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", authenticate, usersRoutes);
  app.use("/api/items", authenticate, itemRoutes);
  app.use("/api/formulas", authenticate, formulaRoutes);
  app.use("/api/bom", authenticate, bomRoutes);
  app.use("/api/changes", authenticate, changesRoutes);
  app.use("/api/releases", authenticate, releasesRoutes);
  app.use("/api/workflows", authenticate, workflowsRoutes);
  app.use("/api/specifications", authenticate, specificationsRoutes);
  app.use("/api/compliance", authenticate, complianceRoutes);
  app.use("/api/reports", authenticate, reportsRoutes);
  app.use("/api/config", authenticate, configRoutes);
  app.use("/api/dashboard", authenticate, dashboardRoutes);
  app.use("/api/containers", authenticate, containersRoutes);
  app.use("/api/documents", authenticate, documentsRoutes);
  app.use("/api/labels", authenticate, labelsRoutes);

  app.use(errorMiddleware);

  return app;
}
