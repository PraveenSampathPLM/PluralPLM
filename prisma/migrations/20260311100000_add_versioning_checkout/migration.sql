-- Add OBSOLETE to LifecycleStatus enum
ALTER TYPE "LifecycleStatus" ADD VALUE IF NOT EXISTS 'OBSOLETE';

-- Add OBSOLETE to FormulaStatus enum
ALTER TYPE "FormulaStatus" ADD VALUE IF NOT EXISTS 'OBSOLETE';

-- Add OBSOLETE to FGStatus enum
ALTER TYPE "FGStatus" ADD VALUE IF NOT EXISTS 'OBSOLETE';

-- Create ChangeTargetAction enum
DO $$ BEGIN
  CREATE TYPE "ChangeTargetAction" AS ENUM ('RELEASE', 'OBSOLETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add checkout fields to Item
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "checkedOutById" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "checkedOutAt" TIMESTAMP(3);
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "checkoutSnapshot" JSONB;

DO $$ BEGIN
  ALTER TABLE "Item" ADD CONSTRAINT "Item_checkedOutById_fkey"
    FOREIGN KEY ("checkedOutById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add checkout fields to Formula
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "checkedOutById" TEXT;
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "checkedOutAt" TIMESTAMP(3);
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "checkoutSnapshot" JSONB;

DO $$ BEGIN
  ALTER TABLE "Formula" ADD CONSTRAINT "Formula_checkedOutById_fkey"
    FOREIGN KEY ("checkedOutById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add checkout fields to Document
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "checkedOutById" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "checkedOutAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "checkoutSnapshot" JSONB;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_checkedOutById_fkey"
    FOREIGN KEY ("checkedOutById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add targetAction to ChangeRequest
ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "targetAction" "ChangeTargetAction" NOT NULL DEFAULT 'RELEASE';
