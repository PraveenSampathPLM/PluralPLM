-- Add revision and iteration fields for controlled lifecycle actions.
ALTER TABLE "Item"
ADD COLUMN "revisionMajor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "revisionIteration" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "revisionLabel" TEXT NOT NULL DEFAULT '1.1';

ALTER TABLE "Formula"
ADD COLUMN "revisionMajor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "revisionIteration" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "revisionLabel" TEXT NOT NULL DEFAULT '1.1';

ALTER TABLE "BOM"
ADD COLUMN "revisionMajor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "revisionIteration" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "revisionLabel" TEXT NOT NULL DEFAULT '1.1';
