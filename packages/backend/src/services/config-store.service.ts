import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "./prisma.js";

export type ConfigEntity = "ITEM" | "ITEM_FINISHED_GOOD" | "ITEM_PACKAGING" | "FORMULA" | "BOM" | "CHANGE_REQUEST" | "RELEASE_REQUEST" | "DOCUMENT";
export type AttributeEntity = "ITEM";
export type RevisionEntity = "ITEM" | "FORMULA" | "BOM";
export type ListEntity = "ITEM" | "FORMULA" | "BOM" | "CHANGE_REQUEST" | "SPECIFICATION";

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
    DOCUMENT: { prefix: "CH-DOC-", padding: 4, next: 1 }
  },
  attributeDefinitions: {
    ITEM: [
      { key: "casNumber", label: "CAS Number", type: "text" },
      { key: "grade", label: "Grade/Specification", type: "text" },
      { key: "supplier", label: "Preferred Supplier", type: "text" },
      { key: "reach", label: "REACH Registered", type: "boolean" },
      { key: "vocContent", label: "VOC Content (%)", type: "number" },
      { key: "viscosity", label: "Viscosity (cP)", type: "number" },
      { key: "density", label: "Density (g/cc)", type: "number" },
      { key: "color", label: "Color/Appearance", type: "text" }
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
    ]
  },
  mail: {
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    fromName: "Plural PLM",
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
    where: { entity: { in: ["ITEM", "ITEM_FINISHED_GOOD", "ITEM_PACKAGING", "FORMULA", "BOM", "CHANGE_REQUEST", "RELEASE_REQUEST", "DOCUMENT"] } }
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
    specTemplates: stored.specTemplates ?? defaultConfig.specTemplates,
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

export async function peekNextSequenceValue(entity: ConfigEntity): Promise<string> {
  const sequences = await readNumberSequences();
  const sequence = sequences[entity];
  return `${sequence.prefix}${String(sequence.next).padStart(sequence.padding, "0")}`;
}

export async function allocateNextSequenceValue(entity: ConfigEntity): Promise<string> {
  await ensureDefaultNumberSequences();
  const rows = await prisma.$queryRaw<Array<{ prefix: string; padding: number; allocated: number }>>`
    UPDATE "NumberSequence"
    SET "next" = "next" + 1
    WHERE "entity" = ${entity}
    RETURNING "prefix", "padding", "next" - 1 AS "allocated"
  `;

  const row = rows[0];
  if (!row) {
    throw new Error(`Number sequence for ${entity} is not configured`);
  }
  return `${row.prefix}${String(row.allocated).padStart(row.padding, "0")}`;
}

export async function updateSequence(entity: ConfigEntity, input: NumberSequence): Promise<void> {
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
