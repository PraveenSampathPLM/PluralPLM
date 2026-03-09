import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { getAccessibleContainerIds, isGlobalAdmin } from "../services/container-access.service.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const containerId = String(req.query.containerId ?? "").trim();
    const isAdmin = isGlobalAdmin(req.user?.role);
    const container = containerId
      ? await prisma.productContainer.findUnique({ where: { id: containerId }, select: { industry: true } })
      : null;
    const industryFilter = container?.industry ?? null;
    const accessibleItemContainers = isAdmin ? [] : await getAccessibleContainerIds(userId, "ITEM", "READ");
    const accessibleFormulaContainers = isAdmin ? [] : await getAccessibleContainerIds(userId, "FORMULA", "READ");
    const accessibleBomContainers = isAdmin ? [] : await getAccessibleContainerIds(userId, "BOM", "READ");
    const accessibleChangeContainers = isAdmin ? [] : await getAccessibleContainerIds(userId, "CHANGE", "READ");

    const itemContainerFilter = containerId
      ? { containerId }
      : isAdmin
        ? {}
        : { OR: [{ containerId: null }, { containerId: { in: accessibleItemContainers } }] };
    const formulaContainerFilter = containerId
      ? { containerId }
      : isAdmin
        ? {}
        : { OR: [{ containerId: null }, { containerId: { in: accessibleFormulaContainers } }] };
    const bomContainerFilter = containerId
      ? { containerId }
      : isAdmin
        ? {}
        : { OR: [{ containerId: null }, { containerId: { in: accessibleBomContainers } }] };
    const changeContainerFilter = containerId
      ? { containerId }
      : isAdmin
        ? {}
        : { OR: [{ containerId: null }, { containerId: { in: accessibleChangeContainers } }] };

    const recentStart = new Date();
    recentStart.setDate(recentStart.getDate() - 6);
    recentStart.setHours(0, 0, 0, 0);

    const [activeFormulas, pendingChanges, itemsUnderReview, upcomingExpiries, recentItems, recentFormulas, recentBoms, changeByStatus, recentChanges, recentItemEvents, recentFormulaEvents, recentBomEvents] = await Promise.all([
      prisma.formula.count({
        where: { ...(industryFilter ? { industryType: industryFilter } : {}), status: { in: ["APPROVED", "RELEASED"] }, ...formulaContainerFilter }
      }),
      prisma.changeRequest.count({ where: { status: { in: ["NEW", "SUBMITTED", "UNDER_REVIEW"] }, ...changeContainerFilter } }),
      prisma.item.count({ where: { ...(industryFilter ? { industryType: industryFilter } : {}), status: "UNDER_CHANGE", ...itemContainerFilter } }),
      prisma.formula.count({
        where: {
          ...(industryFilter ? { industryType: industryFilter } : {}),
          expiryDate: { gte: new Date(), lte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
          ...formulaContainerFilter
        }
      }),
      prisma.item.findMany({
        where: { ...(industryFilter ? { industryType: industryFilter } : {}), ...itemContainerFilter },
        select: { id: true, itemCode: true, name: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 4
      }),
      prisma.formula.findMany({
        where: { ...(industryFilter ? { industryType: industryFilter } : {}), ...formulaContainerFilter },
        select: { id: true, formulaCode: true, version: true, name: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 4
      }),
      prisma.bOM.findMany({
        where: {
          ...(industryFilter
            ? { OR: [{ formula: { industryType: industryFilter } }, { parentItem: { industryType: industryFilter } }] }
            : {}),
          ...bomContainerFilter
        },
        select: { id: true, bomCode: true, version: true, type: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 4
      }),
      prisma.changeRequest.groupBy({
        by: ["status"],
        where: changeContainerFilter,
        _count: { _all: true }
      }),
      prisma.changeRequest.findMany({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)
          },
          ...changeContainerFilter
        },
        select: { status: true, createdAt: true },
        orderBy: { createdAt: "asc" }
      }),
      prisma.item.findMany({
        where: { ...(industryFilter ? { industryType: industryFilter } : {}), createdAt: { gte: recentStart }, ...itemContainerFilter },
        select: { createdAt: true }
      }),
      prisma.formula.findMany({
        where: { ...(industryFilter ? { industryType: industryFilter } : {}), createdAt: { gte: recentStart }, ...formulaContainerFilter },
        select: { createdAt: true }
      }),
      prisma.bOM.findMany({
        where: {
          ...(industryFilter
            ? { OR: [{ formula: { industryType: industryFilter } }, { parentItem: { industryType: industryFilter } }] }
            : {}),
          createdAt: { gte: recentStart },
          ...bomContainerFilter
        },
        select: { createdAt: true }
      })
    ]);

    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - i, 1);
      monthKeys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    const monthlyTrend = monthKeys.map((key) => ({ month: key, created: 0, implemented: 0 }));
    for (const change of recentChanges) {
      const key = `${change.createdAt.getFullYear()}-${String(change.createdAt.getMonth() + 1).padStart(2, "0")}`;
      const target = monthlyTrend.find((row) => row.month === key);
      if (!target) {
        continue;
      }
      target.created += 1;
      if (change.status === "IMPLEMENTED") {
        target.implemented += 1;
      }
    }

    const dayKeys: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      dayKeys.push(key);
    }

    const buildDaily = (rows: Array<{ createdAt: Date }>) =>
      dayKeys.map((key) => {
        const count = rows.filter((row) => {
          const date = row.createdAt;
          const rowKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          return rowKey === key;
        }).length;
        return { day: key, count };
      });

    res.json({
      kpis: { activeFormulas, pendingChanges, itemsUnderReview, upcomingExpiries },
      recent: {
        items: recentItems,
        formulas: recentFormulas,
        boms: recentBoms
      },
      recentActivity: {
        items: buildDaily(recentItemEvents),
        formulas: buildDaily(recentFormulaEvents),
        boms: buildDaily(recentBomEvents)
      },
      changeDashboard: {
        byStatus: changeByStatus.map((entry) => ({ status: entry.status, count: entry._count._all })),
        monthlyTrend
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
