import { Router } from "express";
import { z } from "zod";
import {
  addAttributeDefinition,
  allocateNextSequenceValue,
  peekNextSequenceValue,
  readAppConfig,
  readMailConfig,
  removeAttributeDefinition,
  updateMailConfig,
  updateUoms,
  updateListColumns,
  updateRevisionScheme,
  updateSequence
} from "../services/config-store.service.js";
import { authorize } from "../middleware/auth.middleware.js";

const entitySchema = z.enum(["ITEM", "ITEM_FINISHED_GOOD", "ITEM_PACKAGING", "FORMULA", "BOM", "CHANGE_REQUEST"]);
const attributeEntitySchema = z.enum(["ITEM"]);
const revisionEntitySchema = z.enum(["ITEM", "FORMULA", "BOM"]);
const listEntitySchema = z.enum(["ITEM", "FORMULA", "BOM", "CHANGE_REQUEST", "SPECIFICATION"]);

const sequenceSchema = z.object({
  prefix: z.string().min(1),
  padding: z.number().int().positive().max(10),
  next: z.number().int().positive()
});

const attributeSchema = z.object({
  entity: attributeEntitySchema,
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "boolean"]),
  required: z.boolean().default(false)
});

const revisionSchemeSchema = z.object({
  style: z.enum(["NUMERIC", "ALPHA_NUMERIC"]),
  delimiter: z.string().min(1).max(3)
});

const listColumnsSchema = z.object({
  columns: z.array(z.string().min(1)).min(1)
});

const uomSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1)
});

const mailSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean(),
  username: z.string().min(1),
  password: z.string().min(1),
  fromName: z.string().min(1),
  fromEmail: z.string().min(3)
});

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const config = await readAppConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

router.get("/next-number/:entity", async (req, res, next) => {
  try {
    const entity = entitySchema.parse(req.params.entity);
    const value = await peekNextSequenceValue(entity);
    res.json({ entity, value });
  } catch (error) {
    next(error);
  }
});

router.get("/uoms", async (_req, res, next) => {
  try {
    const config = await readAppConfig();
    res.json({ data: config.uoms });
  } catch (error) {
    next(error);
  }
});

router.get("/mail", async (_req, res, next) => {
  try {
    const mail = await readMailConfig();
    res.json(mail);
  } catch (error) {
    next(error);
  }
});

router.put("/uoms", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const payload = z.array(uomSchema).min(1).parse(req.body);
    await updateUoms(payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put("/mail", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const payload = mailSchema.parse(req.body);
    await updateMailConfig(payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/next-number/:entity", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = entitySchema.parse(req.params.entity);
    const value = await allocateNextSequenceValue(entity);
    res.json({ entity, value });
  } catch (error) {
    next(error);
  }
});

router.put("/number-sequences/:entity", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = entitySchema.parse(req.params.entity);
    const payload = sequenceSchema.parse(req.body);
    await updateSequence(entity, payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put("/revision-schemes/:entity", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = revisionEntitySchema.parse(req.params.entity);
    const payload = revisionSchemeSchema.parse(req.body);
    await updateRevisionScheme(entity, payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put("/list-columns/:entity", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = listEntitySchema.parse(req.params.entity);
    const payload = listColumnsSchema.parse(req.body);
    await updateListColumns(entity, payload.columns);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/attributes", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const payload = attributeSchema.parse(req.body);
    await addAttributeDefinition(payload.entity, {
      key: payload.key,
      label: payload.label,
      type: payload.type,
      required: payload.required
    });
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.delete("/attributes/:entity/:key", authorize(["System Admin", "PLM Admin"]), async (req, res, next) => {
  try {
    const entity = attributeEntitySchema.parse(req.params.entity);
    const key = String(req.params.key ?? "");
    await removeAttributeDefinition(entity, key);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
