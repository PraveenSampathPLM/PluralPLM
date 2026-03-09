import { readAppConfig } from "./config-store.service.js";

export type RevisionEntity = "ITEM" | "FORMULA" | "BOM";

export interface RevisionScheme {
  style: "NUMERIC" | "ALPHA_NUMERIC";
  delimiter: string;
}

function toAlpha(value: number): string {
  let num = Math.max(1, Math.floor(value));
  let out = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    num = Math.floor((num - 1) / 26);
  }
  return out;
}

export function formatRevisionLabel(major: number, iteration: number, scheme: RevisionScheme): string {
  const majorToken = scheme.style === "ALPHA_NUMERIC" ? toAlpha(major) : String(major);
  return `${majorToken}${scheme.delimiter}${iteration}`;
}

export async function getRevisionScheme(entity: RevisionEntity): Promise<RevisionScheme> {
  const config = await readAppConfig();
  return config.revisionSchemes[entity];
}
