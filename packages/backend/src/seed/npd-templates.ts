import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const templates = [
  {
    industry: "FOOD_BEVERAGE" as const,
    stage: "DISCOVERY" as const,
    deliverables: [
      { id: "d1", label: "Consumer Insight / Market Brief", type: "DOCUMENT", required: true },
      { id: "d2", label: "Concept Statement", type: "DOCUMENT", required: true },
      { id: "d3", label: "Competitive Landscape Review", type: "DOCUMENT", required: false },
      { id: "d4", label: "Preliminary Cost Estimate", type: "MANUAL", required: false }
    ],
    mustMeetCriteria: [
      { id: "m1", criterion: "Concept aligns with brand strategy" },
      { id: "m2", criterion: "Target market clearly defined" },
      { id: "m3", criterion: "No known regulatory blockers" }
    ],
    shouldMeetCriteria: [
      { id: "s1", criterion: "Market size > $10M", weight: 3 },
      { id: "s2", criterion: "Unique differentiator vs. competition", weight: 2 },
      { id: "s3", criterion: "Feasible within current capabilities", weight: 2 }
    ]
  },
  {
    industry: "FOOD_BEVERAGE" as const,
    stage: "FEASIBILITY" as const,
    deliverables: [
      { id: "d1", label: "Formula Concept (Draft)", type: "FORMULA", required: true },
      { id: "d2", label: "Cost Model (Target vs Estimate)", type: "DOCUMENT", required: true },
      { id: "d3", label: "Regulatory Pre-Screen", type: "DOCUMENT", required: true },
      { id: "d4", label: "Resource & Capacity Plan", type: "MANUAL", required: false },
      { id: "d5", label: "Packaging Concept Sketches", type: "DOCUMENT", required: false }
    ],
    mustMeetCriteria: [
      { id: "m1", criterion: "Formula concept technically feasible" },
      { id: "m2", criterion: "Cost target achievable (within 20% of target)" },
      { id: "m3", criterion: "No FSSAI / regulatory showstoppers identified" },
      { id: "m4", criterion: "R&D resources available" }
    ],
    shouldMeetCriteria: [
      { id: "s1", criterion: "Gross margin target met (>40%)", weight: 3 },
      { id: "s2", criterion: "Clean label / natural ingredients", weight: 2 },
      { id: "s3", criterion: "Scalable to full production volume", weight: 3 },
      { id: "s4", criterion: "Shelf life target achievable (>12 months)", weight: 2 }
    ]
  },
  {
    industry: "FOOD_BEVERAGE" as const,
    stage: "DEVELOPMENT" as const,
    deliverables: [
      { id: "d1", label: "Approved Formula (v1.0)", type: "FORMULA", required: true },
      { id: "d2", label: "Finished Good Item Created", type: "ITEM", required: true },
      { id: "d3", label: "Product Specification (Draft)", type: "SPEC", required: true },
      { id: "d4", label: "Pilot Batch Trial Report", type: "DOCUMENT", required: true },
      { id: "d5", label: "Shelf Life Study Initiated", type: "DOCUMENT", required: true },
      { id: "d6", label: "Nutritional Profile / Labelling Draft", type: "DOCUMENT", required: false },
      { id: "d7", label: "Artwork Brief", type: "DOCUMENT", required: false }
    ],
    mustMeetCriteria: [
      { id: "m1", criterion: "Formula locked and approved by R&D" },
      { id: "m2", criterion: "Minimum 3 pilot batches conducted" },
      { id: "m3", criterion: "Sensory evaluation score >70%" },
      { id: "m4", criterion: "No food safety concerns in pilot batches" }
    ],
    shouldMeetCriteria: [
      { id: "s1", criterion: "Pilot batch yield within 5% of target", weight: 3 },
      { id: "s2", criterion: "Consumer taste test positive (>70%)", weight: 3 },
      { id: "s3", criterion: "Ingredient sourcing confirmed", weight: 2 },
      { id: "s4", criterion: "Cost per kg within budget", weight: 2 },
      { id: "s5", criterion: "Packaging material identified and sourced", weight: 1 }
    ]
  },
  {
    industry: "FOOD_BEVERAGE" as const,
    stage: "VALIDATION" as const,
    deliverables: [
      { id: "d1", label: "Plant Trial Report", type: "DOCUMENT", required: true },
      { id: "d2", label: "Final Product Specification (Released)", type: "SPEC", required: true },
      { id: "d3", label: "Shelf Life Validation Report", type: "DOCUMENT", required: true },
      { id: "d4", label: "Regulatory Dossier / FSSAI Approval", type: "DOCUMENT", required: true },
      { id: "d5", label: "Approved Artwork", type: "DOCUMENT", required: true },
      { id: "d6", label: "SDS / Safety Assessment", type: "DOCUMENT", required: false },
      { id: "d7", label: "Quality Control Plan", type: "DOCUMENT", required: true }
    ],
    mustMeetCriteria: [
      { id: "m1", criterion: "Scale-up to full production successful" },
      { id: "m2", criterion: "Shelf life target achieved and validated" },
      { id: "m3", criterion: "All regulatory approvals in place" },
      { id: "m4", criterion: "Artwork approved and print-ready" },
      { id: "m5", criterion: "Quality control plan signed off" }
    ],
    shouldMeetCriteria: [
      { id: "s1", criterion: "Production yield >95% of target", weight: 3 },
      { id: "s2", criterion: "Waste within acceptable limits", weight: 2 },
      { id: "s3", criterion: "Customer / Trade samples positive feedback", weight: 3 },
      { id: "s4", criterion: "Supply chain fully qualified", weight: 2 }
    ]
  },
  {
    industry: "FOOD_BEVERAGE" as const,
    stage: "LAUNCH" as const,
    deliverables: [
      { id: "d1", label: "SOPs Completed and Approved", type: "DOCUMENT", required: true },
      { id: "d2", label: "Finished Good Item Released in PLM", type: "ITEM", required: true },
      { id: "d3", label: "Formula Released in PLM", type: "FORMULA", required: true },
      { id: "d4", label: "Customer Samples Dispatched", type: "MANUAL", required: false },
      { id: "d5", label: "Commercial Launch Plan", type: "DOCUMENT", required: true },
      { id: "d6", label: "Training Materials for Production", type: "DOCUMENT", required: false }
    ],
    mustMeetCriteria: [
      { id: "m1", criterion: "Item and Formula RELEASED in PLM" },
      { id: "m2", criterion: "Artwork RELEASED in PLM" },
      { id: "m3", criterion: "All mandatory documents uploaded and released" },
      { id: "m4", criterion: "Production is ready for commercial run" }
    ],
    shouldMeetCriteria: [
      { id: "s1", criterion: "OTIF target >98%", weight: 3 },
      { id: "s2", criterion: "Customer orders confirmed", weight: 3 },
      { id: "s3", criterion: "Launch on or ahead of target date", weight: 2 },
      { id: "s4", criterion: "Marketing campaign live", weight: 1 }
    ]
  }
];

async function main() {
  for (const template of templates) {
    await prisma.stageGateTemplate.upsert({
      where: { industry_stage: { industry: template.industry, stage: template.stage } },
      update: {
        deliverables: template.deliverables,
        mustMeetCriteria: template.mustMeetCriteria,
        shouldMeetCriteria: template.shouldMeetCriteria
      },
      create: template
    });
  }
  console.log("Stage gate templates seeded successfully.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
