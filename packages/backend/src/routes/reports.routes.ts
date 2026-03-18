import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";

const router = Router();

// ─── helpers ────────────────────────────────────────────────────────────────

function containerWhere(containerId?: string): Record<string, unknown> {
  return containerId ? { containerId } : {};
}

function daysOpen(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

router.get("/kpis", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();

    const [
      totalItems,
      releasedItems,
      openChanges,
      openReleases,
      activeNpdProjects,
      overdueNpdProjects,
      formulasDraft,
      artworksPendingReview,
    ] = await Promise.all([
      prisma.item.count(),
      prisma.item.count({ where: { status: "RELEASED" } }),
      prisma.changeRequest.count({
        where: { status: { notIn: ["IMPLEMENTED", "REJECTED"] } },
      }),
      prisma.releaseRequest.count({
        where: { status: { notIn: ["RELEASED", "REJECTED"] } },
      }),
      prisma.npdProject.count({ where: { status: "ACTIVE" } }),
      prisma.npdProject.count({
        where: {
          status: "ACTIVE",
          targetLaunchDate: { lt: now },
        },
      }),
      prisma.formula.count({ where: { status: "IN_WORK" } }),
      prisma.artwork.count({ where: { status: "REVIEW" } }),
    ]);

    res.json({
      totalItems,
      releasedItems,
      openChanges,
      openReleases,
      activeNpdProjects,
      overdueNpdProjects,
      formulasDraft,
      artworksPendingReview,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Formula Card ────────────────────────────────────────────────────────────

router.get("/formula-card/:formulaId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const formula = await prisma.formula.findUnique({
      where: { id: String(req.params.formulaId ?? "") },
      include: { ingredients: { include: { item: true } }, owner: true },
    });

    if (!formula) {
      res.status(404).json({ message: "Formula not found" });
      return;
    }

    res.json({
      reportType: "FORMULA_CARD",
      generatedAt: new Date().toISOString(),
      formula,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Change Aging ────────────────────────────────────────────────────────────

router.get("/change-aging", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const containerId =
      typeof req.query["containerId"] === "string" ? req.query["containerId"] : undefined;
    const priority =
      typeof req.query["priority"] === "string" ? req.query["priority"] : undefined;
    const status =
      typeof req.query["status"] === "string" ? req.query["status"] : undefined;

    const where: Record<string, unknown> = { ...containerWhere(containerId) };
    if (priority) where["priority"] = priority;
    if (status) where["status"] = status;

    const changes = await prisma.changeRequest.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        crNumber: true,
        title: true,
        priority: true,
        status: true,
        createdAt: true,
        affectedItems: true,
        affectedFormulas: true,
        affectedDocuments: true,
      },
    });

    const result = changes
      .map((c) => ({
        id: c.id,
        changeCode: c.crNumber,
        title: c.title,
        priority: c.priority,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        daysOpen: daysOpen(c.createdAt),
        affectedItemCount:
          c.affectedItems.length + c.affectedFormulas.length + c.affectedDocuments.length,
      }))
      .sort((a, b) => b.daysOpen - a.daysOpen);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ─── Release Readiness ────────────────────────────────────────────────────────

router.get("/release-readiness", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const containerId =
      typeof req.query["containerId"] === "string" ? req.query["containerId"] : undefined;

    const releases = await prisma.releaseRequest.findMany({
      where: containerWhere(containerId),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rrNumber: true,
        title: true,
        status: true,
        targetItems: true,
        targetFormulas: true,
        affectedItems: true,
        affectedFormulas: true,
        affectedDocuments: true,
      },
    });

    // For each release, resolve released items count
    const result = await Promise.all(
      releases.map(async (r) => {
        const allAffected = [
          ...r.affectedItems,
          ...r.affectedFormulas,
          ...r.affectedDocuments,
        ];
        const affectedObjectCount = allAffected.length;

        // Count released items among affected
        const releasedItemsCount = await prisma.item.count({
          where: { id: { in: r.affectedItems }, status: "RELEASED" },
        });
        const releasedFormulasCount = await prisma.formula.count({
          where: { id: { in: r.affectedFormulas }, status: "RELEASED" },
        });

        const itemsReleased = releasedItemsCount + releasedFormulasCount;
        const itemsPending = affectedObjectCount - itemsReleased;
        const readinessPct =
          affectedObjectCount > 0
            ? Math.round((itemsReleased / affectedObjectCount) * 100)
            : 0;

        return {
          id: r.id,
          releaseCode: r.rrNumber,
          title: r.title,
          status: r.status,
          affectedObjectCount,
          itemsReleased,
          itemsPending,
          readinessPct,
        };
      })
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ─── NPD Status ──────────────────────────────────────────────────────────────

router.get("/npd-status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const containerId =
      typeof req.query["containerId"] === "string" ? req.query["containerId"] : undefined;

    const projects = await prisma.npdProject.findMany({
      where: containerWhere(containerId),
      orderBy: { createdAt: "desc" },
      include: {
        gateReviews: { select: { gate: true, decision: true } },
        fgItem: { select: { itemCode: true, name: true } },
      },
    });

    const now = Date.now();

    const result = projects.map((p) => {
      const gatesPassed = p.gateReviews.filter((g) => g.decision === "GO").length;
      const completedGates = p.gateReviews
        .filter((g) => g.decision !== null && g.decision !== undefined)
        .map((g) => ({ gate: g.gate, decision: g.decision }));

      const daysUntilLaunch = p.targetLaunchDate
        ? Math.floor((p.targetLaunchDate.getTime() - now) / 86_400_000)
        : null;

      return {
        id: p.id,
        projectCode: p.projectCode,
        name: p.name,
        stage: p.stage,
        status: p.status,
        targetLaunchDate: p.targetLaunchDate ? p.targetLaunchDate.toISOString() : null,
        daysUntilLaunch,
        gatesPassed,
        completedGates,
        linkedFgItem: p.fgItem
          ? { code: p.fgItem.itemCode, name: p.fgItem.name }
          : null,
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ─── FG Missing Formula ──────────────────────────────────────────────────────
// Items of type FINISHED_GOOD that have no linked FGStructure

router.get("/fg-missing-formula", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const containerId =
      typeof req.query["containerId"] === "string" ? req.query["containerId"] : undefined;

    const fgItems = await prisma.item.findMany({
      where: {
        ...containerWhere(containerId),
        itemType: "FINISHED_GOOD",
        fgStructures: { none: {} },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        itemCode: true,
        name: true,
        status: true,
        createdAt: true,
        revisionLabel: true,
      },
    });

    const result = fgItems.map((item) => ({
      id: item.id,
      fgCode: item.itemCode,
      fgName: item.name,
      version: item.revisionLabel,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ─── Items by Status ─────────────────────────────────────────────────────────

router.get("/items-by-status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const containerId =
      typeof req.query["containerId"] === "string" ? req.query["containerId"] : undefined;

    const where = containerWhere(containerId);

    const [byStatus, byItemType] = await Promise.all([
      prisma.item.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        orderBy: { _count: { status: "desc" } },
      }),
      prisma.item.groupBy({
        by: ["itemType", "status"],
        where,
        _count: { _all: true },
        orderBy: [{ itemType: "asc" }, { status: "asc" }],
      }),
    ]);

    res.json({
      byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
      byItemType: byItemType.map((row) => ({
        itemType: row.itemType,
        status: row.status,
        count: row._count._all,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ─── CSV Export ───────────────────────────────────────────────────────────────

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    // wrap in quotes if contains comma, quote, or newline
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\r\n");
}

router.get(
  "/export/:reportType",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportType } = req.params;
      const containerId =
        typeof req.query["containerId"] === "string" ? req.query["containerId"] : undefined;
      const priority =
        typeof req.query["priority"] === "string" ? req.query["priority"] : undefined;
      const status =
        typeof req.query["status"] === "string" ? req.query["status"] : undefined;

      const today = new Date().toISOString().slice(0, 10);

      let rows: Record<string, unknown>[] = [];

      if (reportType === "change-aging") {
        const where: Record<string, unknown> = { ...containerWhere(containerId) };
        if (priority) where["priority"] = priority;
        if (status) where["status"] = status;

        const changes = await prisma.changeRequest.findMany({
          where,
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            crNumber: true,
            title: true,
            priority: true,
            status: true,
            createdAt: true,
            affectedItems: true,
            affectedFormulas: true,
            affectedDocuments: true,
          },
        });

        rows = changes
          .map((c) => ({
            "Change Code": c.crNumber,
            Title: c.title,
            Priority: c.priority,
            Status: c.status,
            "Created At": c.createdAt.toISOString(),
            "Days Open": daysOpen(c.createdAt),
            "Affected Item Count":
              c.affectedItems.length + c.affectedFormulas.length + c.affectedDocuments.length,
          }))
          .sort(
            (a, b) => (b["Days Open"] as number) - (a["Days Open"] as number)
          );
      } else if (reportType === "release-readiness") {
        const releases = await prisma.releaseRequest.findMany({
          where: containerWhere(containerId),
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            rrNumber: true,
            title: true,
            status: true,
            affectedItems: true,
            affectedFormulas: true,
            affectedDocuments: true,
          },
        });

        for (const r of releases) {
          const allAffected = [
            ...r.affectedItems,
            ...r.affectedFormulas,
            ...r.affectedDocuments,
          ];
          const affectedObjectCount = allAffected.length;
          const releasedItems = await prisma.item.count({
            where: { id: { in: r.affectedItems }, status: "RELEASED" },
          });
          const releasedFormulas = await prisma.formula.count({
            where: { id: { in: r.affectedFormulas }, status: "RELEASED" },
          });
          const itemsReleased = releasedItems + releasedFormulas;
          const itemsPending = affectedObjectCount - itemsReleased;
          const readinessPct =
            affectedObjectCount > 0
              ? Math.round((itemsReleased / affectedObjectCount) * 100)
              : 0;

          rows.push({
            "Release Code": r.rrNumber,
            Title: r.title,
            Status: r.status,
            "Affected Objects": affectedObjectCount,
            "Items Released": itemsReleased,
            "Items Pending": itemsPending,
            "Readiness %": readinessPct,
          });
        }
      } else if (reportType === "npd-status") {
        const projects = await prisma.npdProject.findMany({
          where: containerWhere(containerId),
          orderBy: { createdAt: "desc" },
          include: {
            gateReviews: { select: { gate: true, decision: true } },
            fgItem: { select: { itemCode: true, name: true } },
          },
        });

        const now = Date.now();
        rows = projects.map((p) => {
          const gatesPassed = p.gateReviews.filter((g) => g.decision === "GO").length;
          const daysUntilLaunch = p.targetLaunchDate
            ? Math.floor((p.targetLaunchDate.getTime() - now) / 86_400_000)
            : "";

          return {
            "Project Code": p.projectCode,
            Name: p.name,
            Stage: p.stage,
            Status: p.status,
            "Target Launch Date": p.targetLaunchDate
              ? p.targetLaunchDate.toISOString().slice(0, 10)
              : "",
            "Days Until Launch": daysUntilLaunch,
            "Gates Passed": gatesPassed,
            "FG Item": p.fgItem ? `${p.fgItem.itemCode} – ${p.fgItem.name}` : "",
          };
        });
      } else if (reportType === "fg-missing-formula") {
        const fgItems = await prisma.item.findMany({
          where: {
            ...containerWhere(containerId),
            itemType: "FINISHED_GOOD",
            fgStructures: { none: {} },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            itemCode: true,
            name: true,
            status: true,
            createdAt: true,
            revisionLabel: true,
          },
        });

        rows = fgItems.map((item) => ({
          "FG Code": item.itemCode,
          "FG Name": item.name,
          Version: item.revisionLabel,
          Status: item.status,
          "Created At": item.createdAt.toISOString().slice(0, 10),
        }));
      } else if (reportType === "items-by-status") {
        const byStatus = await prisma.item.groupBy({
          by: ["status"],
          where: containerWhere(containerId),
          _count: { _all: true },
          orderBy: { _count: { status: "desc" } },
        });

        rows = byStatus.map((row) => ({
          Status: row.status,
          Count: row._count._all,
        }));
      } else {
        res.status(400).json({ message: `Unknown report type: ${reportType}` });
        return;
      }

      const csv = toCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportType}-${today}.csv"`
      );
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
