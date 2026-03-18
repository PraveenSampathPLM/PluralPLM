-- Simplify lifecycle statuses for Item, Formula, and FGStructure to:
-- IN_WORK -> UNDER_REVIEW -> RELEASED

ALTER TYPE "LifecycleStatus" RENAME TO "LifecycleStatus_old";
CREATE TYPE "LifecycleStatus" AS ENUM ('IN_WORK', 'UNDER_REVIEW', 'RELEASED');

ALTER TABLE "Item" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Item"
  ALTER COLUMN "status" TYPE "LifecycleStatus"
  USING (
    CASE
      WHEN "status"::text IN ('DRAFT', 'UNDER_CHANGE') THEN 'IN_WORK'
      WHEN "status"::text = 'ACTIVE' THEN 'RELEASED'
      WHEN "status"::text = 'OBSOLETE' THEN 'RELEASED'
      ELSE 'IN_WORK'
    END
  )::"LifecycleStatus";
ALTER TABLE "Item" ALTER COLUMN "status" SET DEFAULT 'IN_WORK';
DROP TYPE "LifecycleStatus_old";

ALTER TYPE "FormulaStatus" RENAME TO "FormulaStatus_old";
CREATE TYPE "FormulaStatus" AS ENUM ('IN_WORK', 'UNDER_REVIEW', 'RELEASED');

ALTER TABLE "Formula" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Formula"
  ALTER COLUMN "status" TYPE "FormulaStatus"
  USING (
    CASE
      WHEN "status"::text = 'DRAFT' THEN 'IN_WORK'
      WHEN "status"::text = 'IN_REVIEW' THEN 'UNDER_REVIEW'
      WHEN "status"::text IN ('APPROVED', 'RELEASED', 'OBSOLETE') THEN 'RELEASED'
      ELSE 'IN_WORK'
    END
  )::"FormulaStatus";
ALTER TABLE "Formula" ALTER COLUMN "status" SET DEFAULT 'IN_WORK';
DROP TYPE "FormulaStatus_old";

ALTER TYPE "FGStatus" RENAME TO "FGStatus_old";
CREATE TYPE "FGStatus" AS ENUM ('IN_WORK', 'UNDER_REVIEW', 'RELEASED');

ALTER TABLE "FGStructure" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "FGStructure"
  ALTER COLUMN "status" TYPE "FGStatus"
  USING (
    CASE
      WHEN "status"::text = 'DRAFT' THEN 'IN_WORK'
      WHEN "status"::text = 'IN_REVIEW' THEN 'UNDER_REVIEW'
      WHEN "status"::text IN ('APPROVED', 'RELEASED', 'OBSOLETE') THEN 'RELEASED'
      ELSE 'IN_WORK'
    END
  )::"FGStatus";
ALTER TABLE "FGStructure" ALTER COLUMN "status" SET DEFAULT 'IN_WORK';
DROP TYPE "FGStatus_old";
