import { Router, Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { z } from "zod";
import { allocateNextSequenceValue } from "../services/config-store.service.js";

const router = Router();

// Stage order for advancement
const STAGE_ORDER = ["DISCOVERY", "FEASIBILITY", "DEVELOPMENT", "VALIDATION", "LAUNCH"] as const;
type NpdStageType = typeof STAGE_ORDER[number];

function nextStage(current: NpdStageType): NpdStageType | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1] ?? null;
}

// Auto-generate project code
async function generateProjectCode(): Promise<string> {
  const seq = await prisma.numberSequence.upsert({
    where: { entity: "NpdProject" },
    update: { next: { increment: 1 } },
    create: { entity: "NpdProject", prefix: "NPD", padding: 4, next: 2 }
  });
  const num = String(seq.next - 1).padStart(seq.padding, "0");
  return `${seq.prefix}-${num}`;
}

// LIST projects
router.get("/projects", async (req: Request, res: Response) => {
  try {
    const containerId = typeof req.query["containerId"] === "string" ? req.query["containerId"] : undefined;
    const page = parseInt(String(req.query["page"] ?? "1"), 10);
    const pageSize = parseInt(String(req.query["pageSize"] ?? "25"), 10);
    const search = typeof req.query["search"] === "string" ? req.query["search"] : undefined;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (containerId) where["containerId"] = containerId;
    if (search) where["OR"] = [
      { name: { contains: search, mode: "insensitive" } },
      { projectCode: { contains: search, mode: "insensitive" } }
    ];

    const [data, total] = await Promise.all([
      prisma.npdProject.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          projectLead: { select: { id: true, name: true, email: true } },
          container: { select: { id: true, code: true, name: true } },
          fgItem: { select: { id: true, itemCode: true, name: true } },
          gateReviews: { select: { id: true, gate: true, decision: true } }
        }
      }),
      prisma.npdProject.count({ where })
    ]);

    res.json({ data, total, page, pageSize });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list NPD projects" });
  }
});

// CREATE project
router.post("/projects", async (req: Request, res: Response) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      containerId: z.string().optional(),
      projectLeadId: z.string().optional(),
      fgItemId: z.string().optional(),
      formulaId: z.string().optional(),
      targetLaunchDate: z.string().optional()
    }).parse(req.body);

    const projectCode = await generateProjectCode();

    // Build data object without undefined values to satisfy exactOptionalPropertyTypes
    const createData: Parameters<typeof prisma.npdProject.create>[0]["data"] = {
      projectCode,
      name: body.name,
      stage: "DISCOVERY",
      status: "ACTIVE"
    };
    if (body.description !== undefined) createData.description = body.description;
    if (body.containerId !== undefined) createData.containerId = body.containerId;
    if (body.projectLeadId !== undefined) createData.projectLeadId = body.projectLeadId;
    if (body.fgItemId !== undefined) createData.fgItemId = body.fgItemId;
    if (body.formulaId !== undefined) createData.formulaId = body.formulaId;
    if (body.targetLaunchDate !== undefined) createData.targetLaunchDate = new Date(body.targetLaunchDate);

    const project = await prisma.npdProject.create({
      data: createData,
      include: {
        projectLead: { select: { id: true, name: true, email: true } },
        container: { select: { id: true, code: true, name: true } }
      }
    });

    res.status(201).json(project);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.errors[0]?.message ?? "Validation error" });
      return;
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create NPD project" });
  }
});

// GET single project
router.get("/projects/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const project = await prisma.npdProject.findUnique({
      where: { id },
      include: {
        projectLead: { select: { id: true, name: true, email: true } },
        container: { select: { id: true, code: true, name: true } },
        fgItem: { select: { id: true, itemCode: true, name: true, status: true } },
        formula: { select: { id: true, formulaCode: true, name: true, status: true } },
        gateReviews: {
          orderBy: { createdAt: "desc" },
          include: { reviewedBy: { select: { id: true, name: true } } }
        }
      }
    });

    if (!project) {
      res.status(404).json({ message: "NPD project not found" });
      return;
    }

    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch NPD project" });
  }
});

// UPDATE project
router.patch("/projects/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const body = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      stage: z.enum(["DISCOVERY", "FEASIBILITY", "DEVELOPMENT", "VALIDATION", "LAUNCH"]).optional(),
      status: z.enum(["ACTIVE", "ON_HOLD", "KILLED", "COMPLETED"]).optional(),
      targetLaunchDate: z.string().nullable().optional(),
      actualLaunchDate: z.string().nullable().optional(),
      projectLeadId: z.string().nullable().optional(),
      fgItemId: z.string().nullable().optional(),
      formulaId: z.string().nullable().optional(),
      linkedItemIds: z.array(z.string()).optional(),
      linkedFormulaIds: z.array(z.string()).optional(),
      linkedDocumentIds: z.array(z.string()).optional(),
      linkedSpecIds: z.array(z.string()).optional()
    }).parse(req.body);

    // Build update data explicitly to avoid exactOptionalPropertyTypes issues
    const updateData: Parameters<typeof prisma.npdProject.update>[0]["data"] = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.stage !== undefined) updateData.stage = body.stage;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.projectLeadId !== undefined) updateData.projectLeadId = body.projectLeadId;
    if (body.fgItemId !== undefined) updateData.fgItemId = body.fgItemId;
    if (body.formulaId !== undefined) updateData.formulaId = body.formulaId;
    if (body.linkedItemIds !== undefined) updateData.linkedItemIds = body.linkedItemIds;
    if (body.linkedFormulaIds !== undefined) updateData.linkedFormulaIds = body.linkedFormulaIds;
    if (body.linkedDocumentIds !== undefined) updateData.linkedDocumentIds = body.linkedDocumentIds;
    if (body.linkedSpecIds !== undefined) updateData.linkedSpecIds = body.linkedSpecIds;
    if (body.targetLaunchDate !== undefined) {
      updateData.targetLaunchDate = body.targetLaunchDate !== null ? new Date(body.targetLaunchDate) : null;
    }
    if (body.actualLaunchDate !== undefined) {
      updateData.actualLaunchDate = body.actualLaunchDate !== null ? new Date(body.actualLaunchDate) : null;
    }

    const updated = await prisma.npdProject.update({
      where: { id },
      data: updateData,
      include: {
        projectLead: { select: { id: true, name: true, email: true } },
        container: { select: { id: true, code: true, name: true } },
        fgItem: { select: { id: true, itemCode: true, name: true, status: true } },
        gateReviews: true
      }
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.errors[0]?.message ?? "Validation error" });
      return;
    }
    console.error(err);
    res.status(500).json({ message: "Failed to update NPD project" });
  }
});

// DELETE project
router.delete("/projects/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    await prisma.npdProject.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete NPD project" });
  }
});

// LIST gate reviews for a project
router.get("/projects/:id/gate-reviews", async (req: Request, res: Response) => {
  try {
    const npdProjectId = req.params["id"] as string;
    const reviews = await prisma.gateReview.findMany({
      where: { npdProjectId },
      orderBy: { createdAt: "desc" },
      include: { reviewedBy: { select: { id: true, name: true } } }
    });
    res.json({ data: reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch gate reviews" });
  }
});

// CREATE gate review
router.post("/projects/:id/gate-reviews", async (req: Request, res: Response) => {
  try {
    const npdProjectId = req.params["id"] as string;
    const body = z.object({
      gate: z.enum(["DISCOVERY", "FEASIBILITY", "DEVELOPMENT", "VALIDATION", "LAUNCH"]),
      decision: z.enum(["GO", "KILL", "HOLD", "RECYCLE"]).optional(),
      mustMeetCriteria: z.array(z.object({
        id: z.string(),
        criterion: z.string(),
        passed: z.boolean().nullable()
      })),
      shouldMeetCriteria: z.array(z.object({
        id: z.string(),
        criterion: z.string(),
        score: z.number().nullable(),
        weight: z.number()
      })),
      comments: z.string().optional(),
      reviewedById: z.string().optional()
    }).parse(req.body);

    // Calculate overall score from should-meet criteria
    const totalWeight = body.shouldMeetCriteria.reduce((s, c) => s + c.weight, 0);
    const weightedScore = body.shouldMeetCriteria.reduce((s, c) => s + (c.score ?? 0) * c.weight, 0);
    const overallScore = totalWeight > 0 ? (weightedScore / totalWeight) : null;

    // Build create data explicitly
    const reviewCreateData: Parameters<typeof prisma.gateReview.create>[0]["data"] = {
      npdProjectId,
      gate: body.gate,
      mustMeetCriteria: body.mustMeetCriteria,
      shouldMeetCriteria: body.shouldMeetCriteria,
      overallScore
    };
    if (body.decision !== undefined) reviewCreateData.decision = body.decision;
    if (body.comments !== undefined) reviewCreateData.comments = body.comments;
    if (body.reviewedById !== undefined) reviewCreateData.reviewedById = body.reviewedById;
    if (body.decision !== undefined) reviewCreateData.reviewedAt = new Date();

    const review = await prisma.gateReview.create({
      data: reviewCreateData,
      include: { reviewedBy: { select: { id: true, name: true } } }
    });

    // Handle decision-based project state changes
    let autoCreatedReleaseId: string | undefined;

    if (body.decision === "GO") {
      const allMustMeetsPassed = body.mustMeetCriteria.every((c) => c.passed === true);
      if (allMustMeetsPassed) {
        const project = await prisma.npdProject.findUnique({ where: { id: npdProjectId } });
        if (project) {
          const next = nextStage(project.stage as NpdStageType);
          if (next) {
            await prisma.npdProject.update({
              where: { id: npdProjectId },
              data: { stage: next }
            });
          } else {
            // Final gate (LAUNCH) passed — mark as COMPLETED
            await prisma.npdProject.update({
              where: { id: npdProjectId },
              data: { status: "COMPLETED", actualLaunchDate: new Date() }
            });

            // Auto-create a ReleaseRequest linked to this NPD project
            if (project.stage === "LAUNCH") {
              try {
                // Determine the requestedById: use the gate reviewer, the project lead, or fall back to any System Admin
                let requestedById = body.reviewedById;
                if (!requestedById) {
                  requestedById = project.projectLeadId ?? undefined;
                }
                if (!requestedById) {
                  const adminRole = await prisma.role.findFirst({ where: { name: "System Admin" } });
                  if (adminRole) {
                    const adminUser = await prisma.user.findFirst({ where: { roleId: adminRole.id } });
                    requestedById = adminUser?.id;
                  }
                }

                if (requestedById) {
                  const rrNumber = await allocateNextSequenceValue("RELEASE_REQUEST", project.containerId);
                  const releaseTitle = `Launch Release — ${project.name} (${project.projectCode})`;
                  const releaseDescription = "Automatically created from NPD Gate 5 GO decision.";

                  const releaseCreateData: Parameters<typeof prisma.releaseRequest.create>[0]["data"] = {
                    rrNumber,
                    title: releaseTitle,
                    description: releaseDescription,
                    status: "NEW",
                    requestedById,
                    targetItems: [],
                    targetFormulas: [],
                    affectedItems: [],
                    affectedFormulas: [],
                    affectedDocuments: []
                  };
                  if (project.containerId) {
                    releaseCreateData.containerId = project.containerId;
                  }

                  const createdRelease = await prisma.releaseRequest.create({ data: releaseCreateData });
                  autoCreatedReleaseId = createdRelease.id;
                }
              } catch (releaseErr) {
                console.error("[NPD Gate Review] Failed to auto-create ReleaseRequest:", releaseErr);
              }
            }
          }
        }
      }
    } else if (body.decision === "KILL") {
      await prisma.npdProject.update({
        where: { id: npdProjectId },
        data: { status: "KILLED" }
      });
    } else if (body.decision === "HOLD") {
      await prisma.npdProject.update({
        where: { id: npdProjectId },
        data: { status: "ON_HOLD" }
      });
    }

    res.status(201).json({ ...review, ...(autoCreatedReleaseId !== undefined ? { autoCreatedReleaseId } : {}) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.errors[0]?.message ?? "Validation error" });
      return;
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create gate review" });
  }
});

// UPDATE gate review
router.patch("/projects/:id/gate-reviews/:reviewId", async (req: Request, res: Response) => {
  try {
    const reviewId = req.params["reviewId"] as string;
    const body = z.object({
      decision: z.enum(["GO", "KILL", "HOLD", "RECYCLE"]).nullable().optional(),
      mustMeetCriteria: z.array(z.any()).optional(),
      shouldMeetCriteria: z.array(z.any()).optional(),
      comments: z.string().optional()
    }).parse(req.body);

    // Build update data explicitly
    const updateData: Parameters<typeof prisma.gateReview.update>[0]["data"] = {};
    if (body.decision !== undefined) {
      updateData.decision = body.decision;
      if (body.decision !== null) updateData.reviewedAt = new Date();
    }
    if (body.mustMeetCriteria !== undefined) updateData.mustMeetCriteria = body.mustMeetCriteria;
    if (body.shouldMeetCriteria !== undefined) updateData.shouldMeetCriteria = body.shouldMeetCriteria;
    if (body.comments !== undefined) updateData.comments = body.comments;

    const updated = await prisma.gateReview.update({
      where: { id: reviewId },
      data: updateData
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update gate review" });
  }
});

// GET templates
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const industry = typeof req.query["industry"] === "string" ? req.query["industry"] : undefined;
    const where: Record<string, unknown> = {};
    if (industry) where["industry"] = industry;

    const templates = await prisma.stageGateTemplate.findMany({
      where,
      orderBy: [{ industry: "asc" }, { stage: "asc" }]
    });
    res.json({ data: templates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch stage gate templates" });
  }
});

// GET deliverable status for a project
router.get("/projects/:id/deliverable-status", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const project = await prisma.npdProject.findUnique({
      where: { id },
      include: {
        container: { select: { id: true, industry: true } },
        fgItem: { select: { id: true } },
        formula: { select: { id: true } }
      }
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Get template for current stage and industry
    const industry = project.container?.industry ?? "CHEMICAL";
    const template = await prisma.stageGateTemplate.findUnique({
      where: {
        industry_stage: {
          industry: industry as "CPG" | "CHEMICAL" | "TYRE" | "POLYMER" | "PAINT" | "FOOD_BEVERAGE",
          stage: project.stage
        }
      }
    });

    const deliverables = (template?.deliverables as Array<{ id: string; label: string; type: string; required: boolean }>) ?? [];

    // Evaluate each deliverable
    const evaluated = deliverables.map((d) => {
      let satisfied = false;
      if (d.type === "FORMULA") satisfied = !!project.formulaId || project.linkedFormulaIds.length > 0;
      else if (d.type === "ITEM") satisfied = !!project.fgItemId || project.linkedItemIds.length > 0;
      else if (d.type === "DOCUMENT") satisfied = project.linkedDocumentIds.length > 0;
      else if (d.type === "SPEC") satisfied = project.linkedSpecIds.length > 0;
      else satisfied = false; // MANUAL type — not auto-checked
      return { ...d, satisfied };
    });

    const required = evaluated.filter((d) => d.required);
    const completed = required.filter((d) => d.satisfied).length;
    const completeness = required.length > 0 ? Math.round((completed / required.length) * 100) : 100;

    res.json({ deliverables: evaluated, completeness, stage: project.stage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to compute deliverable status" });
  }
});

export default router;
