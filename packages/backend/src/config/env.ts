import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../../.env", override: true });
dotenv.config({ path: "./.env", override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("1h")
});

export const env = envSchema.parse(process.env);
