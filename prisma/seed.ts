import {
  PrismaClient,
  Industry,
  ItemType,
  FormulaStatus,
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

dotenv.config({ path: rootEnv, override: true });
dotenv.config({ path: backendEnv, override: true });


const prisma = new PrismaClient();

async function main() {
  const seedMode = process.env.SEED_MODE ?? "dev";
  const isDemo = seedMode === "demo";

  if (!isDemo) {
    await prisma.auditLog.deleteMany();
    await prisma.workflowInstance.deleteMany();
    await prisma.specification.deleteMany();
    await prisma.formulaIngredient.deleteMany();
    await prisma.bOMLine.deleteMany();
    await prisma.bOM.deleteMany();
    await prisma.changeRequest.deleteMany();
    await prisma.formula.deleteMany();
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
    update: { name: "Plural Industries" },
    create: { id: "org_demo", name: "Plural Industries" }
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

  await prisma.numberSequence.upsert({ where: { entity: "ITEM" }, update: { prefix: "PLY-RM-", padding: 4, next: 1 }, create: { entity: "ITEM", prefix: "PLY-RM-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "ITEM_FINISHED_GOOD" }, update: { prefix: "PLY-FG-", padding: 4, next: 1 }, create: { entity: "ITEM_FINISHED_GOOD", prefix: "PLY-FG-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "ITEM_PACKAGING" }, update: { prefix: "PLY-PKG-", padding: 4, next: 1 }, create: { entity: "ITEM_PACKAGING", prefix: "PLY-PKG-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "FORMULA" }, update: { prefix: "PLY-FML-", padding: 4, next: 1 }, create: { entity: "FORMULA", prefix: "PLY-FML-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "BOM" }, update: { prefix: "PLY-BOM-", padding: 4, next: 1 }, create: { entity: "BOM", prefix: "PLY-BOM-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "CHANGE_REQUEST" }, update: { prefix: "PLY-CR-", padding: 4, next: 1 }, create: { entity: "CHANGE_REQUEST", prefix: "PLY-CR-", padding: 4, next: 1 } });
  await prisma.numberSequence.upsert({ where: { entity: "DOCUMENT" }, update: { prefix: "PLY-DOC-", padding: 4, next: 1 }, create: { entity: "DOCUMENT", prefix: "PLY-DOC-", padding: 4, next: 1 } });

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
        status: LifecycleStatus.ACTIVE,
        containerId: polymerContainer.id,
        regulatoryFlags: { REACH: true }
      },
      create: {
        itemCode,
        name,
        industryType: Industry.POLYMER,
        itemType: type,
        uom: type === ItemType.PACKAGING ? "ea" : "kg",
        status: LifecycleStatus.ACTIVE,
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
    ["PLY-FML-0001", "PP Injection Molding Compound", FormulaStatus.APPROVED],
    ["PLY-FML-0002", "HDPE Film Compound", FormulaStatus.RELEASED],
    ["PLY-FML-0003", "LLDPE Stretch Film Compound", FormulaStatus.DRAFT],
    ["PLY-FML-0004", "Impact Modified PP Compound", FormulaStatus.IN_REVIEW],
    ["PLY-FML-0005", "UV Stabilized Outdoor Grade", FormulaStatus.APPROVED]
  ] as const;

  for (let idx = 0; idx < formulaDefs.length; idx += 1) {
    const [formulaCode, name, status] = formulaDefs[idx];
    const formula = await prisma.formula.upsert({
      where: { formulaCode_version: { formulaCode, version: 1 } },
      update: {
        name,
        industryType: Industry.POLYMER,
        recipeType: "FORMULA_RECIPE",
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
        recipeType: "FORMULA_RECIPE",
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
        recipeType: "FORMULA_RECIPE",
        containerId: polymerContainer.id,
        status: FormulaStatus.DRAFT,
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
        recipeType: "FORMULA_RECIPE",
        containerId: polymerContainer.id,
        status: FormulaStatus.DRAFT,
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

  // Finished Good Recipe combining formula + packaging
  const finishedGood = await prisma.item.findFirst({
    where: { itemCode: "PLY-FG-0001", revisionMajor: 1, revisionIteration: 1 }
  });
  const packagingItems = await prisma.item.findMany({ where: { itemType: ItemType.PACKAGING, containerId: polymerContainer.id } });
  const fgRecipe = finishedGood
    ? await prisma.formula.upsert({
        where: { formulaCode_version: { formulaCode: "PLY-FML-1000", version: 1 } },
        update: {
          name: "PP Injection Finished Good Recipe",
          industryType: Industry.POLYMER,
          recipeType: "FINISHED_GOOD_RECIPE",
          outputItemId: finishedGood.id,
          containerId: polymerContainer.id,
          status: FormulaStatus.APPROVED,
          ownerId: chemist.id,
          targetYield: 1000,
          yieldUom: "kg",
          batchSize: 1000,
          batchUom: "kg"
        },
        create: {
          formulaCode: "PLY-FML-1000",
          version: 1,
          name: "PP Injection Finished Good Recipe",
          industryType: Industry.POLYMER,
          recipeType: "FINISHED_GOOD_RECIPE",
          outputItemId: finishedGood.id,
          containerId: polymerContainer.id,
          status: FormulaStatus.APPROVED,
          ownerId: chemist.id,
          targetYield: 1000,
          yieldUom: "kg",
          batchSize: 1000,
          batchUom: "kg"
        }
      })
    : null;
  if (fgRecipe && baseFormula && finishedGood) {
    if (!isDemo || (await prisma.formulaIngredient.count({ where: { formulaId: fgRecipe.id } })) === 0) {
      await prisma.formulaIngredient.createMany({
        data: [
          { formulaId: fgRecipe.id, inputFormulaId: baseFormula.id, quantity: 1000, uom: "kg", percentage: 95, additionSequence: 1 },
          ...(packagingItems.slice(0, 2).map((pkg, idx) => ({
            formulaId: fgRecipe.id,
            itemId: pkg.id,
            quantity: idx === 0 ? 40 : 1,
            uom: idx === 0 ? "ea" : "roll",
            percentage: idx === 0 ? 4.5 : 0.5,
            additionSequence: idx + 2
          })) as Array<Record<string, unknown>>)
        ]
      });
    }

    const bom = await prisma.bOM.upsert({
      where: { bomCode_version: { bomCode: finishedGood.itemCode, version: 1 } },
      update: {
        containerId: polymerContainer.id,
        bomType: "FG_BOM",
        parentItemId: finishedGood.id,
        formulaId: fgRecipe.id,
        type: "PRODUCTION"
      },
      create: {
        bomCode: finishedGood.itemCode,
        version: 1,
        containerId: polymerContainer.id,
        bomType: "FG_BOM",
        parentItemId: finishedGood.id,
        formulaId: fgRecipe.id,
        type: "PRODUCTION"
      }
    });
    if (!isDemo || (await prisma.bOMLine.count({ where: { bomId: bom.id } })) === 0) {
      await prisma.bOMLine.createMany({
        data: [
          {
            bomId: bom.id,
            lineNumber: 10,
            inputFormulaId: baseFormula.id,
            quantity: 1000,
            uom: "kg",
            scrapFactor: 0,
            phaseStep: "Compounding",
            operationStep: "Blend",
            referenceDesignator: "FORMULA"
          },
          ...packagingItems.slice(0, 2).map((pkg, idx) => ({
            bomId: bom.id,
            lineNumber: (idx + 2) * 10,
            itemId: pkg.id,
            quantity: idx === 0 ? 1 : 1,
            uom: pkg.uom ?? "ea",
            scrapFactor: 0,
            phaseStep: "Packaging",
            operationStep: idx === 0 ? "Bagging" : "Wrapping",
            referenceDesignator: idx === 0 ? "PKG-BAG" : "PKG-WRAP"
          }))
        ]
      });
    }
  }

  const intermediateFormula = await prisma.formula.findUnique({ where: { formulaCode_version: { formulaCode: "PLY-FML-0100", version: 1 } } });
  const formulas = await prisma.formula.findMany({ where: { containerId: polymerContainer.id, recipeType: "FORMULA_RECIPE" }, take: 3, orderBy: { formulaCode: "asc" } });
  for (let i = 0; i < formulas.length; i += 1) {
    const formula = formulas[i];
    if (!formula) {
      continue;
    }
    const bom = await prisma.bOM.upsert({
      where: { bomCode_version: { bomCode: formula.formulaCode, version: 1 } },
      update: {
        containerId: polymerContainer.id,
        bomType: "FML_BOM",
        formulaId: formula.id,
        type: "PRODUCTION"
      },
      create: {
        bomCode: formula.formulaCode,
        version: 1,
        containerId: polymerContainer.id,
        bomType: "FML_BOM",
        formulaId: formula.id,
        type: "PRODUCTION"
      }
    });
    if (!isDemo || (await prisma.bOMLine.count({ where: { bomId: bom.id } })) === 0) {
      await prisma.bOMLine.createMany({
        data: [
          { bomId: bom.id, itemId: ingredients[0]?.id ?? "", quantity: 700, uom: "kg", lineNumber: 10 },
          { bomId: bom.id, itemId: ingredients[1]?.id ?? "", quantity: 200, uom: "kg", lineNumber: 20 },
          ...(intermediateFormula ? [{ bomId: bom.id, inputFormulaId: intermediateFormula.id, quantity: 100, uom: "kg", lineNumber: 30 }] : [])
        ].filter((line) => line.itemId || line.inputFormulaId)
      });
    }
  }

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
      containerId: foodContainer.id,
      name: "Food Container Admin",
      description: "Full administration for food container",
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

  const foodItems = [
    ["FNB-RM-0001", "Whole Milk"],
    ["FNB-RM-0002", "Cocoa Powder"],
    ["FNB-RM-0003", "Cane Sugar"],
    ["FNB-RM-0004", "Vanilla Extract"],
    ["FNB-RM-0005", "Stabilizer Blend"],
    ["FNB-RM-0006", "Salt"],
    ["FNB-PKG-0001", "PET Bottle 500ml"],
    ["FNB-PKG-0002", "HDPE Cap 28mm"],
    ["FNB-PKG-0003", "Shrink Sleeve Label"],
    ["FNB-PKG-0004", "Corrugated Carton 12-pack"],
    ["FNB-FG-0001", "Chocolate Milk 500ml"]
  ] as const;

  for (const [itemCode, name] of foodItems) {
    const type = itemCode.includes("FNB-FG")
      ? ItemType.FINISHED_GOOD
      : itemCode.includes("FNB-PKG")
        ? ItemType.PACKAGING
        : ItemType.RAW_MATERIAL;

    await prisma.item.upsert({
      where: {
        itemCode_revisionMajor_revisionIteration: { itemCode, revisionMajor: 1, revisionIteration: 1 }
      },
      update: {
        name,
        industryType: Industry.FOOD_BEVERAGE,
        itemType: type,
        uom: type === ItemType.PACKAGING ? "ea" : "kg",
        status: LifecycleStatus.ACTIVE,
        containerId: foodContainer.id,
        regulatoryFlags: { FDA: true },
        attributes: type === ItemType.RAW_MATERIAL ? { allergens: name.includes("Milk") ? ["MILK"] : [] } : undefined
      },
      create: {
        itemCode,
        name,
        industryType: Industry.FOOD_BEVERAGE,
        itemType: type,
        uom: type === ItemType.PACKAGING ? "ea" : "kg",
        status: LifecycleStatus.ACTIVE,
        containerId: foodContainer.id,
        regulatoryFlags: { FDA: true },
        attributes: type === ItemType.RAW_MATERIAL ? { allergens: name.includes("Milk") ? ["MILK"] : [] } : undefined
      }
    });
  }

  const foodRawItems = await prisma.item.findMany({
    where: { containerId: foodContainer.id, itemType: ItemType.RAW_MATERIAL }
  });
  for (const item of foodRawItems) {
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
          containerId: foodContainer.id,
          specType: "MICROBIO",
          attribute: "Total Plate Count",
          maxValue: 1000,
          uom: "cfu/g",
          testMethod: "ISO 4833"
        },
        {
          itemId: item.id,
          containerId: foodContainer.id,
          specType: "MICROBIO",
          attribute: "Yeast & Mold",
          maxValue: 100,
          uom: "cfu/g",
          testMethod: "ISO 21527"
        },
        {
          itemId: item.id,
          containerId: foodContainer.id,
          specType: "ALLERGEN",
          attribute: "Allergen Statement",
          value: item.name.includes("Milk") ? "Contains Milk" : "None declared",
          testMethod: "Specification Review"
        },
        {
          itemId: item.id,
          containerId: foodContainer.id,
          specType: "SENSORY",
          attribute: "Appearance",
          value: "Typical",
          testMethod: "Sensory"
        },
        {
          itemId: item.id,
          containerId: foodContainer.id,
          specType: "NUTRITION",
          attribute: "Calories",
          maxValue: 450,
          uom: "kcal",
          testMethod: "Calculation"
        }
      ],
      skipDuplicates: true
    });
  }

  const foodChemist = await prisma.user.findUniqueOrThrow({ where: { email: "chemist@plm.local" } });
  const foodIngredients = await prisma.item.findMany({
    where: { containerId: foodContainer.id, itemType: ItemType.RAW_MATERIAL },
    orderBy: { itemCode: "asc" }
  });

  const foodBaseFormula = await prisma.formula.upsert({
    where: { formulaCode_version: { formulaCode: "FNB-FML-0001", version: 1 } },
    update: {
      name: "Chocolate Milk Base",
      industryType: Industry.FOOD_BEVERAGE,
      recipeType: "FORMULA_RECIPE",
      containerId: foodContainer.id,
      status: FormulaStatus.APPROVED,
      ownerId: foodChemist.id,
      targetYield: 1000,
      yieldUom: "kg",
      batchSize: 1000,
      batchUom: "kg"
    },
    create: {
      formulaCode: "FNB-FML-0001",
      version: 1,
      name: "Chocolate Milk Base",
      industryType: Industry.FOOD_BEVERAGE,
      recipeType: "FORMULA_RECIPE",
      containerId: foodContainer.id,
      status: FormulaStatus.APPROVED,
      ownerId: foodChemist.id,
      targetYield: 1000,
      yieldUom: "kg",
      batchSize: 1000,
      batchUom: "kg"
    }
  });

  if (!isDemo || (await prisma.specification.count({ where: { formulaId: foodBaseFormula.id } })) === 0) {
    await prisma.specification.createMany({
      data: [
        {
          formulaId: foodBaseFormula.id,
          containerId: foodContainer.id,
          specType: "NUTRITION",
          attribute: "Calories",
          maxValue: 80,
          uom: "kcal",
          testMethod: "Calculation"
        },
        {
          formulaId: foodBaseFormula.id,
          containerId: foodContainer.id,
          specType: "NUTRITION",
          attribute: "Protein",
          minValue: 3,
          uom: "g",
          testMethod: "Calculation"
        },
        {
          formulaId: foodBaseFormula.id,
          containerId: foodContainer.id,
          specType: "NUTRITION",
          attribute: "Total Fat",
          maxValue: 4,
          uom: "g",
          testMethod: "Calculation"
        },
        {
          formulaId: foodBaseFormula.id,
          containerId: foodContainer.id,
          specType: "ALLERGEN",
          attribute: "Allergen Statement",
          value: "Contains Milk",
          testMethod: "Specification Review"
        }
      ],
      skipDuplicates: true
    });
  }

  if (!isDemo || (await prisma.formulaIngredient.count({ where: { formulaId: foodBaseFormula.id } })) === 0) {
    await prisma.formulaIngredient.createMany({
      data: [
        { formulaId: foodBaseFormula.id, itemId: foodIngredients[0]?.id, quantity: 650, uom: "kg", percentage: 65, additionSequence: 1 },
        { formulaId: foodBaseFormula.id, itemId: foodIngredients[1]?.id, quantity: 120, uom: "kg", percentage: 12, additionSequence: 2 },
        { formulaId: foodBaseFormula.id, itemId: foodIngredients[2]?.id, quantity: 200, uom: "kg", percentage: 20, additionSequence: 3 },
        { formulaId: foodBaseFormula.id, itemId: foodIngredients[3]?.id, quantity: 10, uom: "kg", percentage: 1, additionSequence: 4 },
        { formulaId: foodBaseFormula.id, itemId: foodIngredients[4]?.id, quantity: 20, uom: "kg", percentage: 2, additionSequence: 5 }
      ].filter((line) => line.itemId)
    });
  }

  const foodFg = await prisma.item.findFirst({
    where: { itemCode: "FNB-FG-0001", containerId: foodContainer.id }
  });
  const foodPackaging = await prisma.item.findMany({
    where: { containerId: foodContainer.id, itemType: ItemType.PACKAGING }
  });

  const foodFinishedRecipe =
    foodFg &&
    (await prisma.formula.upsert({
      where: { formulaCode_version: { formulaCode: "FNB-FML-1000", version: 1 } },
      update: {
        name: "Chocolate Milk Finished Good Recipe",
        industryType: Industry.FOOD_BEVERAGE,
        recipeType: "FINISHED_GOOD_RECIPE",
        outputItemId: foodFg.id,
        containerId: foodContainer.id,
        status: FormulaStatus.APPROVED,
        ownerId: foodChemist.id,
        targetYield: 1000,
        yieldUom: "kg",
        batchSize: 1000,
        batchUom: "kg"
      },
      create: {
        formulaCode: "FNB-FML-1000",
        version: 1,
        name: "Chocolate Milk Finished Good Recipe",
        industryType: Industry.FOOD_BEVERAGE,
        recipeType: "FINISHED_GOOD_RECIPE",
        outputItemId: foodFg.id,
        containerId: foodContainer.id,
        status: FormulaStatus.APPROVED,
        ownerId: foodChemist.id,
        targetYield: 1000,
        yieldUom: "kg",
        batchSize: 1000,
        batchUom: "kg"
      }
    }));

  if (foodFinishedRecipe && foodFg) {
    if (!isDemo || (await prisma.formulaIngredient.count({ where: { formulaId: foodFinishedRecipe.id } })) === 0) {
      await prisma.formulaIngredient.createMany({
        data: [
          { formulaId: foodFinishedRecipe.id, inputFormulaId: foodBaseFormula.id, quantity: 1000, uom: "kg", percentage: 95, additionSequence: 1 },
          ...(foodPackaging.slice(0, 3).map((pkg, idx) => ({
            formulaId: foodFinishedRecipe.id,
            itemId: pkg.id,
            quantity: idx === 0 ? 1 : 1,
            uom: "ea",
            percentage: idx === 0 ? 3 : 1,
            additionSequence: idx + 2
          })) as Array<Record<string, unknown>>)
        ]
      });
    }

    const bom = await prisma.bOM.upsert({
      where: { bomCode_version: { bomCode: foodFg.itemCode, version: 1 } },
      update: {
        containerId: foodContainer.id,
        bomType: "FG_BOM",
        parentItemId: foodFg.id,
        formulaId: foodFinishedRecipe.id,
        type: "PRODUCTION"
      },
      create: {
        bomCode: foodFg.itemCode,
        version: 1,
        containerId: foodContainer.id,
        bomType: "FG_BOM",
        parentItemId: foodFg.id,
        formulaId: foodFinishedRecipe.id,
        type: "PRODUCTION"
      }
    });
    if (!isDemo || (await prisma.bOMLine.count({ where: { bomId: bom.id } })) === 0) {
      await prisma.bOMLine.createMany({
        data: [
          {
            bomId: bom.id,
            lineNumber: 10,
            inputFormulaId: foodBaseFormula.id,
            quantity: 1000,
            uom: "kg",
            scrapFactor: 0,
            phaseStep: "Blending",
            operationStep: "Mix",
            referenceDesignator: "FORMULA"
          },
          ...foodPackaging.slice(0, 3).map((pkg, idx) => ({
            bomId: bom.id,
            lineNumber: (idx + 2) * 10,
            itemId: pkg.id,
            quantity: 1,
            uom: "ea",
            scrapFactor: 0,
            phaseStep: "Packaging",
            operationStep: "Fill/Seal",
            referenceDesignator: idx === 0 ? "PKG-BOTTLE" : idx === 1 ? "PKG-CAP" : "PKG-LABEL"
          }))
        ]
      });
    }
  }

  const requester = await prisma.user.findUniqueOrThrow({ where: { email: "plm@plm.local" } });
  await prisma.changeRequest.upsert({
    where: { crNumber: "PLY-CR-1001" },
    update: {
      title: "Reduce MFI drift in PP grade",
      type: ChangeType.ECR,
      priority: ChangePriority.HIGH,
      containerId: polymerContainer.id,
      status: ChangeStatus.SUBMITTED,
      requestedById: requester.id,
      affectedItems: ["PLY-RM-0003"],
      affectedFormulas: ["PLY-FML-0001"],
      impactAssessment: "Need alternate antioxidant package and process window validation"
    },
    create: {
      crNumber: "PLY-CR-1001",
      title: "Reduce MFI drift in PP grade",
      type: ChangeType.ECR,
      priority: ChangePriority.HIGH,
      containerId: polymerContainer.id,
      status: ChangeStatus.SUBMITTED,
      requestedById: requester.id,
      affectedItems: ["PLY-RM-0003"],
      affectedFormulas: ["PLY-FML-0001"],
      impactAssessment: "Need alternate antioxidant package and process window validation"
    }
  });
  await prisma.changeRequest.upsert({
    where: { crNumber: "PLY-CR-1002" },
    update: {
      title: "Packaging bag spec upgrade",
      type: ChangeType.ECO,
      priority: ChangePriority.MEDIUM,
      containerId: polymerContainer.id,
      status: ChangeStatus.UNDER_REVIEW,
      requestedById: requester.id,
      affectedItems: ["PLY-PKG-0001"],
      affectedFormulas: ["PLY-FML-0002"],
      impactAssessment: "Update tensile and puncture performance requirements"
    },
    create: {
      crNumber: "PLY-CR-1002",
      title: "Packaging bag spec upgrade",
      type: ChangeType.ECO,
      priority: ChangePriority.MEDIUM,
      containerId: polymerContainer.id,
      status: ChangeStatus.UNDER_REVIEW,
      requestedById: requester.id,
      affectedItems: ["PLY-PKG-0001"],
      affectedFormulas: ["PLY-FML-0002"],
      impactAssessment: "Update tensile and puncture performance requirements"
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
        states: ["DRAFT", "REVIEW", "QA_REVIEW", "REG_REVIEW", "APPROVED", "RELEASED"],
        transitions: [
          { from: "DRAFT", to: "REVIEW", action: "SUBMIT" },
          { from: "REVIEW", to: "QA_REVIEW", action: "APPROVE" },
          { from: "QA_REVIEW", to: "REG_REVIEW", action: "APPROVE" },
          { from: "REG_REVIEW", to: "APPROVED", action: "APPROVE" }
        ]
      },
      {
        name: "Change Management",
        industry: Industry.POLYMER,
        entityType: "CHANGE_REQUEST",
        states: ["NEW", "ASSESSMENT", "REVIEW", "APPROVAL", "IMPLEMENTATION"],
        transitions: [
          { from: "NEW", to: "ASSESSMENT", action: "SUBMIT" },
          { from: "ASSESSMENT", to: "REVIEW", action: "FORWARD" },
          { from: "REVIEW", to: "APPROVAL", action: "RECOMMEND" }
        ]
      },
      {
        name: "Release Management",
        industry: Industry.POLYMER,
        entityType: "RELEASE_REQUEST",
        states: ["NEW", "REVIEW", "APPROVAL", "RELEASED"],
        transitions: [
          { from: "NEW", to: "REVIEW", action: "SUBMIT" },
          { from: "REVIEW", to: "APPROVAL", action: "APPROVE" },
          { from: "APPROVAL", to: "RELEASED", action: "RELEASE" }
        ]
      },
      {
        name: "Formula Approval",
        industry: Industry.FOOD_BEVERAGE,
        entityType: "FORMULA",
        states: ["DRAFT", "REVIEW", "QA_REVIEW", "REG_REVIEW", "APPROVED"],
        transitions: [
          { from: "DRAFT", to: "REVIEW", action: "SUBMIT" },
          { from: "REVIEW", to: "QA_REVIEW", action: "APPROVE" },
          { from: "QA_REVIEW", to: "REG_REVIEW", action: "APPROVE" },
          { from: "REG_REVIEW", to: "APPROVED", action: "APPROVE" }
        ]
      },
      {
        name: "Change Management",
        industry: Industry.FOOD_BEVERAGE,
        entityType: "CHANGE_REQUEST",
        states: ["NEW", "ASSESSMENT", "REVIEW", "APPROVAL", "IMPLEMENTATION"],
        transitions: [
          { from: "NEW", to: "ASSESSMENT", action: "SUBMIT" },
          { from: "ASSESSMENT", to: "REVIEW", action: "FORWARD" },
          { from: "REVIEW", to: "APPROVAL", action: "RECOMMEND" }
        ]
      },
      {
        name: "Release Management",
        industry: Industry.FOOD_BEVERAGE,
        entityType: "RELEASE_REQUEST",
        states: ["NEW", "REVIEW", "APPROVAL", "RELEASED"],
        transitions: [
          { from: "NEW", to: "REVIEW", action: "SUBMIT" },
          { from: "REVIEW", to: "APPROVAL", action: "APPROVE" },
          { from: "APPROVAL", to: "RELEASED", action: "RELEASE" }
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
