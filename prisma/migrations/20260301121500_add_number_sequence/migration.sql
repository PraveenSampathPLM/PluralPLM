-- CreateTable
CREATE TABLE "NumberSequence" (
    "entity" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "padding" INTEGER NOT NULL,
    "next" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("entity")
);

-- SeedDefaultSequences
INSERT INTO "NumberSequence" ("entity", "prefix", "padding", "next", "createdAt", "updatedAt")
VALUES
    ('ITEM', 'CH-RM-', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('FORMULA', 'CH-FML-', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('BOM', 'CH-BOM-', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('CHANGE_REQUEST', 'CH-CR-', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("entity") DO NOTHING;
