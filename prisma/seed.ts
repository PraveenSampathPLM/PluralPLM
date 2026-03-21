import {
  PrismaClient,
  Industry,
  ItemType,
  FormulaStatus,
  FGStatus,
  ChangePriority,
  ChangeType,
  LifecycleStatus,
  ChangeStatus
} from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnv = path.resolve(__dirname, "..", ".env");
const backendEnv = path.resolve(__dirname, "..", "packages", "backend", ".env");

dotenv.config({ path: rootEnv });
dotenv.config({ path: backendEnv });


const prisma = new PrismaClient();

async function main() {
  const seedMode = process.env.SEED_MODE ?? "dev";
  const isDemo = seedMode === "demo";

  if (!isDemo) {
    await prisma.auditLog.deleteMany();
    await prisma.workflowInstance.deleteMany();
    await prisma.documentLink.deleteMany();
    await prisma.document.deleteMany();
    await prisma.releaseRequest.deleteMany();
    await prisma.specification.deleteMany();
    await prisma.formulaIngredient.deleteMany();
    await prisma.fGPackagingLine.deleteMany();
    await prisma.fGStructure.deleteMany();
    await prisma.changeRequest.deleteMany();
    await prisma.formula.deleteMany();
    // Artwork cascade deletes components, files, approvals, links automatically
    await prisma.artwork.deleteMany();
    await prisma.item.deleteMany();
    await prisma.containerMembership.deleteMany();
    await prisma.containerRole.deleteMany();
    await prisma.productContainer.deleteMany();
    await prisma.workflowDefinition.deleteMany();
  }

  const [systemAdminRole, plmAdminRole, chemistRole, qaRole, regRole] = await Promise.all([
    prisma.role.upsert({ where: { name: "System Admin" }, update: {}, create: { name: "System Admin" } }),
    prisma.role.upsert({ where: { name: "PLM Admin" }, update: {}, create: { name: "PLM Admin" } }),
    prisma.role.upsert({ where: { name: "Formulation Chemist" }, update: {}, create: { name: "Formulation Chemist" } }),
    prisma.role.upsert({ where: { name: "QA Manager" }, update: {}, create: { name: "QA Manager" } }),
    prisma.role.upsert({ where: { name: "Regulatory Affairs" }, update: {}, create: { name: "Regulatory Affairs" } })
  ]);

  const org = await prisma.organization.upsert({
    where: { id: "org_demo" },
    update: { name: "Tatva Industries" },
    create: { id: "org_demo", name: "Tatva Industries" }
  });

  if (!isDemo) {
    await prisma.plant.deleteMany({ where: { organizationId: org.id } });
  }
  await prisma.plant.createMany({
    data: [
      { name: "Pune Manufacturing Plant", organizationId: org.id },
      { name: "Houston Compounding Plant", organizationId: org.id }
    ],
    skipDuplicates: true
  });

  const passwordHash = await bcrypt.hash("Password@123", 10);
  const users = [
    ["admin@plm.local", "Ava Admin", systemAdminRole.id],
    ["plm@plm.local", "Peter PLM", plmAdminRole.id],
    ["chemist@plm.local", "Chloe Formulation", chemistRole.id],
    ["qa@plm.local", "Quinn QA", qaRole.id],
    ["reg@plm.local", "Riley Regulatory", regRole.id]
  ] as const;

  for (const [email, name, roleId] of users) {
    await prisma.user.upsert({
      where: { email },
      update: { name, roleId, passwordHash, organizationId: org.id },
      create: { email, name, roleId, passwordHash, organizationId: org.id }
    });
  }

  await prisma.numberSequence.upsert({ where: { entity: "ITEM" }, update: { prefix: "PLY-RM-", padding: 4 }, create: { entity: "ITEM", prefix: "PLY-RM-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "ITEM_FINISHED_GOOD" }, update: { prefix: "PLY-FG-", padding: 4 }, create: { entity: "ITEM_FINISHED_GOOD", prefix: "PLY-FG-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "ITEM_PACKAGING" }, update: { prefix: "PLY-PKG-", padding: 4 }, create: { entity: "ITEM_PACKAGING", prefix: "PLY-PKG-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "FORMULA" }, update: { prefix: "PLY-FML-", padding: 4 }, create: { entity: "FORMULA", prefix: "PLY-FML-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "BOM" }, update: { prefix: "PLY-BOM-", padding: 4 }, create: { entity: "BOM", prefix: "PLY-BOM-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "CHANGE_REQUEST" }, update: { prefix: "PLY-CR-", padding: 4 }, create: { entity: "CHANGE_REQUEST", prefix: "PLY-CR-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "DOCUMENT" }, update: { prefix: "PLY-DOC-", padding: 4 }, create: { entity: "DOCUMENT", prefix: "PLY-DOC-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "ARTWORK" }, update: { prefix: "PLY-ART-", padding: 4 }, create: { entity: "ARTWORK", prefix: "PLY-ART-", padding: 4, next: 1 } });

  const plmAdmin = await prisma.user.findUniqueOrThrow({ where: { email: "plm@plm.local" } });
  const polymerContainer = await prisma.productContainer.upsert({
    where: { code: "POLY-CORE" },
    update: {
      name: "Polymer Core Portfolio",
      description: "Engineering and commodity polymer portfolio",
      industry: Industry.POLYMER,
      ownerId: plmAdmin.id,
      status: "ACTIVE"
    },
    create: {
      code: "POLY-CORE",
      name: "Polymer Core Portfolio",
      description: "Engineering and commodity polymer portfolio",
      industry: Industry.POLYMER,
      ownerId: plmAdmin.id,
      status: "ACTIVE"
    }
  });

  const containerAdminRole = await prisma.containerRole.upsert({
    where: { containerId_name: { containerId: polymerContainer.id, name: "Container Admin" } },
    update: {
      description: "Full administration for polymer container",
      permissions: [
        "CONTAINER_ADMIN",
        "ITEM_READ",
        "ITEM_WRITE",
        "FORMULA_READ",
        "FORMULA_WRITE",
        "BOM_READ",
        "BOM_WRITE",
        "CHANGE_READ",
        "CHANGE_WRITE",
        "RELEASE_READ",
        "RELEASE_WRITE",
        "SPEC_READ",
        "SPEC_WRITE"
      ]
    },
    create: {
      containerId: polymerContainer.id,
      name: "Container Admin",
      description: "Full administration for polymer container",
      permissions: [
        "CONTAINER_ADMIN",
        "ITEM_READ",
        "ITEM_WRITE",
        "FORMULA_READ",
        "FORMULA_WRITE",
        "BOM_READ",
        "BOM_WRITE",
        "CHANGE_READ",
        "CHANGE_WRITE",
        "RELEASE_READ",
        "RELEASE_WRITE",
        "SPEC_READ",
        "SPEC_WRITE"
      ]
    }
  });

  const rawItems = [
    ["PLY-RM-0001", "HDPE Resin Grade H5502"],
    ["PLY-RM-0002", "LLDPE Resin Grade C4"],
    ["PLY-RM-0003", "PP Homo Polymer MFI 12"],
    ["PLY-RM-0004", "EVA Copolymer 18% VA"],
    ["PLY-RM-0005", "Calcium Carbonate Masterbatch"],
    ["PLY-RM-0006", "Titanium Dioxide Rutile"],
    ["PLY-RM-0007", "UV Stabilizer HALS"],
    ["PLY-RM-0008", "Antioxidant AO-1010"],
    ["PLY-RM-0009", "Slip Additive Erucamide"],
    ["PLY-RM-0010", "Anti-block Silica"],
    ["PLY-RM-0011", "Processing Aid Fluoropolymer"],
    ["PLY-RM-0012", "Color Masterbatch Blue"],
    ["PLY-RM-0013", "Nucleating Agent"],
    ["PLY-RM-0014", "Impact Modifier POE"],
    ["PLY-RM-0015", "Talc Filler 5 Micron"],
    ["PLY-FG-0001", "PP Injection Grade Final Pellet"],
    ["PLY-FG-0002", "HDPE Film Grade Final Pellet"],
    ["PLY-PKG-0001", "25kg Woven Bag"],
    ["PLY-PKG-0002", "Liner LDPE Bag"],
    ["PLY-PKG-0003", "Pallet Stretch Film"]
  ] as const;

  for (const [itemCode, name] of rawItems) {
    const type = itemCode.includes("PLY-FG")
      ? ItemType.FINISHED_GOOD
      : itemCode.includes("PLY-PKG")
        ? ItemType.PACKAGING
        : ItemType.RAW_MATERIAL;

    await prisma.item.upsert({
      where: {
        itemCode_revisionMajor_revisionIteration: { itemCode, revisionMajor: 1, revisionIteration: 1 }
      },
      update: {
        name,
        industryType: Industry.POLYMER,
        itemType: type,
        uom: type === ItemType.PACKAGING ? "ea" : "kg",
        status: LifecycleStatus.RELEASED,
        containerId: polymerContainer.id,
        regulatoryFlags: { REACH: true }
      },
      create: {
        itemCode,
        name,
        industryType: Industry.POLYMER,
        itemType: type,
        uom: type === ItemType.PACKAGING ? "ea" : "kg",
        status: LifecycleStatus.RELEASED,
        containerId: polymerContainer.id,
        regulatoryFlags: { REACH: true }
      }
    });
  }

  const rawMaterialItems = await prisma.item.findMany({
    where: { containerId: polymerContainer.id, itemType: ItemType.RAW_MATERIAL }
  });
  for (const item of rawMaterialItems) {
    if (isDemo) {
      const existingSpecs = await prisma.specification.count({ where: { itemId: item.id } });
      if (existingSpecs > 0) {
        continue;
      }
    }
    await prisma.specification.createMany({
      data: [
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "PHYSICAL",
          attribute: "Melt Flow Index",
          minValue: 8,
          maxValue: 14,
          uom: "g/10min",
          testMethod: "ASTM D1238"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "PHYSICAL",
          attribute: "Density",
          minValue: 0.9,
          maxValue: 0.97,
          uom: "g/cm3",
          testMethod: "ASTM D1505"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "PHYSICAL",
          attribute: "Particle Size",
          maxValue: 500,
          uom: "micron",
          testMethod: "ISO 13320"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "CHEMICAL",
          attribute: "Moisture",
          maxValue: 0.1,
          uom: "%",
          testMethod: "ASTM E203"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "CHEMICAL",
          attribute: "Ash Content",
          maxValue: 0.05,
          uom: "%",
          testMethod: "ASTM D5630"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "CHEMICAL",
          attribute: "Volatiles",
          maxValue: 0.2,
          uom: "%",
          testMethod: "ASTM D6980"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "APPEARANCE",
          attribute: "Color (Pellets)",
          value: "Natural/Off-White",
          testMethod: "Visual"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "APPEARANCE",
          attribute: "Odor",
          value: "Odorless",
          testMethod: "Sensory"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "SAFETY",
          attribute: "Flash Point",
          minValue: 300,
          uom: "C",
          testMethod: "ASTM D92"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "SAFETY",
          attribute: "Auto-Ignition Temperature",
          minValue: 350,
          uom: "C",
          testMethod: "ASTM E659"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "SAFETY",
          attribute: "GHS Classification",
          value: "Not classified",
          testMethod: "GHS"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "PERFORMANCE",
          attribute: "Tensile Strength",
          minValue: 25,
          uom: "MPa",
          testMethod: "ASTM D638"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "PERFORMANCE",
          attribute: "Elongation at Break",
          minValue: 400,
          uom: "%",
          testMethod: "ASTM D638"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "REGULATORY",
          attribute: "REACH",
          value: "Compliant",
          testMethod: "REACH"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "REGULATORY",
          attribute: "RoHS",
          value: "Compliant",
          testMethod: "RoHS"
        },
        {
          itemId: item.id,
          containerId: polymerContainer.id,
          specType: "PACKAGING",
          attribute: "Standard Packaging",
          value: "25 kg bag",
          testMethod: "Packaging Spec"
        }
      ],
      skipDuplicates: true
    });
  }

  const chemist = await prisma.user.findUniqueOrThrow({ where: { email: "chemist@plm.local" } });
  const ingredients = await prisma.item.findMany({
    where: { containerId: polymerContainer.id, itemType: { in: [ItemType.RAW_MATERIAL, ItemType.INTERMEDIATE] } },
    orderBy: { itemCode: "asc" },
    take: 12
  });

  const formulaDefs = [
    ["PLY-FML-0001", "PP Injection Molding Compound", FormulaStatus.RELEASED],
    ["PLY-FML-0002", "HDPE Film Compound", FormulaStatus.RELEASED],
    ["PLY-FML-0003", "LLDPE Stretch Film Compound", FormulaStatus.IN_WORK],
    ["PLY-FML-0004", "Impact Modified PP Compound", FormulaStatus.UNDER_REVIEW],
    ["PLY-FML-0005", "UV Stabilized Outdoor Grade", FormulaStatus.RELEASED]
  ] as const;

  for (let idx = 0; idx < formulaDefs.length; idx += 1) {
    const [formulaCode, name, status] = formulaDefs[idx];
    const formula = await prisma.formula.upsert({
      where: { formulaCode_version: { formulaCode, version: 1 } },
      update: {
        name,
        industryType: Industry.POLYMER,
        containerId: polymerContainer.id,
        status,
        ownerId: chemist.id,
        targetYield: 1000,
        yieldUom: "kg",
        batchSize: 1000,
        batchUom: "kg"
      },
      create: {
        formulaCode,
        version: 1,
        name,
        industryType: Industry.POLYMER,
        containerId: polymerContainer.id,
        status,
        ownerId: chemist.id,
        targetYield: 1000,
        yieldUom: "kg",
        batchSize: 1000,
        batchUom: "kg"
      }
    });

    if (!isDemo || (await prisma.formulaIngredient.count({ where: { formulaId: formula.id } })) === 0) {
      for (let i = 0; i < 4; i += 1) {
        const item = ingredients[(idx + i) % ingredients.length];
        if (!item) continue;
        await prisma.formulaIngredient.create({
          data: {
            formulaId: formula.id,
            itemId: item.id,
            quantity: i === 0 ? 700 : i === 1 ? 200 : i === 2 ? 70 : 30,
            uom: "kg",
            percentage: i === 0 ? 70 : i === 1 ? 20 : i === 2 ? 7 : 3,
            additionSequence: i + 1
          }
        });
      }
    }

    if (!isDemo || (await prisma.specification.count({ where: { formulaId: formula.id } })) === 0) {
      await prisma.specification.createMany({
      data: [
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "PHYSICAL",
          attribute: "Melt Flow Index",
          minValue: 6,
          maxValue: 12,
          uom: "g/10min",
          testMethod: "ASTM D1238"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "PHYSICAL",
          attribute: "Density",
          minValue: 0.9,
          maxValue: 0.97,
          uom: "g/cm3",
          testMethod: "ASTM D1505"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "CHEMICAL",
          attribute: "Moisture",
          maxValue: 0.05,
          uom: "%",
          testMethod: "ASTM E203"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "APPEARANCE",
          attribute: "Pellet Color",
          value: "Natural/Off-White",
          testMethod: "Visual"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "SAFETY",
          attribute: "Flash Point",
          minValue: 300,
          uom: "C",
          testMethod: "ASTM D92"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "SAFETY",
          attribute: "GHS Classification",
          value: "Not classified",
          testMethod: "GHS"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "PERFORMANCE",
          attribute: "Tensile Strength",
          minValue: 25,
          uom: "MPa",
          testMethod: "ASTM D638"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "PERFORMANCE",
          attribute: "Elongation at Break",
          minValue: 300,
          uom: "%",
          testMethod: "ASTM D638"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "REGULATORY",
          attribute: "REACH",
          value: "Compliant",
          testMethod: "REACH"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "REGULATORY",
          attribute: "RoHS",
          value: "Compliant",
          testMethod: "RoHS"
        },
        {
          formulaId: formula.id,
          containerId: polymerContainer.id,
          specType: "PACKAGING",
          attribute: "Handling",
          value: "Use clean, dry packaging",
          testMethod: "Packaging Spec"
        }
      ],
      skipDuplicates: true
      });
    }
  }

  // Add one intermediate formula that uses another formula as input (multi-level)
  const baseFormula = await prisma.formula.findUnique({ where: { formulaCode_version: { formulaCode: "PLY-FML-0001", version: 1 } } });
  if (baseFormula) {
    const intermediate = await prisma.formula.upsert({
      where: { formulaCode_version: { formulaCode: "PLY-FML-0100", version: 1 } },
      update: {
        name: "PP Master Intermediate",
        industryType: Industry.POLYMER,
        containerId: polymerContainer.id,
        status: FormulaStatus.IN_WORK,
        ownerId: chemist.id,
        targetYield: 500,
        yieldUom: "kg",
        batchSize: 500,
        batchUom: "kg"
      },
      create: {
        formulaCode: "PLY-FML-0100",
        version: 1,
        name: "PP Master Intermediate",
        industryType: Industry.POLYMER,
        containerId: polymerContainer.id,
        status: FormulaStatus.IN_WORK,
        ownerId: chemist.id,
        targetYield: 500,
        yieldUom: "kg",
        batchSize: 500,
        batchUom: "kg"
      }
    });
    if (!isDemo || (await prisma.formulaIngredient.count({ where: { formulaId: intermediate.id } })) === 0) {
      await prisma.formulaIngredient.create({
        data: {
          formulaId: intermediate.id,
          inputFormulaId: baseFormula.id,
          quantity: 500,
          uom: "kg",
          percentage: 100,
          additionSequence: 1
        }
      });
    }
  }

  // FG Structure: link Finished Good item → base formula + packaging
  const finishedGood = await prisma.item.findFirst({
    where: { itemCode: "PLY-FG-0001", revisionMajor: 1, revisionIteration: 1 }
  });
  const packagingItems = await prisma.item.findMany({ where: { itemType: ItemType.PACKAGING, containerId: polymerContainer.id } });

  if (finishedGood && baseFormula) {
    const existingFgStructure = await prisma.fGStructure.findUnique({
      where: { fgItemId_version: { fgItemId: finishedGood.id, version: 1 } }
    });
    if (!existingFgStructure) {
      const fgStructure = await prisma.fGStructure.create({
        data: {
          fgItemId: finishedGood.id,
          formulaId: baseFormula.id,
          version: 1,
          revisionMajor: 1,
          revisionIteration: 1,
          revisionLabel: "1.1",
          status: FGStatus.RELEASED,
          containerId: polymerContainer.id
        }
      });
      if (packagingItems.length > 0) {
        await prisma.fGPackagingLine.createMany({
          data: packagingItems.slice(0, 2).map((pkg, idx) => ({
            fgStructureId: fgStructure.id,
            itemId: pkg.id,
            lineNumber: (idx + 1) * 10,
            quantity: idx === 0 ? 1 : 1,
            uom: pkg.uom ?? "ea"
          }))
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOD & BEVERAGE CORE — 3 SKUs with 100% Digital Thread
  // ═══════════════════════════════════════════════════════════════════════════

  const foodContainer = await prisma.productContainer.upsert({
    where: { code: "FOOD-CORE" },
    update: {
      name: "Food & Beverage Portfolio",
      description: "Food and beverage formulations and packaging",
      industry: Industry.FOOD_BEVERAGE,
      ownerId: plmAdmin.id,
      status: "ACTIVE"
    },
    create: {
      code: "FOOD-CORE",
      name: "Food & Beverage Portfolio",
      description: "Food and beverage formulations and packaging",
      industry: Industry.FOOD_BEVERAGE,
      ownerId: plmAdmin.id,
      status: "ACTIVE"
    }
  });

  const foodAdminRole = await prisma.containerRole.upsert({
    where: { containerId_name: { containerId: foodContainer.id, name: "Food Container Admin" } },
    update: {
      description: "Full administration for food container",
      permissions: [
        "CONTAINER_ADMIN", "ITEM_READ", "ITEM_WRITE", "FORMULA_READ", "FORMULA_WRITE",
        "BOM_READ", "BOM_WRITE", "CHANGE_READ", "CHANGE_WRITE",
        "RELEASE_READ", "RELEASE_WRITE", "SPEC_READ", "SPEC_WRITE"
      ]
    },
    create: {
      containerId: foodContainer.id,
      name: "Food Container Admin",
      description: "Full administration for food container",
      permissions: [
        "CONTAINER_ADMIN", "ITEM_READ", "ITEM_WRITE", "FORMULA_READ", "FORMULA_WRITE",
        "BOM_READ", "BOM_WRITE", "CHANGE_READ", "CHANGE_WRITE",
        "RELEASE_READ", "RELEASE_WRITE", "SPEC_READ", "SPEC_WRITE"
      ]
    }
  });

  // ─── Raw Materials & Finished Goods & Packaging (explicit per-item upserts) ─

  // ── SWEETS RAW MATERIALS ──────────────────────────────────────────────────

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0001", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Cocoa Butter Premium",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Food-grade deodorised cocoa butter, EU origin. Used as primary fat base and release agent in confectionery.",
      density: 0.97,
      viscosity: 15,
      pH: null,
      flashPoint: 195,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "8002-31-1", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Cocoa Butter Deodorised Food Grade", supplier: "Cargill Cocoa & Chocolate", reach: false, vocContent: 0, viscosity: 15, density: 0.97 } }
    },
    create: {
      itemCode: "FNB-RM-0001",
      name: "Cocoa Butter Premium",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Food-grade deodorised cocoa butter, EU origin. Used as primary fat base and release agent in confectionery.",
      density: 0.97,
      viscosity: 15,
      pH: null,
      flashPoint: 195,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "8002-31-1", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Cocoa Butter Deodorised Food Grade", supplier: "Cargill Cocoa & Chocolate", reach: false, vocContent: 0, viscosity: 15, density: 0.97 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0002", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Dark Chocolate Couverture 72%",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Dark couverture chocolate 72% cocoa solids. Tempered blocks. Contains: soy lecithin, may contain milk traces.",
      density: 1.28,
      viscosity: 25,
      pH: 6.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, FDA: true },
      attributes: { casNumber: "N/A – mixture", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Couverture Grade 72% Cocoa Solids", supplier: "Barry Callebaut", reach: false, vocContent: 0, viscosity: 25, density: 1.28 } }
    },
    create: {
      itemCode: "FNB-RM-0002",
      name: "Dark Chocolate Couverture 72%",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Dark couverture chocolate 72% cocoa solids. Tempered blocks. Contains: soy lecithin, may contain milk traces.",
      density: 1.28,
      viscosity: 25,
      pH: 6.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, FDA: true },
      attributes: { casNumber: "N/A – mixture", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Couverture Grade 72% Cocoa Solids", supplier: "Barry Callebaut", reach: false, vocContent: 0, viscosity: 25, density: 1.28 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0003", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Cane Sugar Refined",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Refined white cane sugar ICUMSA 45. Primary sweetener for confectionery and beverage applications.",
      density: 1.59,
      viscosity: null,
      pH: 7.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "57-50-1", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Refined White Sugar ICUMSA 45", supplier: "EID Parry (India) Ltd", reach: false, vocContent: 0, viscosity: null, density: 1.59 } }
    },
    create: {
      itemCode: "FNB-RM-0003",
      name: "Cane Sugar Refined",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Refined white cane sugar ICUMSA 45. Primary sweetener for confectionery and beverage applications.",
      density: 1.59,
      viscosity: null,
      pH: 7.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "57-50-1", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Refined White Sugar ICUMSA 45", supplier: "EID Parry (India) Ltd", reach: false, vocContent: 0, viscosity: null, density: 1.59 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0004", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Glucose Syrup DE 42",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Liquid glucose syrup DE 42. Provides softness, controls crystallisation, extends shelf life in confections.",
      density: 1.41,
      viscosity: 5000,
      pH: 4.8,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "8029-43-4", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Glucose Syrup DE42 Food Grade", supplier: "Roquette Frères", reach: false, vocContent: 0, viscosity: 5000, density: 1.41 } }
    },
    create: {
      itemCode: "FNB-RM-0004",
      name: "Glucose Syrup DE 42",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Liquid glucose syrup DE 42. Provides softness, controls crystallisation, extends shelf life in confections.",
      density: 1.41,
      viscosity: 5000,
      pH: 4.8,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "8029-43-4", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Glucose Syrup DE42 Food Grade", supplier: "Roquette Frères", reach: false, vocContent: 0, viscosity: 5000, density: 1.41 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0005", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Condensed Full-Cream Milk",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Sweetened condensed full-cream milk (FCMP). Allergen: Milk. Adds creaminess and sweetness.",
      density: 1.30,
      viscosity: 2000,
      pH: 6.3,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, FDA: true },
      attributes: { casNumber: "N/A – dairy product", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Sweetened Condensed Milk FSSAI Compliant", supplier: "Amul (GCMMF)", reach: false, vocContent: 0, viscosity: 2000, density: 1.30 } }
    },
    create: {
      itemCode: "FNB-RM-0005",
      name: "Condensed Full-Cream Milk",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Sweetened condensed full-cream milk (FCMP). Allergen: Milk. Adds creaminess and sweetness.",
      density: 1.30,
      viscosity: 2000,
      pH: 6.3,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, FDA: true },
      attributes: { casNumber: "N/A – dairy product", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Sweetened Condensed Milk FSSAI Compliant", supplier: "Amul (GCMMF)", reach: false, vocContent: 0, viscosity: 2000, density: 1.30 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0006", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Dutch-Process Cocoa Powder",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Dutch-process alkalized cocoa powder 10–12% fat. Dark colour, mild flavour. Used for colour and chocolate taste.",
      density: 0.55,
      viscosity: null,
      pH: 7.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "8002-31-1", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "10–12% Fat Cocoa Powder Dutched", supplier: "Olam Cocoa", reach: false, vocContent: 0, viscosity: null, density: 0.55 } }
    },
    create: {
      itemCode: "FNB-RM-0006",
      name: "Dutch-Process Cocoa Powder",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Dutch-process alkalized cocoa powder 10–12% fat. Dark colour, mild flavour. Used for colour and chocolate taste.",
      density: 0.55,
      viscosity: null,
      pH: 7.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "8002-31-1", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "10–12% Fat Cocoa Powder Dutched", supplier: "Olam Cocoa", reach: false, vocContent: 0, viscosity: null, density: 0.55 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0007", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Natural Vanilla Extract",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Natural vanilla extract 2-fold, alcohol-based. Certified natural flavouring. Used at low dosage.",
      density: 1.04,
      viscosity: null,
      pH: 4.5,
      flashPoint: 50,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "8024-06-4", reachRegistration: "Not applicable – food flavouring", ghsClassification: "Flammable liquid Cat. 3", boilingPoint: 78, customAttributes: { grade: "Natural Vanilla Extract 2X Food Grade", supplier: "McCormick Ingredients", reach: false, vocContent: 0, viscosity: null, density: 1.04 } }
    },
    create: {
      itemCode: "FNB-RM-0007",
      name: "Natural Vanilla Extract",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Natural vanilla extract 2-fold, alcohol-based. Certified natural flavouring. Used at low dosage.",
      density: 1.04,
      viscosity: null,
      pH: 4.5,
      flashPoint: 50,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "8024-06-4", reachRegistration: "Not applicable – food flavouring", ghsClassification: "Flammable liquid Cat. 3", boilingPoint: 78, customAttributes: { grade: "Natural Vanilla Extract 2X Food Grade", supplier: "McCormick Ingredients", reach: false, vocContent: 0, viscosity: null, density: 1.04 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0008", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Sunflower Lecithin",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Non-GMO sunflower lecithin (fluid). Emulsifier, allergen-free alternative to soy lecithin.",
      density: 1.03,
      viscosity: 10000,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, NonGMO: true, FDA: true },
      attributes: { casNumber: "8002-43-5", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Sunflower Lecithin Fluid Non-GMO IP", supplier: "American Lecithin Company", reach: false, vocContent: 0, viscosity: 10000, density: 1.03 } }
    },
    create: {
      itemCode: "FNB-RM-0008",
      name: "Sunflower Lecithin",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Non-GMO sunflower lecithin (fluid). Emulsifier, allergen-free alternative to soy lecithin.",
      density: 1.03,
      viscosity: 10000,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, NonGMO: true, FDA: true },
      attributes: { casNumber: "8002-43-5", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Sunflower Lecithin Fluid Non-GMO IP", supplier: "American Lecithin Company", reach: false, vocContent: 0, viscosity: 10000, density: 1.03 } }
    }
  });

  // ── SAVORY RAW MATERIALS ──────────────────────────────────────────────────

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0009", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Potato Flakes Dehydrated",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Instant dehydrated potato flakes, low moisture <7%. Free-flowing powder. Primary base ingredient for crisps.",
      density: 0.45,
      viscosity: null,
      pH: 6.2,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, GlutenFree: true, FDA: true },
      attributes: { casNumber: "9005-25-8", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Potato Flakes Grade A Dehydrated", supplier: "Emsland Group", reach: false, vocContent: 0, viscosity: null, density: 0.45 } }
    },
    create: {
      itemCode: "FNB-RM-0009",
      name: "Potato Flakes Dehydrated",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Instant dehydrated potato flakes, low moisture <7%. Free-flowing powder. Primary base ingredient for crisps.",
      density: 0.45,
      viscosity: null,
      pH: 6.2,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, GlutenFree: true, FDA: true },
      attributes: { casNumber: "9005-25-8", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Potato Flakes Grade A Dehydrated", supplier: "Emsland Group", reach: false, vocContent: 0, viscosity: null, density: 0.45 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0010", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "High-Oleic Sunflower Oil",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "High-oleic sunflower oil, refined bleached deodorised (RBD). >80% oleic acid, stable at high temperatures.",
      density: 0.91,
      viscosity: 55,
      pH: null,
      flashPoint: 225,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, NonGMO: true, FDA: true },
      attributes: { casNumber: "8001-21-6", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: 300, customAttributes: { grade: "High-Oleic Sunflower Oil RBD Food Grade", supplier: "Cargill India Pvt Ltd", reach: false, vocContent: 0, viscosity: 55, density: 0.91 } }
    },
    create: {
      itemCode: "FNB-RM-0010",
      name: "High-Oleic Sunflower Oil",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "High-oleic sunflower oil, refined bleached deodorised (RBD). >80% oleic acid, stable at high temperatures.",
      density: 0.91,
      viscosity: 55,
      pH: null,
      flashPoint: 225,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, NonGMO: true, FDA: true },
      attributes: { casNumber: "8001-21-6", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: 300, customAttributes: { grade: "High-Oleic Sunflower Oil RBD Food Grade", supplier: "Cargill India Pvt Ltd", reach: false, vocContent: 0, viscosity: 55, density: 0.91 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0011", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Malt Vinegar Powder",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Spray-dried malt vinegar powder, maltodextrin-carried. Delivers authentic vinegar tang in dry seasoning blends.",
      density: 0.65,
      viscosity: null,
      pH: 3.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, FDA: true },
      attributes: { casNumber: "N/A – spray-dried blend", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Malt Vinegar Powder Food Grade 40% Acidity", supplier: "Enaltus LLC", reach: false, vocContent: 0, viscosity: null, density: 0.65 } }
    },
    create: {
      itemCode: "FNB-RM-0011",
      name: "Malt Vinegar Powder",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Spray-dried malt vinegar powder, maltodextrin-carried. Delivers authentic vinegar tang in dry seasoning blends.",
      density: 0.65,
      viscosity: null,
      pH: 3.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, FDA: true },
      attributes: { casNumber: "N/A – spray-dried blend", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Malt Vinegar Powder Food Grade 40% Acidity", supplier: "Enaltus LLC", reach: false, vocContent: 0, viscosity: null, density: 0.65 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0012", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Sea Salt Fine",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Fine-grade solar-evaporated sea salt. No anti-caking agents. Natural mineral profile.",
      density: 2.16,
      viscosity: null,
      pH: 7.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "7647-14-5", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: 1413, customAttributes: { grade: "Fine Sea Salt Food Grade ISO 9001", supplier: "Akzo Nobel Salt B.V.", reach: false, vocContent: 0, viscosity: null, density: 2.16 } }
    },
    create: {
      itemCode: "FNB-RM-0012",
      name: "Sea Salt Fine",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Fine-grade solar-evaporated sea salt. No anti-caking agents. Natural mineral profile.",
      density: 2.16,
      viscosity: null,
      pH: 7.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "7647-14-5", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: 1413, customAttributes: { grade: "Fine Sea Salt Food Grade ISO 9001", supplier: "Akzo Nobel Salt B.V.", reach: false, vocContent: 0, viscosity: null, density: 2.16 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0013", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Sodium Diacetate E262",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Sodium diacetate (E262), food-grade granular. Preservative and flavour agent, acetic acid character.",
      density: 1.45,
      viscosity: null,
      pH: 4.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "126-96-5", reachRegistration: "Not applicable – food additive", ghsClassification: "Not classified", boilingPoint: 118, customAttributes: { grade: "Sodium Diacetate FCC Grade E262", supplier: "Niacet Corporation", reach: false, vocContent: 0, viscosity: null, density: 1.45 } }
    },
    create: {
      itemCode: "FNB-RM-0013",
      name: "Sodium Diacetate E262",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Sodium diacetate (E262), food-grade granular. Preservative and flavour agent, acetic acid character.",
      density: 1.45,
      viscosity: null,
      pH: 4.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "126-96-5", reachRegistration: "Not applicable – food additive", ghsClassification: "Not classified", boilingPoint: 118, customAttributes: { grade: "Sodium Diacetate FCC Grade E262", supplier: "Niacet Corporation", reach: false, vocContent: 0, viscosity: null, density: 1.45 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0014", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Citric Acid Anhydrous",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Anhydrous citric acid, food/pharma grade. Acidulant and flavour enhancer. Highly soluble, free-flowing.",
      density: 1.67,
      viscosity: null,
      pH: 2.2,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "77-92-9", reachRegistration: "Not applicable – food additive", ghsClassification: "Eye irritant Cat. 2", boilingPoint: 310, customAttributes: { grade: "Citric Acid Anhydrous BP/FCC Food Grade", supplier: "Jungbunzlauer AG", reach: false, vocContent: 0, viscosity: null, density: 1.67 } }
    },
    create: {
      itemCode: "FNB-RM-0014",
      name: "Citric Acid Anhydrous",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Anhydrous citric acid, food/pharma grade. Acidulant and flavour enhancer. Highly soluble, free-flowing.",
      density: 1.67,
      viscosity: null,
      pH: 2.2,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "77-92-9", reachRegistration: "Not applicable – food additive", ghsClassification: "Eye irritant Cat. 2", boilingPoint: 310, customAttributes: { grade: "Citric Acid Anhydrous BP/FCC Food Grade", supplier: "Jungbunzlauer AG", reach: false, vocContent: 0, viscosity: null, density: 1.67 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0015", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Onion Powder",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Spray-dried onion powder, free-flowing. Enhances savory depth in seasoning blends.",
      density: 0.55,
      viscosity: null,
      pH: 5.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, GlutenFree: true, FDA: true },
      attributes: { casNumber: "8002-72-0", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Dehydrated Onion Powder Grade 1 ASTA 100+", supplier: "LT Foods Ltd", reach: false, vocContent: 0, viscosity: null, density: 0.55 } }
    },
    create: {
      itemCode: "FNB-RM-0015",
      name: "Onion Powder",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Spray-dried onion powder, free-flowing. Enhances savory depth in seasoning blends.",
      density: 0.55,
      viscosity: null,
      pH: 5.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, GlutenFree: true, FDA: true },
      attributes: { casNumber: "8002-72-0", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Dehydrated Onion Powder Grade 1 ASTA 100+", supplier: "LT Foods Ltd", reach: false, vocContent: 0, viscosity: null, density: 0.55 } }
    }
  });

  // ── BEVERAGE RAW MATERIALS ────────────────────────────────────────────────

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0016", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Mango Puree Aseptic Alphonso",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Aseptic Alphonso mango puree 14–15 Brix. Single-origin Maharashtra. No added sugar or preservatives.",
      density: 1.05,
      viscosity: 3000,
      pH: 3.8,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, GlutenFree: true, FDA: true },
      attributes: { casNumber: "N/A – natural fruit puree", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Alphonso Mango Puree Aseptic 14 Brix", supplier: "Jain Agri Fresh Ltd", reach: false, vocContent: 0, viscosity: 3000, density: 1.05 } }
    },
    create: {
      itemCode: "FNB-RM-0016",
      name: "Mango Puree Aseptic Alphonso",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Aseptic Alphonso mango puree 14–15 Brix. Single-origin Maharashtra. No added sugar or preservatives.",
      density: 1.05,
      viscosity: 3000,
      pH: 3.8,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, GlutenFree: true, FDA: true },
      attributes: { casNumber: "N/A – natural fruit puree", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Alphonso Mango Puree Aseptic 14 Brix", supplier: "Jain Agri Fresh Ltd", reach: false, vocContent: 0, viscosity: 3000, density: 1.05 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0017", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Passion Fruit Juice Concentrate 50 Brix",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Passion fruit (yellow variety) juice concentrate, 50 Brix, aseptic. High natural aroma and acidity.",
      density: 1.23,
      viscosity: 500,
      pH: 3.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, GlutenFree: true, FDA: true },
      attributes: { casNumber: "N/A – natural fruit concentrate", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Passion Fruit Concentrate 50 Brix Aseptic", supplier: "AGRANA Fruit Austria GmbH", reach: false, vocContent: 0, viscosity: 500, density: 1.23 } }
    },
    create: {
      itemCode: "FNB-RM-0017",
      name: "Passion Fruit Juice Concentrate 50 Brix",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Passion fruit (yellow variety) juice concentrate, 50 Brix, aseptic. High natural aroma and acidity.",
      density: 1.23,
      viscosity: 500,
      pH: 3.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, GlutenFree: true, FDA: true },
      attributes: { casNumber: "N/A – natural fruit concentrate", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Passion Fruit Concentrate 50 Brix Aseptic", supplier: "AGRANA Fruit Austria GmbH", reach: false, vocContent: 0, viscosity: 500, density: 1.23 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0018", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Cane Sugar Refined (Nectar)",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Refined white cane sugar ICUMSA 45. Sweetener for beverages. Same specification as FNB-RM-0003.",
      density: 1.59,
      viscosity: null,
      pH: 7.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "57-50-1", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Refined White Sugar ICUMSA 45", supplier: "EID Parry (India) Ltd", reach: false, vocContent: 0, viscosity: null, density: 1.59 } }
    },
    create: {
      itemCode: "FNB-RM-0018",
      name: "Cane Sugar Refined (Nectar)",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Refined white cane sugar ICUMSA 45. Sweetener for beverages. Same specification as FNB-RM-0003.",
      density: 1.59,
      viscosity: null,
      pH: 7.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "57-50-1", reachRegistration: "Not applicable – food ingredient", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Refined White Sugar ICUMSA 45", supplier: "EID Parry (India) Ltd", reach: false, vocContent: 0, viscosity: null, density: 1.59 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0019", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Citric Acid Anhydrous (Nectar)",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Food-grade anhydrous citric acid for beverage pH adjustment and flavour balance.",
      density: 1.67,
      viscosity: null,
      pH: 2.2,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "77-92-9", reachRegistration: "Not applicable – food additive", ghsClassification: "Eye irritant Cat. 2", boilingPoint: 310, customAttributes: { grade: "Citric Acid Anhydrous FCC Grade Beverage", supplier: "Jungbunzlauer AG", reach: false, vocContent: 0, viscosity: null, density: 1.67 } }
    },
    create: {
      itemCode: "FNB-RM-0019",
      name: "Citric Acid Anhydrous (Nectar)",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Food-grade anhydrous citric acid for beverage pH adjustment and flavour balance.",
      density: 1.67,
      viscosity: null,
      pH: 2.2,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "77-92-9", reachRegistration: "Not applicable – food additive", ghsClassification: "Eye irritant Cat. 2", boilingPoint: 310, customAttributes: { grade: "Citric Acid Anhydrous FCC Grade Beverage", supplier: "Jungbunzlauer AG", reach: false, vocContent: 0, viscosity: null, density: 1.67 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0020", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Ascorbic Acid (Vitamin C)",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "L-Ascorbic acid, USP/FCC grade. Antioxidant and Vitamin C nutrient enrichment for beverages.",
      density: 1.65,
      viscosity: null,
      pH: 3.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "50-81-7", reachRegistration: "Not applicable – food additive", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Ascorbic Acid USP/FCC Grade", supplier: "DSM Nutritional Products", reach: false, vocContent: 0, viscosity: null, density: 1.65 } }
    },
    create: {
      itemCode: "FNB-RM-0020",
      name: "Ascorbic Acid (Vitamin C)",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "L-Ascorbic acid, USP/FCC grade. Antioxidant and Vitamin C nutrient enrichment for beverages.",
      density: 1.65,
      viscosity: null,
      pH: 3.0,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, Vegan: true, FDA: true },
      attributes: { casNumber: "50-81-7", reachRegistration: "Not applicable – food additive", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Ascorbic Acid USP/FCC Grade", supplier: "DSM Nutritional Products", reach: false, vocContent: 0, viscosity: null, density: 1.65 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0021", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Potassium Sorbate E202",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Potassium sorbate granular (E202), food preservative. Controls yeast and mould growth in beverages.",
      density: 1.36,
      viscosity: null,
      pH: 7.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "24634-61-5", reachRegistration: "Not applicable – food additive", ghsClassification: "Not classified", boilingPoint: 270, customAttributes: { grade: "Potassium Sorbate FCC Grade E202", supplier: "Celanese GmbH", reach: false, vocContent: 0, viscosity: null, density: 1.36 } }
    },
    create: {
      itemCode: "FNB-RM-0021",
      name: "Potassium Sorbate E202",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Potassium sorbate granular (E202), food preservative. Controls yeast and mould growth in beverages.",
      density: 1.36,
      viscosity: null,
      pH: 7.5,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true, FDA: true },
      attributes: { casNumber: "24634-61-5", reachRegistration: "Not applicable – food additive", ghsClassification: "Not classified", boilingPoint: 270, customAttributes: { grade: "Potassium Sorbate FCC Grade E202", supplier: "Celanese GmbH", reach: false, vocContent: 0, viscosity: null, density: 1.36 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-RM-0022", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Beta-Carotene E160a 1% Dispersion",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Beta-carotene 1% oil dispersion (E160a). Natural yellow-orange colourant derived from carrot. Stable in beverages.",
      density: 1.02,
      viscosity: 120,
      pH: 7.2,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, NonGMO: true, FDA: true },
      attributes: { casNumber: "7235-40-7", reachRegistration: "Not applicable – food colourant", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Beta-Carotene 1% Oil Dispersion Natural E160a", supplier: "DSM Nutritional Products", reach: false, vocContent: 0, viscosity: 120, density: 1.02 } }
    },
    create: {
      itemCode: "FNB-RM-0022",
      name: "Beta-Carotene E160a 1% Dispersion",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.RAW_MATERIAL,
      uom: "kg",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Beta-carotene 1% oil dispersion (E160a). Natural yellow-orange colourant derived from carrot. Stable in beverages.",
      density: 1.02,
      viscosity: 120,
      pH: 7.2,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true, NonGMO: true, FDA: true },
      attributes: { casNumber: "7235-40-7", reachRegistration: "Not applicable – food colourant", ghsClassification: "Not classified", boilingPoint: null, customAttributes: { grade: "Beta-Carotene 1% Oil Dispersion Natural E160a", supplier: "DSM Nutritional Products", reach: false, vocContent: 0, viscosity: 120, density: 1.02 } }
    }
  });

  // ── FINISHED GOODS ────────────────────────────────────────────────────────

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-FG-0001", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Caramel Choco Fudge Bar 45g",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.FINISHED_GOOD,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Premium filled chocolate confectionery bar with a caramel fudge centre coated in 72% dark couverture. 45g single serve. Shelf life: 12 months at <25°C. Contains: Milk, Soy.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Confectionery SKU – Retail", supplier: "In-house manufacture", reach: false, vocContent: 0, viscosity: null, density: null } }
    },
    create: {
      itemCode: "FNB-FG-0001",
      name: "Caramel Choco Fudge Bar 45g",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.FINISHED_GOOD,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Premium filled chocolate confectionery bar with a caramel fudge centre coated in 72% dark couverture. 45g single serve. Shelf life: 12 months at <25°C. Contains: Milk, Soy.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, KOSHER: true },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Confectionery SKU – Retail", supplier: "In-house manufacture", reach: false, vocContent: 0, viscosity: null, density: null } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-FG-0002", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Sea Salt & Vinegar Crisps 150g",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.FINISHED_GOOD,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Kettle-style potato crisps seasoned with sea salt and malt vinegar. 150g sharing pouch. Shelf life: 6 months. Free from major allergens (produced in a facility that handles gluten).",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Snack SKU – Retail Sharing Bag", supplier: "In-house manufacture", reach: false, vocContent: 0, viscosity: null, density: null } }
    },
    create: {
      itemCode: "FNB-FG-0002",
      name: "Sea Salt & Vinegar Crisps 150g",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.FINISHED_GOOD,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Kettle-style potato crisps seasoned with sea salt and malt vinegar. 150g sharing pouch. Shelf life: 6 months. Free from major allergens (produced in a facility that handles gluten).",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Halal: true, Vegan: true },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Snack SKU – Retail Sharing Bag", supplier: "In-house manufacture", reach: false, vocContent: 0, viscosity: null, density: null } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-FG-0003", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Mango Passion Nectar 330ml",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.FINISHED_GOOD,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Tropical fruit nectar combining Alphonso mango puree with passion fruit juice, enriched with Vitamin C (E300). 330ml PET bottle. Shelf life: 9 months ambient. Refrigerate after opening.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Vegan: true, Halal: true, FDA: true },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Beverage SKU – Retail 330ml PET", supplier: "In-house manufacture", reach: false, vocContent: 0, viscosity: null, density: null } }
    },
    create: {
      itemCode: "FNB-FG-0003",
      name: "Mango Passion Nectar 330ml",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.FINISHED_GOOD,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Tropical fruit nectar combining Alphonso mango puree with passion fruit juice, enriched with Vitamin C (E300). 330ml PET bottle. Shelf life: 9 months ambient. Refrigerate after opening.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, Vegan: true, Halal: true, FDA: true },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Beverage SKU – Retail 330ml PET", supplier: "In-house manufacture", reach: false, vocContent: 0, viscosity: null, density: null } }
    }
  });

  // ── PACKAGING ITEMS ───────────────────────────────────────────────────────

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-PKG-0001", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Flow Wrap OPP Film 45g",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Oriented polypropylene flow wrap film for 45g bar format. Heat-sealable both sides. Print receptive.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "OPP Flow Wrap Film 40mic Heat-Seal", supplier: "Uflex Ltd", reach: true, vocContent: 0, viscosity: null, density: 0.91 } }
    },
    create: {
      itemCode: "FNB-PKG-0001",
      name: "Flow Wrap OPP Film 45g",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Oriented polypropylene flow wrap film for 45g bar format. Heat-sealable both sides. Print receptive.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "OPP Flow Wrap Film 40mic Heat-Seal", supplier: "Uflex Ltd", reach: true, vocContent: 0, viscosity: null, density: 0.91 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-PKG-0002", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Cardboard Insert Tray 24ct",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Folded cardboard insert tray for 24-count bar display. SBS 300gsm, food-safe coating.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "SBS 300gsm Food-Safe Coating Insert Tray", supplier: "ITC Paperboards", reach: false, vocContent: 0, viscosity: null, density: null } }
    },
    create: {
      itemCode: "FNB-PKG-0002",
      name: "Cardboard Insert Tray 24ct",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Folded cardboard insert tray for 24-count bar display. SBS 300gsm, food-safe coating.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "SBS 300gsm Food-Safe Coating Insert Tray", supplier: "ITC Paperboards", reach: false, vocContent: 0, viscosity: null, density: null } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-PKG-0003", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Corrugated Display Box 24ct",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Corrugated outer display box for 24-count confectionery. E-flute, printed 4C litho-laminated.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: false, FoodContact: false },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "E-Flute 4C Litho-Lam Display Box", supplier: "Smurfit Kappa India", reach: false, vocContent: 0, viscosity: null, density: null } }
    },
    create: {
      itemCode: "FNB-PKG-0003",
      name: "Corrugated Display Box 24ct",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Corrugated outer display box for 24-count confectionery. E-flute, printed 4C litho-laminated.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: false, FoodContact: false },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "E-Flute 4C Litho-Lam Display Box", supplier: "Smurfit Kappa India", reach: false, vocContent: 0, viscosity: null, density: null } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-PKG-0004", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Metallised OPP Pouch 150g",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Metallised OPP laminate pouch, 150g snack format. High barrier, rotogravure printed. Resealable notch.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Met OPP 25mic Barrier Laminate Pouch", supplier: "Polyplex Corporation", reach: false, vocContent: 0, viscosity: null, density: 0.90 } }
    },
    create: {
      itemCode: "FNB-PKG-0004",
      name: "Metallised OPP Pouch 150g",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Metallised OPP laminate pouch, 150g snack format. High barrier, rotogravure printed. Resealable notch.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Met OPP 25mic Barrier Laminate Pouch", supplier: "Polyplex Corporation", reach: false, vocContent: 0, viscosity: null, density: 0.90 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-PKG-0005", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Master Carton 12-pack",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "B-flute corrugated master carton for 12-pack snack bags. Crush-resistant, printable surface.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: false, FoodContact: false },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "B-Flute Corrugated Master Carton 12-pack", supplier: "DS Smith India", reach: false, vocContent: 0, viscosity: null, density: null } }
    },
    create: {
      itemCode: "FNB-PKG-0005",
      name: "Master Carton 12-pack",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "B-flute corrugated master carton for 12-pack snack bags. Crush-resistant, printable surface.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: false, FoodContact: false },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "B-Flute Corrugated Master Carton 12-pack", supplier: "DS Smith India", reach: false, vocContent: 0, viscosity: null, density: null } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-PKG-0006", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "PET Bottle 330ml",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Clear PET bottle, 330ml, 28mm neck. Food-contact grade, recyclable. BPA-free.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true, BPAFree: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Clear PET 330ml Bottle 28mm 28-410", supplier: "Manjushree Technopack", reach: false, vocContent: 0, viscosity: null, density: 1.38 } }
    },
    create: {
      itemCode: "FNB-PKG-0006",
      name: "PET Bottle 330ml",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Clear PET bottle, 330ml, 28mm neck. Food-contact grade, recyclable. BPA-free.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true, BPAFree: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "Clear PET 330ml Bottle 28mm 28-410", supplier: "Manjushree Technopack", reach: false, vocContent: 0, viscosity: null, density: 1.38 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-PKG-0007", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "HDPE Cap 28mm",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "28mm HDPE screw cap for PET beverage bottle. Tamper-evident band. FSSAI food contact approved.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "HDPE Cap 28mm TE Band Food Contact", supplier: "Caps & Closures India", reach: false, vocContent: 0, viscosity: null, density: 0.95 } }
    },
    create: {
      itemCode: "FNB-PKG-0007",
      name: "HDPE Cap 28mm",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "28mm HDPE screw cap for PET beverage bottle. Tamper-evident band. FSSAI food contact approved.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: true, FoodContact: true },
      attributes: { casNumber: null, reachRegistration: "EU 10/2011 Compliant", ghsClassification: null, boilingPoint: null, customAttributes: { grade: "HDPE Cap 28mm TE Band Food Contact", supplier: "Caps & Closures India", reach: false, vocContent: 0, viscosity: null, density: 0.95 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-PKG-0008", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Shrink Sleeve Label PET 330ml",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Full-body PET shrink sleeve label for 330ml bottle. 50 micron, rotogravure 8-colour, pre-cut.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: false, FoodContact: false },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "PET Shrink Sleeve 50mic 8-Colour Rotogravure", supplier: "Huhtamaki India", reach: false, vocContent: 0, viscosity: null, density: 1.37 } }
    },
    create: {
      itemCode: "FNB-PKG-0008",
      name: "Shrink Sleeve Label PET 330ml",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Full-body PET shrink sleeve label for 330ml bottle. 50 micron, rotogravure 8-colour, pre-cut.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: false, FoodContact: false },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "PET Shrink Sleeve 50mic 8-Colour Rotogravure", supplier: "Huhtamaki India", reach: false, vocContent: 0, viscosity: null, density: 1.37 } }
    }
  });

  await prisma.item.upsert({
    where: { itemCode_revisionMajor_revisionIteration: { itemCode: "FNB-PKG-0009", revisionMajor: 1, revisionIteration: 1 } },
    update: {
      name: "Tray Wrap Carton 24-pack",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Tray-and-wrap corrugated carton for 24-pack beverage bottles. C-flute, strapped for transit.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: false, FoodContact: false },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "C-Flute Tray & Wrap Carton 24-pack Beverage", supplier: "Smurfit Kappa India", reach: false, vocContent: 0, viscosity: null, density: null } }
    },
    create: {
      itemCode: "FNB-PKG-0009",
      name: "Tray Wrap Carton 24-pack",
      industryType: Industry.FOOD_BEVERAGE,
      itemType: ItemType.PACKAGING,
      uom: "ea",
      status: LifecycleStatus.RELEASED,
      containerId: foodContainer.id,
      description: "Tray-and-wrap corrugated carton for 24-pack beverage bottles. C-flute, strapped for transit.",
      density: null,
      viscosity: null,
      pH: null,
      flashPoint: null,
      regulatoryFlags: { FSSAI: false, FoodContact: false },
      attributes: { casNumber: null, reachRegistration: null, ghsClassification: null, boilingPoint: null, customAttributes: { grade: "C-Flute Tray & Wrap Carton 24-pack Beverage", supplier: "Smurfit Kappa India", reach: false, vocContent: 0, viscosity: null, density: null } }
    }
  });

  // ─── Raw Material Specifications (5 specs each for all 22 RMs) ────────────
  const fnbRawMaterialItems = await prisma.item.findMany({
    where: { containerId: foodContainer.id, itemType: ItemType.RAW_MATERIAL }
  });
  for (const item of fnbRawMaterialItems) {
    if (isDemo) {
      const existingSpecs = await prisma.specification.count({ where: { itemId: item.id } });
      if (existingSpecs > 0) continue;
    }
    await prisma.specification.createMany({
      data: [
        { itemId: item.id, containerId: foodContainer.id, specType: "MICROBIO", attribute: "Total Plate Count", maxValue: 1000, uom: "cfu/g", testMethod: "ISO 4833" },
        { itemId: item.id, containerId: foodContainer.id, specType: "MICROBIO", attribute: "Yeast & Mold", maxValue: 100, uom: "cfu/g", testMethod: "ISO 21527" },
        { itemId: item.id, containerId: foodContainer.id, specType: "SENSORY", attribute: "Appearance", value: "Typical for grade", testMethod: "Visual" },
        { itemId: item.id, containerId: foodContainer.id, specType: "ALLERGEN", attribute: "Allergen Statement", value: "See CoA for specific declaration", testMethod: "CoA Review" },
        { itemId: item.id, containerId: foodContainer.id, specType: "CHEMICAL", attribute: "Moisture", maxValue: 5.0, uom: "%", testMethod: "AOAC 925.10" }
      ],
      skipDuplicates: true
    });
  }

  // ─── Helper lookups ────────────────────────────────────────────────────────
  const foodChemist = await prisma.user.findUniqueOrThrow({ where: { email: "chemist@plm.local" } });
  const fnbByCode = new Map(
    (await prisma.item.findMany({ where: { containerId: foodContainer.id } })).map((i) => [i.itemCode, i])
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SKU 1 — SWEET: Caramel Choco Fudge Bar 45g (FNB-FG-0001)
  // ═══════════════════════════════════════════════════════════════════════════

  const fudgeFormula = await prisma.formula.upsert({
    where: { formulaCode_version: { formulaCode: "FNB-FML-0001", version: 1 } },
    update: {
      name: "Caramel Choco Fudge Base",
      industryType: Industry.FOOD_BEVERAGE,
      containerId: foodContainer.id,
      status: FormulaStatus.RELEASED,
      ownerId: foodChemist.id,
      targetYield: 500,
      yieldUom: "kg",
      batchSize: 500,
      batchUom: "kg"
    },
    create: {
      formulaCode: "FNB-FML-0001",
      version: 1,
      name: "Caramel Choco Fudge Base",
      industryType: Industry.FOOD_BEVERAGE,
      containerId: foodContainer.id,
      status: FormulaStatus.RELEASED,
      ownerId: foodChemist.id,
      targetYield: 500,
      yieldUom: "kg",
      batchSize: 500,
      batchUom: "kg"
    }
  });

  if (!isDemo || (await prisma.formulaIngredient.count({ where: { formulaId: fudgeFormula.id } })) === 0) {
    await prisma.formulaIngredient.createMany({
      data: [
        { formulaId: fudgeFormula.id, itemId: fnbByCode.get("FNB-RM-0001")?.id, quantity: 120, uom: "kg", percentage: 24, additionSequence: 1 },
        { formulaId: fudgeFormula.id, itemId: fnbByCode.get("FNB-RM-0002")?.id, quantity: 175, uom: "kg", percentage: 35, additionSequence: 2 },
        { formulaId: fudgeFormula.id, itemId: fnbByCode.get("FNB-RM-0003")?.id, quantity: 90,  uom: "kg", percentage: 18, additionSequence: 3 },
        { formulaId: fudgeFormula.id, itemId: fnbByCode.get("FNB-RM-0004")?.id, quantity: 50,  uom: "kg", percentage: 10, additionSequence: 4 },
        { formulaId: fudgeFormula.id, itemId: fnbByCode.get("FNB-RM-0005")?.id, quantity: 45,  uom: "kg", percentage: 9,  additionSequence: 5 },
        { formulaId: fudgeFormula.id, itemId: fnbByCode.get("FNB-RM-0006")?.id, quantity: 12,  uom: "kg", percentage: 2.4, additionSequence: 6 },
        { formulaId: fudgeFormula.id, itemId: fnbByCode.get("FNB-RM-0007")?.id, quantity: 3,   uom: "kg", percentage: 0.6, additionSequence: 7 },
        { formulaId: fudgeFormula.id, itemId: fnbByCode.get("FNB-RM-0008")?.id, quantity: 5,   uom: "kg", percentage: 1,  additionSequence: 8 }
      ].filter((l) => l.itemId)
    });
  }

  if (!isDemo || (await prisma.specification.count({ where: { formulaId: fudgeFormula.id } })) === 0) {
    await prisma.specification.createMany({
      data: [
        { formulaId: fudgeFormula.id, containerId: foodContainer.id, specType: "NUTRITION",  attribute: "Energy",          maxValue: 520,  uom: "kcal/100g", testMethod: "Calculation" },
        { formulaId: fudgeFormula.id, containerId: foodContainer.id, specType: "NUTRITION",  attribute: "Total Fat",        minValue: 27, maxValue: 35, uom: "g/100g", testMethod: "AOAC 989.05" },
        { formulaId: fudgeFormula.id, containerId: foodContainer.id, specType: "NUTRITION",  attribute: "Total Sugars",     minValue: 45, maxValue: 58, uom: "g/100g", testMethod: "HPLC" },
        { formulaId: fudgeFormula.id, containerId: foodContainer.id, specType: "NUTRITION",  attribute: "Protein",          minValue: 4.5, uom: "g/100g", testMethod: "AOAC 991.20" },
        { formulaId: fudgeFormula.id, containerId: foodContainer.id, specType: "MICROBIO",   attribute: "Total Plate Count", maxValue: 1000, uom: "cfu/g", testMethod: "ISO 4833" },
        { formulaId: fudgeFormula.id, containerId: foodContainer.id, specType: "MICROBIO",   attribute: "Yeast & Mold",     maxValue: 100,  uom: "cfu/g", testMethod: "ISO 21527" },
        { formulaId: fudgeFormula.id, containerId: foodContainer.id, specType: "SENSORY",    attribute: "Flavor",           value: "Rich chocolate, clean caramel notes", testMethod: "Sensory Panel" },
        { formulaId: fudgeFormula.id, containerId: foodContainer.id, specType: "ALLERGEN",   attribute: "Contains",         value: "Milk, Soy (Lecithin)", testMethod: "Label Review" }
      ],
      skipDuplicates: true
    });
  }

  const fudgeFg = await prisma.item.findFirstOrThrow({
    where: { itemCode: "FNB-FG-0001", revisionMajor: 1, revisionIteration: 1 }
  });

  const existingFudgeFgStructure = await prisma.fGStructure.findUnique({
    where: { fgItemId_version: { fgItemId: fudgeFg.id, version: 1 } }
  });
  if (!existingFudgeFgStructure) {
    const fudgeFgStructure = await prisma.fGStructure.create({
      data: {
        fgItemId: fudgeFg.id,
        formulaId: fudgeFormula.id,
        version: 1,
        revisionMajor: 1,
        revisionIteration: 1,
        revisionLabel: "1.1",
        status: FGStatus.RELEASED,
        containerId: foodContainer.id
      }
    });
    await prisma.fGPackagingLine.createMany({
      data: [
        { fgStructureId: fudgeFgStructure.id, itemId: fnbByCode.get("FNB-PKG-0001")!.id, lineNumber: 10, quantity: 1,      uom: "ea" },
        { fgStructureId: fudgeFgStructure.id, itemId: fnbByCode.get("FNB-PKG-0002")!.id, lineNumber: 20, quantity: 1,      uom: "ea" },
        { fgStructureId: fudgeFgStructure.id, itemId: fnbByCode.get("FNB-PKG-0003")!.id, lineNumber: 30, quantity: 0.0417, uom: "ea" }
      ].filter((l) => l.itemId)
    });
  }

  // FG Item Specifications — fudgeFg
  if (!isDemo || (await prisma.specification.count({ where: { itemId: fudgeFg.id } })) === 0) {
    await prisma.specification.createMany({
      data: [
        { itemId: fudgeFg.id, containerId: foodContainer.id, specType: "NUTRITION",   attribute: "Declared Energy",       value: "520 kcal / 218 kJ per 100g", testMethod: "Nutrition Label" },
        { itemId: fudgeFg.id, containerId: foodContainer.id, specType: "MICROBIO",    attribute: "Salmonella",            value: "Absent in 25g", testMethod: "ISO 6579" },
        { itemId: fudgeFg.id, containerId: foodContainer.id, specType: "SENSORY",     attribute: "Appearance",            value: "Uniform dark brown gloss, no bloom", testMethod: "Visual" },
        { itemId: fudgeFg.id, containerId: foodContainer.id, specType: "ALLERGEN",    attribute: "Allergen Declaration",  value: "Contains: Milk, Soy. May contain: Tree Nuts, Wheat", testMethod: "Label Review" },
        { itemId: fudgeFg.id, containerId: foodContainer.id, specType: "REGULATORY",  attribute: "Food Safety Standard",  value: "FSSC 22000 Compliant", testMethod: "Certification" }
      ],
      skipDuplicates: true
    });
  }

  // Documents for fudgeFg
  const fudgeDoc1 = await prisma.document.upsert({
    where: { docNumber: "FNB-DOC-0001" },
    update: { name: "Caramel Choco Fudge Bar – Product Specification Sheet", docType: "SPECIFICATION", status: "RELEASED", containerId: foodContainer.id, ownerId: plmAdmin.id },
    create: { docNumber: "FNB-DOC-0001", name: "Caramel Choco Fudge Bar – Product Specification Sheet", docType: "SPECIFICATION", status: "RELEASED", fileName: "fnb-doc-0001.pdf", filePath: "storage/documents/fnb-doc-0001.pdf", fileSize: 102400, mimeType: "application/pdf", containerId: foodContainer.id, ownerId: plmAdmin.id }
  });
  const fudgeDoc2 = await prisma.document.upsert({
    where: { docNumber: "FNB-DOC-0002" },
    update: { name: "Caramel Choco Fudge Bar – Allergen Risk Assessment", docType: "REGULATORY", status: "RELEASED", containerId: foodContainer.id, ownerId: plmAdmin.id },
    create: { docNumber: "FNB-DOC-0002", name: "Caramel Choco Fudge Bar – Allergen Risk Assessment", docType: "REGULATORY", status: "RELEASED", fileName: "fnb-doc-0002.pdf", filePath: "storage/documents/fnb-doc-0002.pdf", fileSize: 81920, mimeType: "application/pdf", containerId: foodContainer.id, ownerId: plmAdmin.id }
  });
  const fudgeDoc3 = await prisma.document.upsert({
    where: { docNumber: "FNB-DOC-0003" },
    update: { name: "Caramel Choco Fudge Bar – Shelf Life Study Report", docType: "QUALITY", status: "RELEASED", containerId: foodContainer.id, ownerId: plmAdmin.id },
    create: { docNumber: "FNB-DOC-0003", name: "Caramel Choco Fudge Bar – Shelf Life Study Report", docType: "QUALITY", status: "RELEASED", fileName: "fnb-doc-0003.pdf", filePath: "storage/documents/fnb-doc-0003.pdf", fileSize: 204800, mimeType: "application/pdf", containerId: foodContainer.id, ownerId: plmAdmin.id }
  });
  for (const doc of [fudgeDoc1, fudgeDoc2, fudgeDoc3]) {
    const existingLink = await prisma.documentLink.findFirst({ where: { documentId: doc.id, entityId: fudgeFg.id, entityType: "ITEM" } });
    if (!existingLink) {
      await prisma.documentLink.create({ data: { documentId: doc.id, entityType: "ITEM", entityId: fudgeFg.id } });
    }
  }

  // Release Request for fudgeFg
  const fudgeRelease = await prisma.releaseRequest.upsert({
    where: { rrNumber: "FNB-RR-1001" },
    update: { title: "Initial Release — Caramel Choco Fudge Bar 45g", status: "RELEASED", targetItems: ["FNB-FG-0001"], targetFormulas: ["FNB-FML-0001"], containerId: foodContainer.id, requestedById: plmAdmin.id },
    create: { rrNumber: "FNB-RR-1001", title: "Initial Release — Caramel Choco Fudge Bar 45g", status: "RELEASED", targetItems: ["FNB-FG-0001"], targetFormulas: ["FNB-FML-0001"], containerId: foodContainer.id, requestedById: plmAdmin.id }
  });

  // Artwork for fudgeFg
  const existingFudgeArtwork = await prisma.artwork.findFirst({ where: { artworkCode: "FNB-ART-0001" } });
  if (!existingFudgeArtwork) {
    const fudgeArtwork = await prisma.artwork.create({
      data: {
        artworkCode: "FNB-ART-0001",
        title: "Caramel Choco Fudge Bar – Flow Wrap Label v1",
        brand: "ChocoCore",
        packSize: "45g",
        market: "IN",
        languageSet: ["EN", "HI"],
        status: "RELEASED",
        legalCopy: "Best before: see crimp. Store below 25°C away from direct sunlight.",
        claims: ["No artificial colours", "Premium dark chocolate", "Caramel filled"],
        warnings: "Contains milk and soy.",
        storageConditions: "Store in a cool dry place below 25°C.",
        usageInstructions: "Enjoy at room temperature.",
        fgItemId: fudgeFg.id,
        packagingItemId: fnbByCode.get("FNB-PKG-0001")!.id,
        formulaId: fudgeFormula.id,
        releaseRequestId: fudgeRelease.id,
        containerId: foodContainer.id,
        ownerId: plmAdmin.id,
        components: {
          create: [
            { componentType: "LABEL", name: "Front Wrap Label", dimensions: "130mm × 85mm", substrate: "OPP 40mic", printProcess: "Rotogravure" },
            { componentType: "OTHER", name: "Back Nutrition Panel", dimensions: "60mm × 85mm", substrate: "OPP 40mic", printProcess: "Rotogravure" }
          ]
        },
        approvals: {
          create: [
            { stage: "Regulatory Review", approverRole: "Regulatory Affairs", decision: "APPROVED" },
            { stage: "QA Signoff", approverRole: "QA Manager", decision: "APPROVED" }
          ]
        },
        links: {
          create: [
            { entityType: "FORMULA", entityId: fudgeFormula.id },
            { entityType: "ITEM", entityId: fudgeFg.id }
          ]
        }
      }
    });
    await prisma.artworkFile.createMany({
      data: [
        { artworkId: fudgeArtwork.id, fileType: "PROOF", fileName: "fnb-fudge-bar-proof-v1.pdf", filePath: "storage/artworks/fnb-fudge-bar-proof-v1.pdf", fileSize: 312400, mimeType: "application/pdf", uploadedById: plmAdmin.id },
        { artworkId: fudgeArtwork.id, fileType: "FINAL", fileName: "fnb-fudge-bar-final-v1.ai", filePath: "storage/artworks/fnb-fudge-bar-final-v1.ai", fileSize: 1048576, mimeType: "application/illustrator", uploadedById: plmAdmin.id }
      ]
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SKU 2 — SAVORY: Sea Salt & Vinegar Crisps 150g (FNB-FG-0002)
  // ═══════════════════════════════════════════════════════════════════════════

  const crispsFormula = await prisma.formula.upsert({
    where: { formulaCode_version: { formulaCode: "FNB-FML-0002", version: 1 } },
    update: {
      name: "Sea Salt & Vinegar Seasoning Blend",
      industryType: Industry.FOOD_BEVERAGE,
      containerId: foodContainer.id,
      status: FormulaStatus.RELEASED,
      ownerId: foodChemist.id,
      targetYield: 1000,
      yieldUom: "kg",
      batchSize: 1000,
      batchUom: "kg"
    },
    create: {
      formulaCode: "FNB-FML-0002",
      version: 1,
      name: "Sea Salt & Vinegar Seasoning Blend",
      industryType: Industry.FOOD_BEVERAGE,
      containerId: foodContainer.id,
      status: FormulaStatus.RELEASED,
      ownerId: foodChemist.id,
      targetYield: 1000,
      yieldUom: "kg",
      batchSize: 1000,
      batchUom: "kg"
    }
  });

  if (!isDemo || (await prisma.formulaIngredient.count({ where: { formulaId: crispsFormula.id } })) === 0) {
    await prisma.formulaIngredient.createMany({
      data: [
        { formulaId: crispsFormula.id, itemId: fnbByCode.get("FNB-RM-0009")?.id, quantity: 680, uom: "kg", percentage: 68,  additionSequence: 1 },
        { formulaId: crispsFormula.id, itemId: fnbByCode.get("FNB-RM-0010")?.id, quantity: 180, uom: "kg", percentage: 18,  additionSequence: 2 },
        { formulaId: crispsFormula.id, itemId: fnbByCode.get("FNB-RM-0011")?.id, quantity: 50,  uom: "kg", percentage: 5,   additionSequence: 3 },
        { formulaId: crispsFormula.id, itemId: fnbByCode.get("FNB-RM-0012")?.id, quantity: 40,  uom: "kg", percentage: 4,   additionSequence: 4 },
        { formulaId: crispsFormula.id, itemId: fnbByCode.get("FNB-RM-0013")?.id, quantity: 20,  uom: "kg", percentage: 2,   additionSequence: 5 },
        { formulaId: crispsFormula.id, itemId: fnbByCode.get("FNB-RM-0014")?.id, quantity: 15,  uom: "kg", percentage: 1.5, additionSequence: 6 },
        { formulaId: crispsFormula.id, itemId: fnbByCode.get("FNB-RM-0015")?.id, quantity: 15,  uom: "kg", percentage: 1.5, additionSequence: 7 }
      ].filter((l) => l.itemId)
    });
  }

  if (!isDemo || (await prisma.specification.count({ where: { formulaId: crispsFormula.id } })) === 0) {
    await prisma.specification.createMany({
      data: [
        { formulaId: crispsFormula.id, containerId: foodContainer.id, specType: "NUTRITION", attribute: "Energy",              maxValue: 490,  uom: "kcal/100g", testMethod: "Calculation" },
        { formulaId: crispsFormula.id, containerId: foodContainer.id, specType: "NUTRITION", attribute: "Total Fat",            minValue: 24, maxValue: 32, uom: "g/100g", testMethod: "AOAC 989.05" },
        { formulaId: crispsFormula.id, containerId: foodContainer.id, specType: "NUTRITION", attribute: "Sodium",               minValue: 450, maxValue: 600, uom: "mg/100g", testMethod: "ICP-OES" },
        { formulaId: crispsFormula.id, containerId: foodContainer.id, specType: "CHEMICAL",  attribute: "Moisture",             maxValue: 3.5, uom: "%", testMethod: "AOAC 925.10" },
        { formulaId: crispsFormula.id, containerId: foodContainer.id, specType: "CHEMICAL",  attribute: "Fat (Acid Hydrolysis)", minValue: 24, maxValue: 33, uom: "%", testMethod: "AOAC 922.06" },
        { formulaId: crispsFormula.id, containerId: foodContainer.id, specType: "MICROBIO",  attribute: "Total Plate Count",    maxValue: 10000, uom: "cfu/g", testMethod: "ISO 4833" },
        { formulaId: crispsFormula.id, containerId: foodContainer.id, specType: "SENSORY",   attribute: "Taste Profile",        value: "Sharp vinegar tang, balanced salt, clean finish", testMethod: "Sensory Panel" },
        { formulaId: crispsFormula.id, containerId: foodContainer.id, specType: "SENSORY",   attribute: "Texture",              value: "Crisp, uniform bite, no staleness", testMethod: "Sensory Panel" }
      ],
      skipDuplicates: true
    });
  }

  const crispsFg = await prisma.item.findFirstOrThrow({
    where: { itemCode: "FNB-FG-0002", revisionMajor: 1, revisionIteration: 1 }
  });

  const existingCrispsFgStructure = await prisma.fGStructure.findUnique({
    where: { fgItemId_version: { fgItemId: crispsFg.id, version: 1 } }
  });
  if (!existingCrispsFgStructure) {
    const crispsFgStructure = await prisma.fGStructure.create({
      data: {
        fgItemId: crispsFg.id,
        formulaId: crispsFormula.id,
        version: 1,
        revisionMajor: 1,
        revisionIteration: 1,
        revisionLabel: "1.1",
        status: FGStatus.RELEASED,
        containerId: foodContainer.id
      }
    });
    await prisma.fGPackagingLine.createMany({
      data: [
        { fgStructureId: crispsFgStructure.id, itemId: fnbByCode.get("FNB-PKG-0004")!.id, lineNumber: 10, quantity: 1,      uom: "ea" },
        { fgStructureId: crispsFgStructure.id, itemId: fnbByCode.get("FNB-PKG-0005")!.id, lineNumber: 20, quantity: 0.0833, uom: "ea" }
      ].filter((l) => l.itemId)
    });
  }

  // FG Item Specifications — crispsFg
  if (!isDemo || (await prisma.specification.count({ where: { itemId: crispsFg.id } })) === 0) {
    await prisma.specification.createMany({
      data: [
        { itemId: crispsFg.id, containerId: foodContainer.id, specType: "NUTRITION",  attribute: "Net Weight",              value: "150g (min 148g)", testMethod: "Checkweigher" },
        { itemId: crispsFg.id, containerId: foodContainer.id, specType: "MICROBIO",   attribute: "Listeria monocytogenes",  value: "Absent in 25g", testMethod: "ISO 11290-1" },
        { itemId: crispsFg.id, containerId: foodContainer.id, specType: "SENSORY",    attribute: "Colour",                  value: "Golden yellow, no excessive browning", testMethod: "Visual" },
        { itemId: crispsFg.id, containerId: foodContainer.id, specType: "ALLERGEN",   attribute: "Allergen Declaration",    value: "Free from major allergens. Produced in facility handling gluten.", testMethod: "Label Review" },
        { itemId: crispsFg.id, containerId: foodContainer.id, specType: "REGULATORY", attribute: "Country of Origin",       value: "Product of India", testMethod: "Label Compliance" }
      ],
      skipDuplicates: true
    });
  }

  // Documents for crispsFg
  const crispsDoc1 = await prisma.document.upsert({
    where: { docNumber: "FNB-DOC-0004" },
    update: { name: "Sea Salt & Vinegar Crisps – Product Specification", docType: "SPECIFICATION", status: "RELEASED", containerId: foodContainer.id, ownerId: plmAdmin.id },
    create: { docNumber: "FNB-DOC-0004", name: "Sea Salt & Vinegar Crisps – Product Specification", docType: "SPECIFICATION", status: "RELEASED", fileName: "fnb-doc-0004.pdf", filePath: "storage/documents/fnb-doc-0004.pdf", fileSize: 102400, mimeType: "application/pdf", containerId: foodContainer.id, ownerId: plmAdmin.id }
  });
  const crispsDoc2 = await prisma.document.upsert({
    where: { docNumber: "FNB-DOC-0005" },
    update: { name: "Sea Salt & Vinegar Crisps – HACCP Control Plan", docType: "REGULATORY", status: "RELEASED", containerId: foodContainer.id, ownerId: plmAdmin.id },
    create: { docNumber: "FNB-DOC-0005", name: "Sea Salt & Vinegar Crisps – HACCP Control Plan", docType: "REGULATORY", status: "RELEASED", fileName: "fnb-doc-0005.pdf", filePath: "storage/documents/fnb-doc-0005.pdf", fileSize: 163840, mimeType: "application/pdf", containerId: foodContainer.id, ownerId: plmAdmin.id }
  });
  const crispsDoc3 = await prisma.document.upsert({
    where: { docNumber: "FNB-DOC-0006" },
    update: { name: "Sea Salt & Vinegar Crisps – Certificate of Analysis v2", docType: "COA", status: "RELEASED", containerId: foodContainer.id, ownerId: plmAdmin.id },
    create: { docNumber: "FNB-DOC-0006", name: "Sea Salt & Vinegar Crisps – Certificate of Analysis v2", docType: "COA", status: "RELEASED", fileName: "fnb-doc-0006.pdf", filePath: "storage/documents/fnb-doc-0006.pdf", fileSize: 81920, mimeType: "application/pdf", containerId: foodContainer.id, ownerId: plmAdmin.id }
  });
  for (const doc of [crispsDoc1, crispsDoc2, crispsDoc3]) {
    const existingLink = await prisma.documentLink.findFirst({ where: { documentId: doc.id, entityId: crispsFg.id, entityType: "ITEM" } });
    if (!existingLink) {
      await prisma.documentLink.create({ data: { documentId: doc.id, entityType: "ITEM", entityId: crispsFg.id } });
    }
  }

  // Release Request for crispsFg
  const crispsRelease = await prisma.releaseRequest.upsert({
    where: { rrNumber: "FNB-RR-1002" },
    update: { title: "Initial Release — Sea Salt & Vinegar Crisps 150g", status: "RELEASED", targetItems: ["FNB-FG-0002"], targetFormulas: ["FNB-FML-0002"], containerId: foodContainer.id, requestedById: plmAdmin.id },
    create: { rrNumber: "FNB-RR-1002", title: "Initial Release — Sea Salt & Vinegar Crisps 150g", status: "RELEASED", targetItems: ["FNB-FG-0002"], targetFormulas: ["FNB-FML-0002"], containerId: foodContainer.id, requestedById: plmAdmin.id }
  });

  // Artwork for crispsFg
  const existingCrispsArtwork = await prisma.artwork.findFirst({ where: { artworkCode: "FNB-ART-0002" } });
  if (!existingCrispsArtwork) {
    const crispsArtwork = await prisma.artwork.create({
      data: {
        artworkCode: "FNB-ART-0002",
        title: "Sea Salt & Vinegar Crisps – Pouch Label v1",
        brand: "CrispEdge",
        packSize: "150g",
        market: "IN",
        languageSet: ["EN"],
        status: "RELEASED",
        legalCopy: "Best before: see base of pack. Once opened, consume within 3 days.",
        claims: ["Kettle-style crunch", "No artificial flavours", "0g Trans Fat"],
        warnings: "May contain traces of gluten.",
        storageConditions: "Store in a cool dry place. Avoid heat and humidity.",
        usageInstructions: "Best enjoyed fresh.",
        fgItemId: crispsFg.id,
        packagingItemId: fnbByCode.get("FNB-PKG-0004")!.id,
        formulaId: crispsFormula.id,
        releaseRequestId: crispsRelease.id,
        containerId: foodContainer.id,
        ownerId: plmAdmin.id,
        components: {
          create: [
            { componentType: "LABEL", name: "Front Pouch Panel", dimensions: "170mm × 280mm", substrate: "Met OPP 25mic", printProcess: "Rotogravure" },
            { componentType: "LABEL", name: "Back Nutrition Panel", dimensions: "100mm × 280mm", substrate: "Met OPP 25mic", printProcess: "Rotogravure" }
          ]
        },
        approvals: {
          create: [
            { stage: "Regulatory Review", approverRole: "Regulatory Affairs", decision: "APPROVED" },
            { stage: "QA Signoff", approverRole: "QA Manager", decision: "APPROVED" }
          ]
        },
        links: {
          create: [
            { entityType: "FORMULA", entityId: crispsFormula.id },
            { entityType: "ITEM", entityId: crispsFg.id }
          ]
        }
      }
    });
    await prisma.artworkFile.createMany({
      data: [
        { artworkId: crispsArtwork.id, fileType: "PROOF", fileName: "fnb-crisps-proof-v1.pdf", filePath: "storage/artworks/fnb-crisps-proof-v1.pdf", fileSize: 289000, mimeType: "application/pdf", uploadedById: plmAdmin.id },
        { artworkId: crispsArtwork.id, fileType: "FINAL", fileName: "fnb-crisps-final-v1.ai", filePath: "storage/artworks/fnb-crisps-final-v1.ai", fileSize: 921600, mimeType: "application/illustrator", uploadedById: plmAdmin.id }
      ]
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SKU 3 — BEVERAGE: Mango Passion Nectar 330ml (FNB-FG-0003)
  // ═══════════════════════════════════════════════════════════════════════════

  const nectarFormula = await prisma.formula.upsert({
    where: { formulaCode_version: { formulaCode: "FNB-FML-0003", version: 1 } },
    update: {
      name: "Mango Passion Nectar Concentrate",
      industryType: Industry.FOOD_BEVERAGE,
      containerId: foodContainer.id,
      status: FormulaStatus.RELEASED,
      ownerId: foodChemist.id,
      targetYield: 1000,
      yieldUom: "kg",
      batchSize: 1000,
      batchUom: "kg"
    },
    create: {
      formulaCode: "FNB-FML-0003",
      version: 1,
      name: "Mango Passion Nectar Concentrate",
      industryType: Industry.FOOD_BEVERAGE,
      containerId: foodContainer.id,
      status: FormulaStatus.RELEASED,
      ownerId: foodChemist.id,
      targetYield: 1000,
      yieldUom: "kg",
      batchSize: 1000,
      batchUom: "kg"
    }
  });

  if (!isDemo || (await prisma.formulaIngredient.count({ where: { formulaId: nectarFormula.id } })) === 0) {
    await prisma.formulaIngredient.createMany({
      data: [
        { formulaId: nectarFormula.id, itemId: fnbByCode.get("FNB-RM-0016")?.id, quantity: 420, uom: "kg", percentage: 42,   additionSequence: 1 },
        { formulaId: nectarFormula.id, itemId: fnbByCode.get("FNB-RM-0017")?.id, quantity: 80,  uom: "kg", percentage: 8,    additionSequence: 2 },
        { formulaId: nectarFormula.id, itemId: fnbByCode.get("FNB-RM-0018")?.id, quantity: 130, uom: "kg", percentage: 13,   additionSequence: 3 },
        { formulaId: nectarFormula.id, itemId: fnbByCode.get("FNB-RM-0019")?.id, quantity: 2.5, uom: "kg", percentage: 0.25, additionSequence: 4 },
        { formulaId: nectarFormula.id, itemId: fnbByCode.get("FNB-RM-0020")?.id, quantity: 1.0, uom: "kg", percentage: 0.10, additionSequence: 5 },
        { formulaId: nectarFormula.id, itemId: fnbByCode.get("FNB-RM-0021")?.id, quantity: 0.5, uom: "kg", percentage: 0.05, additionSequence: 6 },
        { formulaId: nectarFormula.id, itemId: fnbByCode.get("FNB-RM-0022")?.id, quantity: 2.0, uom: "kg", percentage: 0.20, additionSequence: 7 }
      ].filter((l) => l.itemId)
    });
  }

  if (!isDemo || (await prisma.specification.count({ where: { formulaId: nectarFormula.id } })) === 0) {
    await prisma.specification.createMany({
      data: [
        { formulaId: nectarFormula.id, containerId: foodContainer.id, specType: "NUTRITION", attribute: "Energy",               maxValue: 48,   uom: "kcal/100ml", testMethod: "Calculation" },
        { formulaId: nectarFormula.id, containerId: foodContainer.id, specType: "NUTRITION", attribute: "Total Sugars",          minValue: 10, maxValue: 14, uom: "g/100ml", testMethod: "HPLC" },
        { formulaId: nectarFormula.id, containerId: foodContainer.id, specType: "NUTRITION", attribute: "Vitamin C",             minValue: 15,   uom: "mg/100ml", testMethod: "HPLC" },
        { formulaId: nectarFormula.id, containerId: foodContainer.id, specType: "CHEMICAL",  attribute: "Brix (Soluble Solids)", minValue: 11.5, maxValue: 13.5, uom: "°Bx", testMethod: "Refractometer" },
        { formulaId: nectarFormula.id, containerId: foodContainer.id, specType: "CHEMICAL",  attribute: "pH",                   minValue: 3.4,  maxValue: 3.9,  testMethod: "pH Meter" },
        { formulaId: nectarFormula.id, containerId: foodContainer.id, specType: "MICROBIO",  attribute: "Total Plate Count",    maxValue: 100,  uom: "cfu/ml", testMethod: "ISO 4833" },
        { formulaId: nectarFormula.id, containerId: foodContainer.id, specType: "SENSORY",   attribute: "Colour",               value: "Deep amber-orange, bright and clear", testMethod: "Visual" },
        { formulaId: nectarFormula.id, containerId: foodContainer.id, specType: "SENSORY",   attribute: "Taste",                value: "Ripe mango forward, passion fruit finish, balanced acid-sweet", testMethod: "Sensory Panel" }
      ],
      skipDuplicates: true
    });
  }

  const nectarFg = await prisma.item.findFirstOrThrow({
    where: { itemCode: "FNB-FG-0003", revisionMajor: 1, revisionIteration: 1 }
  });

  const existingNectarFgStructure = await prisma.fGStructure.findUnique({
    where: { fgItemId_version: { fgItemId: nectarFg.id, version: 1 } }
  });
  if (!existingNectarFgStructure) {
    const nectarFgStructure = await prisma.fGStructure.create({
      data: {
        fgItemId: nectarFg.id,
        formulaId: nectarFormula.id,
        version: 1,
        revisionMajor: 1,
        revisionIteration: 1,
        revisionLabel: "1.1",
        status: FGStatus.RELEASED,
        containerId: foodContainer.id
      }
    });
    await prisma.fGPackagingLine.createMany({
      data: [
        { fgStructureId: nectarFgStructure.id, itemId: fnbByCode.get("FNB-PKG-0006")!.id, lineNumber: 10, quantity: 1,      uom: "ea" },
        { fgStructureId: nectarFgStructure.id, itemId: fnbByCode.get("FNB-PKG-0007")!.id, lineNumber: 20, quantity: 1,      uom: "ea" },
        { fgStructureId: nectarFgStructure.id, itemId: fnbByCode.get("FNB-PKG-0008")!.id, lineNumber: 30, quantity: 1,      uom: "ea" },
        { fgStructureId: nectarFgStructure.id, itemId: fnbByCode.get("FNB-PKG-0009")!.id, lineNumber: 40, quantity: 0.0417, uom: "ea" }
      ].filter((l) => l.itemId)
    });
  }

  // FG Item Specifications — nectarFg
  if (!isDemo || (await prisma.specification.count({ where: { itemId: nectarFg.id } })) === 0) {
    await prisma.specification.createMany({
      data: [
        { itemId: nectarFg.id, containerId: foodContainer.id, specType: "NUTRITION",  attribute: "Declared Energy",    value: "45 kcal / 190 kJ per 100ml", testMethod: "Nutrition Label" },
        { itemId: nectarFg.id, containerId: foodContainer.id, specType: "MICROBIO",   attribute: "E. coli",            value: "Absent in 1ml", testMethod: "ISO 9308-1" },
        { itemId: nectarFg.id, containerId: foodContainer.id, specType: "SENSORY",    attribute: "Fill Volume",        value: "330ml ± 5ml", testMethod: "Volumetric Check" },
        { itemId: nectarFg.id, containerId: foodContainer.id, specType: "ALLERGEN",   attribute: "Allergen Declaration", value: "Free from major allergens.", testMethod: "Label Review" },
        { itemId: nectarFg.id, containerId: foodContainer.id, specType: "REGULATORY", attribute: "Additive Compliance", value: "Potassium Sorbate within EU/FSSAI permitted limits", testMethod: "Regulatory Review" }
      ],
      skipDuplicates: true
    });
  }

  // Documents for nectarFg
  const nectarDoc1 = await prisma.document.upsert({
    where: { docNumber: "FNB-DOC-0007" },
    update: { name: "Mango Passion Nectar – Product Specification Sheet", docType: "SPECIFICATION", status: "RELEASED", containerId: foodContainer.id, ownerId: plmAdmin.id },
    create: { docNumber: "FNB-DOC-0007", name: "Mango Passion Nectar – Product Specification Sheet", docType: "SPECIFICATION", status: "RELEASED", fileName: "fnb-doc-0007.pdf", filePath: "storage/documents/fnb-doc-0007.pdf", fileSize: 102400, mimeType: "application/pdf", containerId: foodContainer.id, ownerId: plmAdmin.id }
  });
  const nectarDoc2 = await prisma.document.upsert({
    where: { docNumber: "FNB-DOC-0008" },
    update: { name: "Mango Passion Nectar – Regulatory Compliance Declaration", docType: "REGULATORY", status: "RELEASED", containerId: foodContainer.id, ownerId: plmAdmin.id },
    create: { docNumber: "FNB-DOC-0008", name: "Mango Passion Nectar – Regulatory Compliance Declaration", docType: "REGULATORY", status: "RELEASED", fileName: "fnb-doc-0008.pdf", filePath: "storage/documents/fnb-doc-0008.pdf", fileSize: 81920, mimeType: "application/pdf", containerId: foodContainer.id, ownerId: plmAdmin.id }
  });
  const nectarDoc3 = await prisma.document.upsert({
    where: { docNumber: "FNB-DOC-0009" },
    update: { name: "Mango Passion Nectar – SDS Concentrate", docType: "SDS", status: "RELEASED", containerId: foodContainer.id, ownerId: plmAdmin.id },
    create: { docNumber: "FNB-DOC-0009", name: "Mango Passion Nectar – SDS Concentrate", docType: "SDS", status: "RELEASED", fileName: "fnb-doc-0009.pdf", filePath: "storage/documents/fnb-doc-0009.pdf", fileSize: 61440, mimeType: "application/pdf", containerId: foodContainer.id, ownerId: plmAdmin.id }
  });
  for (const doc of [nectarDoc1, nectarDoc2, nectarDoc3]) {
    const existingLink = await prisma.documentLink.findFirst({ where: { documentId: doc.id, entityId: nectarFg.id, entityType: "ITEM" } });
    if (!existingLink) {
      await prisma.documentLink.create({ data: { documentId: doc.id, entityType: "ITEM", entityId: nectarFg.id } });
    }
  }

  // Release Request for nectarFg
  const nectarRelease = await prisma.releaseRequest.upsert({
    where: { rrNumber: "FNB-RR-1003" },
    update: { title: "Initial Release — Mango Passion Nectar 330ml", status: "RELEASED", targetItems: ["FNB-FG-0003"], targetFormulas: ["FNB-FML-0003"], containerId: foodContainer.id, requestedById: plmAdmin.id },
    create: { rrNumber: "FNB-RR-1003", title: "Initial Release — Mango Passion Nectar 330ml", status: "RELEASED", targetItems: ["FNB-FG-0003"], targetFormulas: ["FNB-FML-0003"], containerId: foodContainer.id, requestedById: plmAdmin.id }
  });

  // Artwork for nectarFg
  const existingNectarArtwork = await prisma.artwork.findFirst({ where: { artworkCode: "FNB-ART-0003" } });
  if (!existingNectarArtwork) {
    const nectarArtwork = await prisma.artwork.create({
      data: {
        artworkCode: "FNB-ART-0003",
        title: "Mango Passion Nectar – Shrink Sleeve 330ml v1",
        brand: "TropiBurst",
        packSize: "330ml",
        market: "IN,AE",
        languageSet: ["EN", "AR"],
        status: "RELEASED",
        legalCopy: "Best before: see base. Refrigerate after opening and consume within 3 days.",
        claims: ["No artificial colours", "Real mango & passion fruit", "Vitamin C enriched"],
        warnings: "Natural sediment may occur – shake gently.",
        storageConditions: "Store at ambient temperature away from sunlight.",
        usageInstructions: "Chill before serving.",
        fgItemId: nectarFg.id,
        packagingItemId: fnbByCode.get("FNB-PKG-0006")!.id,
        formulaId: nectarFormula.id,
        releaseRequestId: nectarRelease.id,
        containerId: foodContainer.id,
        ownerId: plmAdmin.id,
        components: {
          create: [
            { componentType: "SHRINK", name: "Full Body Shrink Sleeve", dimensions: "Circumference 82mm, Height 135mm", substrate: "PET 50mic", printProcess: "Rotogravure" },
            { componentType: "LABEL",  name: "Neck Label",              dimensions: "30mm × 40mm",                     substrate: "PP 60mic",  printProcess: "Flexo" }
          ]
        },
        approvals: {
          create: [
            { stage: "Regulatory Review", approverRole: "Regulatory Affairs", decision: "APPROVED" },
            { stage: "Market Compliance", approverRole: "Regulatory Affairs", decision: "APPROVED" }
          ]
        },
        links: {
          create: [
            { entityType: "FORMULA", entityId: nectarFormula.id },
            { entityType: "ITEM",    entityId: nectarFg.id }
          ]
        }
      }
    });
    await prisma.artworkFile.createMany({
      data: [
        { artworkId: nectarArtwork.id, fileType: "PROOF", fileName: "fnb-nectar-proof-v1.pdf", filePath: "storage/artworks/fnb-nectar-proof-v1.pdf", fileSize: 356000,  mimeType: "application/pdf",        uploadedById: plmAdmin.id },
        { artworkId: nectarArtwork.id, fileType: "FINAL", fileName: "fnb-nectar-final-v1.ai",  filePath: "storage/artworks/fnb-nectar-final-v1.ai",  fileSize: 1150000, mimeType: "application/illustrator", uploadedById: plmAdmin.id }
      ]
    });
  }

  // ─── Polymer Change Requests (kept from original) ──────────────────────────
  const requester = await prisma.user.findUniqueOrThrow({ where: { email: "plm@plm.local" } });
  await prisma.changeRequest.upsert({
    where: { crNumber: "PLY-CR-1001" },
    update: {
      title: "Reduce MFI drift in PP grade",
      type: ChangeType.ECR, priority: ChangePriority.HIGH, containerId: polymerContainer.id,
      status: ChangeStatus.SUBMITTED, requestedById: requester.id,
      affectedItems: ["PLY-RM-0003"], affectedFormulas: ["PLY-FML-0001"],
      impactAssessment: "Need alternate antioxidant package and process window validation"
    },
    create: {
      crNumber: "PLY-CR-1001", title: "Reduce MFI drift in PP grade",
      type: ChangeType.ECR, priority: ChangePriority.HIGH, containerId: polymerContainer.id,
      status: ChangeStatus.SUBMITTED, requestedById: requester.id,
      affectedItems: ["PLY-RM-0003"], affectedFormulas: ["PLY-FML-0001"],
      impactAssessment: "Need alternate antioxidant package and process window validation"
    }
  });
  await prisma.changeRequest.upsert({
    where: { crNumber: "PLY-CR-1002" },
    update: {
      title: "Packaging bag spec upgrade",
      type: ChangeType.ECO, priority: ChangePriority.MEDIUM, containerId: polymerContainer.id,
      status: ChangeStatus.UNDER_REVIEW, requestedById: requester.id,
      affectedItems: ["PLY-PKG-0001"], affectedFormulas: ["PLY-FML-0002"],
      impactAssessment: "Update tensile and puncture performance requirements"
    },
    create: {
      crNumber: "PLY-CR-1002", title: "Packaging bag spec upgrade",
      type: ChangeType.ECO, priority: ChangePriority.MEDIUM, containerId: polymerContainer.id,
      status: ChangeStatus.UNDER_REVIEW, requestedById: requester.id,
      affectedItems: ["PLY-PKG-0001"], affectedFormulas: ["PLY-FML-0002"],
      impactAssessment: "Update tensile and puncture performance requirements"
    }
  });

  // ─── FNB Change Requests ────────────────────────────────────────────────────
  await prisma.changeRequest.upsert({
    where: { crNumber: "FNB-CR-1001" },
    update: {
      title: "Sugar reduction 10% for choco fudge bar",
      type: ChangeType.ECR, priority: ChangePriority.HIGH, containerId: foodContainer.id,
      status: ChangeStatus.UNDER_REVIEW, requestedById: requester.id,
      affectedItems: ["FNB-FG-0001"], affectedFormulas: ["FNB-FML-0001"],
      impactAssessment: "Sensory revalidation and nutrition panel update required. Texture impact to be assessed."
    },
    create: {
      crNumber: "FNB-CR-1001", title: "Sugar reduction 10% for choco fudge bar",
      type: ChangeType.ECR, priority: ChangePriority.HIGH, containerId: foodContainer.id,
      status: ChangeStatus.UNDER_REVIEW, requestedById: requester.id,
      affectedItems: ["FNB-FG-0001"], affectedFormulas: ["FNB-FML-0001"],
      impactAssessment: "Sensory revalidation and nutrition panel update required. Texture impact to be assessed."
    }
  });
  await prisma.changeRequest.upsert({
    where: { crNumber: "FNB-CR-1002" },
    update: {
      title: "Sodium reduction — align to Health Star Rating 4+",
      type: ChangeType.ECR, priority: ChangePriority.MEDIUM, containerId: foodContainer.id,
      status: ChangeStatus.SUBMITTED, requestedById: requester.id,
      affectedItems: ["FNB-FG-0002"], affectedFormulas: ["FNB-FML-0002"],
      impactAssessment: "Reduce salt and sodium diacetate by 15%. Sensory panel required."
    },
    create: {
      crNumber: "FNB-CR-1002", title: "Sodium reduction — align to Health Star Rating 4+",
      type: ChangeType.ECR, priority: ChangePriority.MEDIUM, containerId: foodContainer.id,
      status: ChangeStatus.SUBMITTED, requestedById: requester.id,
      affectedItems: ["FNB-FG-0002"], affectedFormulas: ["FNB-FML-0002"],
      impactAssessment: "Reduce salt and sodium diacetate by 15%. Sensory panel required."
    }
  });
  await prisma.changeRequest.upsert({
    where: { crNumber: "FNB-CR-1003" },
    update: {
      title: "Add 'No added sugar' variant — Mango Passion Nectar",
      type: ChangeType.ECN, priority: ChangePriority.LOW, containerId: foodContainer.id,
      status: ChangeStatus.NEW, requestedById: requester.id,
      affectedItems: ["FNB-FG-0003"], affectedFormulas: ["FNB-FML-0003"],
      impactAssessment: "Replace cane sugar with stevia blend. Brix and sensory profiles to be re-established."
    },
    create: {
      crNumber: "FNB-CR-1003", title: "Add 'No added sugar' variant — Mango Passion Nectar",
      type: ChangeType.ECN, priority: ChangePriority.LOW, containerId: foodContainer.id,
      status: ChangeStatus.NEW, requestedById: requester.id,
      affectedItems: ["FNB-FG-0003"], affectedFormulas: ["FNB-FML-0003"],
      impactAssessment: "Replace cane sugar with stevia blend. Brix and sensory profiles to be re-established."
    }
  });

  const existingWorkflows = isDemo ? await prisma.workflowDefinition.count() : 0;
  if (!isDemo || existingWorkflows === 0) {
    await prisma.workflowDefinition.createMany({
      data: [
      {
        name: "Formula Approval",
        industry: Industry.POLYMER,
        entityType: "FORMULA",
        states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
        transitions: [
          { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT", label: "Submit for Review", style: "default" },
          { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES", label: "Request Changes", style: "warning" },
          { from: "UNDER_REVIEW", to: "RELEASED", action: "APPROVE", label: "Approve", style: "success" }
        ]
      },
      {
        name: "Change Management",
        industry: Industry.POLYMER,
        entityType: "CHANGE_REQUEST",
        states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
        transitions: [
          { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT", label: "Submit for Review", style: "default" },
          { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES", label: "Request Changes", style: "warning" },
          { from: "UNDER_REVIEW", to: "RELEASED", action: "APPROVE", label: "Approve", style: "success" }
        ]
      },
      {
        name: "Release Management",
        industry: Industry.POLYMER,
        entityType: "RELEASE_REQUEST",
        states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
        transitions: [
          { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT", label: "Submit for Release", style: "default" },
          { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES", label: "Request Changes", style: "warning" },
          { from: "UNDER_REVIEW", to: "RELEASED", action: "RELEASE", label: "Approve & Release", style: "success" }
        ]
      },
      {
        name: "Formula Approval",
        industry: Industry.FOOD_BEVERAGE,
        entityType: "FORMULA",
        states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
        transitions: [
          { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT", label: "Submit for Review", style: "default" },
          { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES", label: "Request Changes", style: "warning" },
          { from: "UNDER_REVIEW", to: "RELEASED", action: "APPROVE", label: "Approve", style: "success" }
        ]
      },
      {
        name: "Change Management",
        industry: Industry.FOOD_BEVERAGE,
        entityType: "CHANGE_REQUEST",
        states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
        transitions: [
          { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT", label: "Submit for Review", style: "default" },
          { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES", label: "Request Changes", style: "warning" },
          { from: "UNDER_REVIEW", to: "RELEASED", action: "APPROVE", label: "Approve", style: "success" }
        ]
      },
      {
        name: "Release Management",
        industry: Industry.FOOD_BEVERAGE,
        entityType: "RELEASE_REQUEST",
        states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
        transitions: [
          { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT", label: "Submit for Release", style: "default" },
          { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES", label: "Request Changes", style: "warning" },
          { from: "UNDER_REVIEW", to: "RELEASED", action: "RELEASE", label: "Approve & Release", style: "success" }
        ]
      }
      ]
    });
  }

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const user of allUsers) {
    await prisma.containerMembership.upsert({
      where: { containerId_userId: { containerId: polymerContainer.id, userId: user.id } },
      update: { containerRoleId: containerAdminRole.id },
      create: {
        containerId: polymerContainer.id,
        userId: user.id,
        containerRoleId: containerAdminRole.id
      }
    });
    await prisma.containerMembership.upsert({
      where: { containerId_userId: { containerId: foodContainer.id, userId: user.id } },
      update: { containerRoleId: foodAdminRole.id },
      create: {
        containerId: foodContainer.id,
        userId: user.id,
        containerRoleId: foodAdminRole.id
      }
    });
  }

  // ─── Seed workflow instances + tasks for Change Requests + Release Requests ─
  const crsToWorkflow = [
    { crNumber: "PLY-CR-1001", industry: Industry.POLYMER },
    { crNumber: "PLY-CR-1002", industry: Industry.POLYMER },
    { crNumber: "FNB-CR-1001", industry: Industry.FOOD_BEVERAGE },
    { crNumber: "FNB-CR-1002", industry: Industry.FOOD_BEVERAGE },
    { crNumber: "FNB-CR-1003", industry: Industry.FOOD_BEVERAGE }
  ];

  for (const { crNumber, industry } of crsToWorkflow) {
    const cr = await prisma.changeRequest.findUnique({ where: { crNumber } });
    if (!cr) continue;

    const existingInstance = await prisma.workflowInstance.findFirst({
      where: { entityType: "CHANGE_REQUEST", entityId: cr.id }
    });
    if (existingInstance) continue;

    const definition = await prisma.workflowDefinition.findFirst({
      where: { industry, entityType: "CHANGE_REQUEST" }
    });
    if (!definition) continue;

    const startState = "UNDER_REVIEW";
    const instance = await prisma.workflowInstance.create({
      data: { definitionId: definition.id, entityId: cr.id, entityType: "CHANGE_REQUEST", currentState: startState, history: [] }
    });

    const priorityMap: Record<string, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
      LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL"
    };
    const taskPriority = priorityMap[cr.priority ?? "MEDIUM"] ?? "MEDIUM";
    const dueDate = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await prisma.task.create({
      data: {
        workflowInstanceId: instance.id,
        title: `Change Management — ${startState}`,
        description: "Review the change request and approve or request changes.",
        state: startState,
        status: "OPEN",
        priority: taskPriority,
        assignedRoles: ["Container Admin"],
        dueDate,
        entityType: "CHANGE_REQUEST",
        entityId: cr.id,
        ...(cr.containerId ? { containerId: cr.containerId } : {})
      }
    });
  }

  // ─── Seed workflow instances for FNB Release Requests ─────────────────────
  const rrsToWorkflow = [
    { rrNumber: "FNB-RR-1001", industry: Industry.FOOD_BEVERAGE },
    { rrNumber: "FNB-RR-1002", industry: Industry.FOOD_BEVERAGE },
    { rrNumber: "FNB-RR-1003", industry: Industry.FOOD_BEVERAGE }
  ];
  for (const { rrNumber, industry } of rrsToWorkflow) {
    const rr = await prisma.releaseRequest.findUnique({ where: { rrNumber } });
    if (!rr) continue;
    const existingRRInstance = await prisma.workflowInstance.findFirst({
      where: { entityType: "RELEASE_REQUEST", entityId: rr.id }
    });
    if (existingRRInstance) continue;
    const rrDefinition = await prisma.workflowDefinition.findFirst({
      where: { industry, entityType: "RELEASE_REQUEST" }
    });
    if (!rrDefinition) continue;
    await prisma.workflowInstance.create({
      data: { definitionId: rrDefinition.id, entityId: rr.id, entityType: "RELEASE_REQUEST", currentState: "RELEASED", history: [] }
    });
  }

  // Reset number sequences to be safe after seeding items/formulas directly with codes
  {
    const syncItemSeq = async (entity: string, prefix: string) => {
      const rows = await prisma.item.findMany({ where: { itemCode: { startsWith: prefix } }, select: { itemCode: true } });
      if (rows.length === 0) return;
      const maxNum = Math.max(...rows.map((r) => parseInt(r.itemCode.slice(prefix.length), 10)));
      await prisma.numberSequence.updateMany({ where: { entity }, data: { next: maxNum + 1 } });
    };
    await syncItemSeq("ITEM", "PLY-RM-");
    await syncItemSeq("ITEM_FINISHED_GOOD", "PLY-FG-");
    await syncItemSeq("ITEM_PACKAGING", "PLY-PKG-");

    const fmlRows = await prisma.formula.findMany({ where: { formulaCode: { startsWith: "PLY-FML-" } }, select: { formulaCode: true } });
    if (fmlRows.length > 0) {
      const maxFml = Math.max(...fmlRows.map((r) => parseInt(r.formulaCode.slice("PLY-FML-".length), 10)));
      await prisma.numberSequence.updateMany({ where: { entity: "FORMULA" }, data: { next: maxFml + 1 } });
    }

    const crRows = await prisma.changeRequest.findMany({ where: { crNumber: { startsWith: "PLY-CR-" } }, select: { crNumber: true } });
    if (crRows.length > 0) {
      const maxCr = Math.max(...crRows.map((r) => parseInt(r.crNumber.slice("PLY-CR-".length), 10)));
      await prisma.numberSequence.updateMany({ where: { entity: "CHANGE_REQUEST" }, data: { next: maxCr + 1 } });
    }

    // ── FNB container-scoped number sequences ──────────────────────────────
    await prisma.numberSequence.upsert({
      where: { entity: `ITEM_FINISHED_GOOD_${foodContainer.id}` },
      update: { prefix: "FNB-FG-", padding: 4, next: 4 },
      create: { entity: `ITEM_FINISHED_GOOD_${foodContainer.id}`, prefix: "FNB-FG-", padding: 4, next: 4 }
    });
    await prisma.numberSequence.upsert({
      where: { entity: `ITEM_${foodContainer.id}` },
      update: { prefix: "FNB-RM-", padding: 4, next: 23 },
      create: { entity: `ITEM_${foodContainer.id}`, prefix: "FNB-RM-", padding: 4, next: 23 }
    });
    await prisma.numberSequence.upsert({
      where: { entity: `ITEM_PACKAGING_${foodContainer.id}` },
      update: { prefix: "FNB-PKG-", padding: 4, next: 10 },
      create: { entity: `ITEM_PACKAGING_${foodContainer.id}`, prefix: "FNB-PKG-", padding: 4, next: 10 }
    });
    await prisma.numberSequence.upsert({
      where: { entity: `FORMULA_${foodContainer.id}` },
      update: { prefix: "FNB-FML-", padding: 4, next: 4 },
      create: { entity: `FORMULA_${foodContainer.id}`, prefix: "FNB-FML-", padding: 4, next: 4 }
    });
    await prisma.numberSequence.upsert({
      where: { entity: `CHANGE_REQUEST_${foodContainer.id}` },
      update: { prefix: "FNB-CR-", padding: 4, next: 4 },
      create: { entity: `CHANGE_REQUEST_${foodContainer.id}`, prefix: "FNB-CR-", padding: 4, next: 4 }
    });
    await prisma.numberSequence.upsert({
      where: { entity: `ARTWORK_${foodContainer.id}` },
      update: { prefix: "FNB-ART-", padding: 4, next: 4 },
      create: { entity: `ARTWORK_${foodContainer.id}`, prefix: "FNB-ART-", padding: 4, next: 4 }
    });
    await prisma.numberSequence.upsert({
      where: { entity: `DOCUMENT_${foodContainer.id}` },
      update: { prefix: "FNB-DOC-", padding: 4, next: 10 },
      create: { entity: `DOCUMENT_${foodContainer.id}`, prefix: "FNB-DOC-", padding: 4, next: 10 }
    });
    await prisma.numberSequence.upsert({
      where: { entity: `RELEASE_REQUEST_${foodContainer.id}` },
      update: { prefix: "FNB-RR-", padding: 4, next: 4 },
      create: { entity: `RELEASE_REQUEST_${foodContainer.id}`, prefix: "FNB-RR-", padding: 4, next: 4 }
    });
  }

  console.log("Seed complete");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
