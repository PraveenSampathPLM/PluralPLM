import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "./prisma.js";

export type ConfigEntity = "ITEM" | "ITEM_FINISHED_GOOD" | "ITEM_PACKAGING" | "FORMULA" | "BOM" | "CHANGE_REQUEST" | "RELEASE_REQUEST" | "DOCUMENT" | "ARTWORK";
export type AttributeEntity = "ITEM";
export type RevisionEntity = "ITEM" | "FORMULA" | "BOM";
export type ListEntity = "ITEM" | "FORMULA" | "BOM" | "CHANGE_REQUEST" | "RELEASE_REQUEST" | "SPECIFICATION";

export interface NumberSequence {
  prefix: string;
  padding: number;
  next: number;
}

export interface AttributeDefinition {
  key: string;
  label: string;
  type: "text" | "number" | "boolean";
  required: boolean;
}

export interface RevisionScheme {
  style: "NUMERIC" | "ALPHA_NUMERIC";
  delimiter: string;
}

export interface UomDefinition {
  value: string;
  label: string;
  category: string;
}

export interface SpecTemplateAttribute {
  key: string;
  defaultUom?: string;
  defaultTestMethod?: string;
  valueKind?: "RANGE" | "TEXT";
}

export interface SpecTemplate {
  specType: string;
  label: string;
  attributes: SpecTemplateAttribute[];
}

export type SpecTemplateMap = Record<string, SpecTemplate[]>;

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

interface AppConfigData {
  numberSequences: Record<ConfigEntity, NumberSequence>;
  attributeDefinitions: Record<AttributeEntity, AttributeDefinition[]>;
  revisionSchemes: Record<RevisionEntity, RevisionScheme>;
  listColumns: Record<ListEntity, string[]>;
  uoms: UomDefinition[];
  specTemplates: SpecTemplateMap;
  mail: MailConfig;
}

interface StoredConfigData {
  attributeDefinitions?: Record<AttributeEntity, AttributeDefinition[]>;
  revisionSchemes?: Record<RevisionEntity, RevisionScheme>;
  listColumns?: Record<ListEntity, string[]>;
  uoms?: UomDefinition[];
  specTemplates?: SpecTemplateMap;
  mail?: MailConfig;
}

const configPath = path.resolve(process.cwd(), "storage", "config.json");

const defaultConfig: AppConfigData = {
  numberSequences: {
    ITEM: { prefix: "CH-RM-", padding: 4, next: 1 },
    ITEM_FINISHED_GOOD: { prefix: "CH-FG-", padding: 4, next: 1 },
    ITEM_PACKAGING: { prefix: "CH-PKG-", padding: 4, next: 1 },
    FORMULA: { prefix: "CH-FML-", padding: 4, next: 1 },
    BOM: { prefix: "CH-BOM-", padding: 4, next: 1 },
    CHANGE_REQUEST: { prefix: "CH-CR-", padding: 4, next: 1 },
    RELEASE_REQUEST: { prefix: "CH-RR-", padding: 4, next: 1 },
    DOCUMENT: { prefix: "CH-DOC-", padding: 4, next: 1 },
    ARTWORK: { prefix: "CH-ART-", padding: 4, next: 1 }
  },
  attributeDefinitions: {
    ITEM: [
      { key: "casNumber", label: "CAS Number", type: "text", required: false },
      { key: "grade", label: "Grade/Specification", type: "text", required: false },
      { key: "supplier", label: "Preferred Supplier", type: "text", required: false },
      { key: "reach", label: "REACH Registered", type: "boolean", required: false },
      { key: "vocContent", label: "VOC Content (%)", type: "number", required: false },
      { key: "viscosity", label: "Viscosity (cP)", type: "number", required: false },
      { key: "density", label: "Density (g/cc)", type: "number", required: false },
      { key: "color", label: "Color/Appearance", type: "text", required: false }
    ]
  },
  revisionSchemes: {
    ITEM: { style: "NUMERIC", delimiter: "." },
    FORMULA: { style: "NUMERIC", delimiter: "." },
    BOM: { style: "NUMERIC", delimiter: "." }
  },
  listColumns: {
    ITEM: ["itemCode", "revisionLabel", "name", "status"],
    FORMULA: ["formulaCode", "revisionLabel", "name", "status"],
    BOM: ["bomCode", "revisionLabel", "type", "status", "effectiveDate"],
    CHANGE_REQUEST: ["crNumber", "title", "type", "priority", "status"],
    RELEASE_REQUEST: ["rrNumber", "title", "status"],
    SPECIFICATION: ["specType", "attribute", "value", "minValue", "maxValue", "uom", "testMethod"]
  },
  uoms: [
    { value: "kg", label: "Kilogram (kg)", category: "Mass" },
    { value: "g", label: "Gram (g)", category: "Mass" },
    { value: "mg", label: "Milligram (mg)", category: "Mass" },
    { value: "lb", label: "Pound (lb)", category: "Mass" },
    { value: "ton", label: "Metric Ton (t)", category: "Mass" },
    { value: "l", label: "Litre (L)", category: "Volume" },
    { value: "ml", label: "Millilitre (mL)", category: "Volume" },
    { value: "m3", label: "Cubic Meter (m3)", category: "Volume" },
    { value: "gal", label: "Gallon (gal)", category: "Volume" },
    { value: "ea", label: "Each (ea)", category: "Count" },
    { value: "box", label: "Box (box)", category: "Count" },
    { value: "bag", label: "Bag (bag)", category: "Count" },
    { value: "drum", label: "Drum (drum)", category: "Packaging" },
    { value: "pallet", label: "Pallet (plt)", category: "Packaging" }
  ],
  specTemplates: {
    POLYMER: [
      {
        specType: "CHEMICAL",
        label: "Chemical Properties",
        attributes: [
          { key: "Purity", defaultUom: "%", defaultTestMethod: "GC", valueKind: "RANGE" },
          { key: "Specific Gravity", defaultUom: "", defaultTestMethod: "ASTM D4052", valueKind: "RANGE" },
          { key: "Moisture", defaultUom: "%", defaultTestMethod: "Karl Fischer", valueKind: "RANGE" },
          { key: "Viscosity", defaultUom: "cP", defaultTestMethod: "Brookfield", valueKind: "RANGE" },
          { key: "pH", defaultUom: "", defaultTestMethod: "ASTM E70", valueKind: "RANGE" }
        ]
      },
      {
        specType: "APPEARANCE",
        label: "Appearance and Color",
        attributes: [
          { key: "Color (APHA)", defaultUom: "APHA", defaultTestMethod: "ASTM D1209", valueKind: "RANGE" },
          { key: "Appearance", defaultUom: "", defaultTestMethod: "Visual", valueKind: "TEXT" },
          { key: "Odor", defaultUom: "", defaultTestMethod: "Sensory", valueKind: "TEXT" }
        ]
      },
      {
        specType: "SAFETY",
        label: "Safety and Handling",
        attributes: [
          { key: "Flash Point", defaultUom: "degC", defaultTestMethod: "ASTM D93", valueKind: "RANGE" },
          { key: "Boiling Point", defaultUom: "degC", defaultTestMethod: "ASTM D1120", valueKind: "RANGE" },
          { key: "GHS Classification", defaultUom: "", defaultTestMethod: "SDS Review", valueKind: "TEXT" }
        ]
      },
      {
        specType: "REGULATORY",
        label: "Regulatory",
        attributes: [
          { key: "REACH Compliance", defaultUom: "", defaultTestMethod: "Regulatory Review", valueKind: "TEXT" },
          { key: "CAS Number", defaultUom: "", defaultTestMethod: "Document Check", valueKind: "TEXT" },
          { key: "VOC Content", defaultUom: "%", defaultTestMethod: "EPA 24", valueKind: "RANGE" }
        ]
      },
      {
        specType: "PERFORMANCE",
        label: "Performance",
        attributes: [
          { key: "Shelf Life", defaultUom: "months", defaultTestMethod: "Stability Study", valueKind: "RANGE" },
          { key: "Active Content", defaultUom: "%", defaultTestMethod: "Titration", valueKind: "RANGE" }
        ]
      },
      {
        specType: "PHYSICAL",
        label: "Physical",
        attributes: [
          { key: "Density", defaultUom: "g/cm3", defaultTestMethod: "ASTM D4052", valueKind: "RANGE" },
          { key: "Particle Size", defaultUom: "micron", defaultTestMethod: "Laser Diffraction", valueKind: "RANGE" }
        ]
      },
      {
        specType: "PACKAGING",
        label: "Packaging",
        attributes: [
          { key: "Container Type", defaultUom: "", defaultTestMethod: "Visual", valueKind: "TEXT" },
          { key: "Net Weight", defaultUom: "kg", defaultTestMethod: "Scale", valueKind: "RANGE" }
        ]
      }
    ],
    CHEMICAL: [
      {
        specType: "CHEMICAL",
        label: "Chemical Properties",
        attributes: [
          { key: "Purity", defaultUom: "%", defaultTestMethod: "GC", valueKind: "RANGE" },
          { key: "Specific Gravity", defaultUom: "", defaultTestMethod: "ASTM D4052", valueKind: "RANGE" },
          { key: "Moisture", defaultUom: "%", defaultTestMethod: "Karl Fischer", valueKind: "RANGE" },
          { key: "Viscosity", defaultUom: "cP", defaultTestMethod: "Brookfield", valueKind: "RANGE" },
          { key: "pH", defaultUom: "", defaultTestMethod: "ASTM E70", valueKind: "RANGE" }
        ]
      },
      {
        specType: "APPEARANCE",
        label: "Appearance and Color",
        attributes: [
          { key: "Color (APHA)", defaultUom: "APHA", defaultTestMethod: "ASTM D1209", valueKind: "RANGE" },
          { key: "Appearance", defaultUom: "", defaultTestMethod: "Visual", valueKind: "TEXT" },
          { key: "Odor", defaultUom: "", defaultTestMethod: "Sensory", valueKind: "TEXT" }
        ]
      },
      {
        specType: "SAFETY",
        label: "Safety and Handling",
        attributes: [
          { key: "Flash Point", defaultUom: "degC", defaultTestMethod: "ASTM D93", valueKind: "RANGE" },
          { key: "Boiling Point", defaultUom: "degC", defaultTestMethod: "ASTM D1120", valueKind: "RANGE" },
          { key: "GHS Classification", defaultUom: "", defaultTestMethod: "SDS Review", valueKind: "TEXT" }
        ]
      },
      {
        specType: "REGULATORY",
        label: "Regulatory",
        attributes: [
          { key: "REACH Compliance", defaultUom: "", defaultTestMethod: "Regulatory Review", valueKind: "TEXT" },
          { key: "CAS Number", defaultUom: "", defaultTestMethod: "Document Check", valueKind: "TEXT" },
          { key: "VOC Content", defaultUom: "%", defaultTestMethod: "EPA 24", valueKind: "RANGE" }
        ]
      },
      {
        specType: "PERFORMANCE",
        label: "Performance",
        attributes: [
          { key: "Shelf Life", defaultUom: "months", defaultTestMethod: "Stability Study", valueKind: "RANGE" },
          { key: "Active Content", defaultUom: "%", defaultTestMethod: "Titration", valueKind: "RANGE" }
        ]
      },
      {
        specType: "PHYSICAL",
        label: "Physical",
        attributes: [
          { key: "Density", defaultUom: "g/cm3", defaultTestMethod: "ASTM D4052", valueKind: "RANGE" },
          { key: "Particle Size", defaultUom: "micron", defaultTestMethod: "Laser Diffraction", valueKind: "RANGE" }
        ]
      },
      {
        specType: "PACKAGING",
        label: "Packaging",
        attributes: [
          { key: "Container Type", defaultUom: "", defaultTestMethod: "Visual", valueKind: "TEXT" },
          { key: "Net Weight", defaultUom: "kg", defaultTestMethod: "Scale", valueKind: "RANGE" }
        ]
      }
    ],
    FOOD_BEVERAGE: [
      {
        specType: "NUTRITION",
        label: "Nutrition Facts",
        attributes: [
          { key: "Calories", defaultUom: "kcal", valueKind: "RANGE" },
          { key: "Protein", defaultUom: "g", valueKind: "RANGE" },
          { key: "Total Fat", defaultUom: "g", valueKind: "RANGE" },
          { key: "Saturated Fat", defaultUom: "g", valueKind: "RANGE" },
          { key: "Carbohydrates", defaultUom: "g", valueKind: "RANGE" },
          { key: "Sugars", defaultUom: "g", valueKind: "RANGE" },
          { key: "Sodium", defaultUom: "mg", valueKind: "RANGE" }
        ]
      },
      {
        specType: "MICROBIO",
        label: "Microbiological",
        attributes: [
          { key: "Total Plate Count", defaultUom: "cfu/g", valueKind: "RANGE" },
          { key: "Yeast & Mold", defaultUom: "cfu/g", valueKind: "RANGE" },
          { key: "Coliform", defaultUom: "cfu/g", valueKind: "RANGE" }
        ]
      },
      {
        specType: "ALLERGEN",
        label: "Allergen",
        attributes: [
          { key: "Contains Milk", valueKind: "TEXT" },
          { key: "Contains Soy", valueKind: "TEXT" },
          { key: "Contains Nuts", valueKind: "TEXT" }
        ]
      },
      {
        specType: "SENSORY",
        label: "Sensory",
        attributes: [
          { key: "Appearance", valueKind: "TEXT" },
          { key: "Odor", valueKind: "TEXT" },
          { key: "Taste", valueKind: "TEXT" }
        ]
      },
      {
        specType: "PHYSICAL",
        label: "Physical",
        attributes: [
          { key: "Moisture", defaultUom: "%", valueKind: "RANGE" },
          { key: "Water Activity", defaultUom: "aw", valueKind: "RANGE" },
          { key: "pH", defaultUom: "", valueKind: "RANGE" }
        ]
      },
      {
        specType: "REGULATORY",
        label: "Regulatory",
        attributes: [
          { key: "FSSAI", valueKind: "TEXT" },
          { key: "FDA", valueKind: "TEXT" }
        ]
      },
      {
        specType: "PACKAGING",
        label: "Packaging",
        attributes: [
          { key: "Pack Size", defaultUom: "g", valueKind: "RANGE" },
          { key: "Shelf Life", defaultUom: "days", valueKind: "RANGE" }
        ]
      }
    ],
    CPG: [
      {
        specType: "PHYSICAL",
        label: "Physical Properties",
        attributes: [
          { key: "Appearance", defaultUom: "", defaultTestMethod: "Visual", valueKind: "TEXT" },
          { key: "Color (Gardner)", defaultUom: "Gardner", defaultTestMethod: "ASTM D1544", valueKind: "RANGE" },
          { key: "Specific Gravity", defaultUom: "g/cm3", defaultTestMethod: "ASTM D1298", valueKind: "RANGE" },
          { key: "Viscosity", defaultUom: "cP", defaultTestMethod: "Brookfield", valueKind: "RANGE" },
          { key: "pH (1% Solution)", defaultUom: "", defaultTestMethod: "ASTM E70", valueKind: "RANGE" },
          { key: "Moisture", defaultUom: "%", defaultTestMethod: "Karl Fischer", valueKind: "RANGE" }
        ]
      },
      {
        specType: "CHEMICAL",
        label: "Chemical Properties",
        attributes: [
          { key: "Active Content", defaultUom: "%", defaultTestMethod: "Titration", valueKind: "RANGE" },
          { key: "Purity", defaultUom: "%", defaultTestMethod: "GC", valueKind: "RANGE" },
          { key: "Unsaponifiables", defaultUom: "%", defaultTestMethod: "ISO 3596", valueKind: "RANGE" },
          { key: "Hydroxyl Value", defaultUom: "mg KOH/g", defaultTestMethod: "ISO 4629", valueKind: "RANGE" }
        ]
      },
      {
        specType: "MICROBIO",
        label: "Microbiological",
        attributes: [
          { key: "Total Aerobic Count", defaultUom: "cfu/g", defaultTestMethod: "ISO 21149", valueKind: "RANGE" },
          { key: "Yeast & Mold", defaultUom: "cfu/g", defaultTestMethod: "ISO 16212", valueKind: "RANGE" },
          { key: "Staphylococcus aureus", defaultUom: "cfu/g", defaultTestMethod: "ISO 22718", valueKind: "TEXT" }
        ]
      },
      {
        specType: "SAFETY",
        label: "Safety & Toxicology",
        attributes: [
          { key: "Flash Point", defaultUom: "degC", defaultTestMethod: "ASTM D93", valueKind: "RANGE" },
          { key: "GHS Classification", defaultUom: "", defaultTestMethod: "SDS Review", valueKind: "TEXT" },
          { key: "Dermatologically Tested", defaultUom: "", defaultTestMethod: "Patch Test", valueKind: "TEXT" }
        ]
      },
      {
        specType: "REGULATORY",
        label: "Regulatory Compliance",
        attributes: [
          { key: "EU Cosmetics Reg 1223/2009", defaultUom: "", defaultTestMethod: "Regulatory Review", valueKind: "TEXT" },
          { key: "INCI Name", defaultUom: "", defaultTestMethod: "PCPC Database", valueKind: "TEXT" },
          { key: "COSMOS / ECOCERT Status", defaultUom: "", defaultTestMethod: "Certification Review", valueKind: "TEXT" }
        ]
      },
      {
        specType: "PACKAGING",
        label: "Packaging",
        attributes: [
          { key: "Container Type", defaultUom: "", defaultTestMethod: "Visual", valueKind: "TEXT" },
          { key: "Net Weight", defaultUom: "kg", defaultTestMethod: "Scale", valueKind: "RANGE" },
          { key: "Shelf Life", defaultUom: "months", defaultTestMethod: "Stability Study", valueKind: "RANGE" }
        ]
      }
    ],
    TYRE: [
      {
        specType: "PHYSICAL",
        label: "Physical Properties",
        attributes: [
          { key: "Mooney Viscosity (ML 1+4 at 100°C)", defaultUom: "MU", defaultTestMethod: "ASTM D1646", valueKind: "RANGE" },
          { key: "Specific Gravity", defaultUom: "g/cm3", defaultTestMethod: "ASTM D792", valueKind: "RANGE" },
          { key: "Ash Content", defaultUom: "%", defaultTestMethod: "ASTM D1416", valueKind: "RANGE" },
          { key: "Volatile Content", defaultUom: "%", defaultTestMethod: "ASTM D1416", valueKind: "RANGE" },
          { key: "Tensile Strength (cured)", defaultUom: "MPa", defaultTestMethod: "ISO 37", valueKind: "RANGE" },
          { key: "Elongation at Break (cured)", defaultUom: "%", defaultTestMethod: "ISO 37", valueKind: "RANGE" }
        ]
      },
      {
        specType: "CHEMICAL",
        label: "Chemical Properties",
        attributes: [
          { key: "Polymer Content", defaultUom: "%", defaultTestMethod: "Pyrolysis GC", valueKind: "RANGE" },
          { key: "Sulfur Content", defaultUom: "%", defaultTestMethod: "ASTM D4578", valueKind: "RANGE" },
          { key: "Chlorine Content", defaultUom: "ppm", defaultTestMethod: "AOX", valueKind: "RANGE" },
          { key: "pH (Water Extract)", defaultUom: "", defaultTestMethod: "ASTM E70", valueKind: "RANGE" }
        ]
      },
      {
        specType: "PERFORMANCE",
        label: "Cure & Performance",
        attributes: [
          { key: "Mooney Scorch (t5 at 125°C)", defaultUom: "min", defaultTestMethod: "ASTM D1646", valueKind: "RANGE" },
          { key: "Cure Rate Index (CRI)", defaultUom: "", defaultTestMethod: "MDR", valueKind: "RANGE" },
          { key: "Minimum Torque (ML)", defaultUom: "dNm", defaultTestMethod: "ASTM D5289", valueKind: "RANGE" },
          { key: "Maximum Torque (MH)", defaultUom: "dNm", defaultTestMethod: "ASTM D5289", valueKind: "RANGE" }
        ]
      },
      {
        specType: "SAFETY",
        label: "Safety & Handling",
        attributes: [
          { key: "Flash Point", defaultUom: "degC", defaultTestMethod: "ASTM D93", valueKind: "RANGE" },
          { key: "GHS Classification", defaultUom: "", defaultTestMethod: "SDS Review", valueKind: "TEXT" }
        ]
      },
      {
        specType: "REGULATORY",
        label: "Regulatory Compliance",
        attributes: [
          { key: "REACH Compliance", defaultUom: "", defaultTestMethod: "Regulatory Review", valueKind: "TEXT" },
          { key: "SVHC Content", defaultUom: "ppm", defaultTestMethod: "ICP-MS", valueKind: "RANGE" },
          { key: "PAH Content (TRGS 552)", defaultUom: "mg/kg", defaultTestMethod: "AfPS GS 2014:01 PAK", valueKind: "RANGE" }
        ]
      },
      {
        specType: "PACKAGING",
        label: "Packaging",
        attributes: [
          { key: "Container Type", defaultUom: "", defaultTestMethod: "Visual", valueKind: "TEXT" },
          { key: "Bale / Net Weight", defaultUom: "kg", defaultTestMethod: "Scale", valueKind: "RANGE" }
        ]
      }
    ],
    PAINT: [
      {
        specType: "PHYSICAL",
        label: "Physical Properties",
        attributes: [
          { key: "Specific Gravity", defaultUom: "g/cm3", defaultTestMethod: "ASTM D1475", valueKind: "RANGE" },
          { key: "Viscosity (KU)", defaultUom: "KU", defaultTestMethod: "ASTM D562", valueKind: "RANGE" },
          { key: "Fineness of Grind", defaultUom: "Hegman", defaultTestMethod: "ASTM D1210", valueKind: "RANGE" },
          { key: "Oil Absorption", defaultUom: "g/100g", defaultTestMethod: "ASTM D281", valueKind: "RANGE" },
          { key: "Tinting Strength", defaultUom: "Reynold's Unit", defaultTestMethod: "ISO 787-16", valueKind: "RANGE" }
        ]
      },
      {
        specType: "CHEMICAL",
        label: "Chemical Properties",
        attributes: [
          { key: "Solid Content", defaultUom: "%", defaultTestMethod: "ASTM D2369", valueKind: "RANGE" },
          { key: "pH of Aqueous Suspension", defaultUom: "", defaultTestMethod: "ISO 787-9", valueKind: "RANGE" },
          { key: "Moisture Content", defaultUom: "%", defaultTestMethod: "ISO 787-2", valueKind: "RANGE" },
          { key: "Acid Value", defaultUom: "mg KOH/g", defaultTestMethod: "ASTM D1639", valueKind: "RANGE" }
        ]
      },
      {
        specType: "PERFORMANCE",
        label: "Film Performance",
        attributes: [
          { key: "Hiding Power (Contrast Ratio)", defaultUom: "", defaultTestMethod: "ASTM D2805", valueKind: "RANGE" },
          { key: "Gloss (60°)", defaultUom: "GU", defaultTestMethod: "ASTM D523", valueKind: "RANGE" },
          { key: "Dry Time — Touch", defaultUom: "min", defaultTestMethod: "ASTM D1640", valueKind: "RANGE" },
          { key: "Dry Time — Hard", defaultUom: "hr", defaultTestMethod: "ASTM D1640", valueKind: "RANGE" },
          { key: "Scrub Resistance", defaultUom: "cycles", defaultTestMethod: "ASTM D2486", valueKind: "RANGE" }
        ]
      },
      {
        specType: "SAFETY",
        label: "Safety & Environment",
        attributes: [
          { key: "Flash Point", defaultUom: "degC", defaultTestMethod: "ASTM D93", valueKind: "RANGE" },
          { key: "VOC Content", defaultUom: "g/L", defaultTestMethod: "ISO 11890-2", valueKind: "RANGE" },
          { key: "GHS Classification", defaultUom: "", defaultTestMethod: "SDS Review", valueKind: "TEXT" }
        ]
      },
      {
        specType: "REGULATORY",
        label: "Regulatory Compliance",
        attributes: [
          { key: "REACH Compliance", defaultUom: "", defaultTestMethod: "Regulatory Review", valueKind: "TEXT" },
          { key: "EU Ecolabel", defaultUom: "", defaultTestMethod: "Certification Review", valueKind: "TEXT" },
          { key: "EU VOC Directive 2004/42/EC", defaultUom: "", defaultTestMethod: "Regulatory Review", valueKind: "TEXT" }
        ]
      },
      {
        specType: "PACKAGING",
        label: "Packaging",
        attributes: [
          { key: "Container Type", defaultUom: "", defaultTestMethod: "Visual", valueKind: "TEXT" },
          { key: "Net Weight / Volume", defaultUom: "L", defaultTestMethod: "Scale", valueKind: "RANGE" },
          { key: "Shelf Life", defaultUom: "months", defaultTestMethod: "Stability Study", valueKind: "RANGE" }
        ]
      }
    ]
  },
  mail: {
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    fromName: "Tatva",
    fromEmail: ""
  }
};

async function ensureConfigFile(): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
  }
}

async function ensureDefaultNumberSequences(): Promise<void> {
  await prisma.numberSequence.createMany({
    data: (Object.entries(defaultConfig.numberSequences) as Array<[ConfigEntity, NumberSequence]>).map(([entity, sequence]) => ({
      entity,
      prefix: sequence.prefix,
      padding: sequence.padding,
      next: sequence.next
    })),
    skipDuplicates: true
  });
}

async function readNumberSequences(): Promise<Record<ConfigEntity, NumberSequence>> {
  await ensureDefaultNumberSequences();
  const entries = await prisma.numberSequence.findMany({
    where: { entity: { in: ["ITEM", "ITEM_FINISHED_GOOD", "ITEM_PACKAGING", "FORMULA", "BOM", "CHANGE_REQUEST", "RELEASE_REQUEST", "DOCUMENT", "ARTWORK"] } }
  });

  const mapped = {} as Record<ConfigEntity, NumberSequence>;
  for (const [entity, fallback] of Object.entries(defaultConfig.numberSequences) as Array<[ConfigEntity, NumberSequence]>) {
    const dbEntry = entries.find((entry) => entry.entity === entity);
    mapped[entity] = dbEntry
      ? { prefix: dbEntry.prefix, padding: dbEntry.padding, next: dbEntry.next }
      : fallback;
  }
  return mapped;
}

async function readStoredConfig(): Promise<StoredConfigData> {
  await ensureConfigFile();
  const content = await fs.readFile(configPath, "utf-8");
  return JSON.parse(content) as StoredConfigData;
}

export async function readAppConfig(): Promise<AppConfigData> {
  const stored = await readStoredConfig();
  const numberSequences = await readNumberSequences();
  const mergedAttributes = { ...defaultConfig.attributeDefinitions };
  if (stored.attributeDefinitions) {
    for (const [key, defs] of Object.entries(stored.attributeDefinitions) as Array<[AttributeEntity, AttributeDefinition[]]>) {
      mergedAttributes[key] = defs && defs.length ? defs : defaultConfig.attributeDefinitions[key] ?? [];
    }
  }
  return {
    numberSequences,
    attributeDefinitions: mergedAttributes,
    revisionSchemes: stored.revisionSchemes ?? defaultConfig.revisionSchemes,
    listColumns: stored.listColumns ?? defaultConfig.listColumns,
    uoms: stored.uoms ?? defaultConfig.uoms,
    // Merge stored templates with defaults so newly-added industries always appear
    specTemplates: { ...defaultConfig.specTemplates, ...(stored.specTemplates ?? {}) },
    mail: stored.mail ?? defaultConfig.mail
  };
}

export async function writeAppConfig(config: AppConfigData): Promise<void> {
  await ensureConfigFile();
  const persisted: StoredConfigData = {
    attributeDefinitions: config.attributeDefinitions,
    revisionSchemes: config.revisionSchemes,
    listColumns: config.listColumns,
    uoms: config.uoms,
    specTemplates: config.specTemplates,
    mail: config.mail
  };
  await fs.writeFile(configPath, JSON.stringify(persisted, null, 2), "utf-8");
}

// ─── Container-scoped sequence helpers ────────────────────────────────────────

function getIndustryPrefixBase(industry: string): string {
  const map: Record<string, string> = {
    FOOD_BEVERAGE: "FNB",
    POLYMER: "PLY",
    CHEMICAL: "CH",
    CPG: "CPG",
    TYRE: "TYR",
    PAINT: "PNT"
  };
  return map[industry] ?? "PLM";
}

function getEntitySuffix(entity: ConfigEntity): string {
  const map: Partial<Record<ConfigEntity, string>> = {
    ITEM: "RM-",
    ITEM_FINISHED_GOOD: "FG-",
    ITEM_PACKAGING: "PKG-",
    FORMULA: "FML-",
    BOM: "FG-",
    CHANGE_REQUEST: "CR-",
    RELEASE_REQUEST: "RR-",
    DOCUMENT: "DOC-",
    ARTWORK: "ART-"
  };
  return map[entity] ?? "ITM-";
}

async function getOrCreateContainerSequence(entity: ConfigEntity, containerId: string): Promise<{ key: string; padding: number }> {
  const containerKey = `${entity}_${containerId}`;
  const existing = await prisma.numberSequence.findUnique({ where: { entity: containerKey } });
  if (existing) return { key: containerKey, padding: existing.padding };

  // Auto-init from the container's industry
  const container = await prisma.productContainer.findUnique({ where: { id: containerId }, select: { industry: true } });
  const base = container ? getIndustryPrefixBase(container.industry) : "PLM";
  const suffix = getEntitySuffix(entity);
  const prefix = `${base}-${suffix}`;
  await prisma.numberSequence.upsert({
    where: { entity: containerKey },
    create: { entity: containerKey, prefix, padding: 4, next: 1 },
    update: {}
  });
  return { key: containerKey, padding: 4 };
}

// ─── Sequence reads / writes ───────────────────────────────────────────────────

export async function peekNextSequenceValue(entity: ConfigEntity, containerId?: string | null): Promise<string> {
  if (containerId) {
    const { key } = await getOrCreateContainerSequence(entity, containerId);
    const row = await prisma.numberSequence.findUnique({ where: { entity: key } });
    if (row) return `${row.prefix}${String(row.next).padStart(row.padding, "0")}`;
  }
  const sequences = await readNumberSequences();
  const sequence = sequences[entity];
  return `${sequence.prefix}${String(sequence.next).padStart(sequence.padding, "0")}`;
}

export async function allocateNextSequenceValue(entity: ConfigEntity, containerId?: string | null): Promise<string> {
  await ensureDefaultNumberSequences();
  const sequenceKey = containerId
    ? (await getOrCreateContainerSequence(entity, containerId)).key
    : entity as string;

  const rows = await prisma.$queryRaw<Array<{ prefix: string; padding: number; allocated: number }>>`
    UPDATE "NumberSequence"
    SET "next" = "next" + 1
    WHERE "entity" = ${sequenceKey}
    RETURNING "prefix", "padding", "next" - 1 AS "allocated"
  `;

  const row = rows[0];
  if (!row) {
    throw new Error(`Number sequence for ${entity} is not configured`);
  }
  return `${row.prefix}${String(row.allocated).padStart(row.padding, "0")}`;
}

export async function updateSequence(entity: string, input: NumberSequence): Promise<void> {
  await prisma.numberSequence.upsert({
    where: { entity },
    update: { prefix: input.prefix, padding: input.padding, next: input.next },
    create: { entity, prefix: input.prefix, padding: input.padding, next: input.next }
  });
}

export async function updateRevisionScheme(entity: RevisionEntity, input: RevisionScheme): Promise<void> {
  const config = await readAppConfig();
  config.revisionSchemes[entity] = input;
  await writeAppConfig(config);
}

export async function updateListColumns(entity: ListEntity, columns: string[]): Promise<void> {
  const config = await readAppConfig();
  config.listColumns[entity] = columns;
  await writeAppConfig(config);
}

export async function addAttributeDefinition(entity: AttributeEntity, attribute: AttributeDefinition): Promise<void> {
  const config = await readAppConfig();
  const existing = config.attributeDefinitions[entity];
  const deduped = existing.filter((entry) => entry.key !== attribute.key);
  config.attributeDefinitions[entity] = [...deduped, attribute];
  await writeAppConfig(config);
}

export async function removeAttributeDefinition(entity: AttributeEntity, key: string): Promise<void> {
  const config = await readAppConfig();
  config.attributeDefinitions[entity] = config.attributeDefinitions[entity].filter((entry) => entry.key !== key);
  await writeAppConfig(config);
}

export async function updateUoms(uoms: UomDefinition[]): Promise<void> {
  const config = await readAppConfig();
  config.uoms = uoms;
  await writeAppConfig(config);
}

export async function readSpecTemplates(industry: string): Promise<SpecTemplate[]> {
  const config = await readAppConfig();
  return config.specTemplates[industry] ?? [];
}

export async function updateSpecTemplates(industry: string, templates: SpecTemplate[]): Promise<void> {
  const config = await readAppConfig();
  config.specTemplates[industry] = templates;
  await writeAppConfig(config);
}

export async function readMailConfig(): Promise<MailConfig> {
  const config = await readAppConfig();
  return config.mail;
}

export async function updateMailConfig(mail: MailConfig): Promise<void> {
  const config = await readAppConfig();
  config.mail = mail;
  await writeAppConfig(config);
}
