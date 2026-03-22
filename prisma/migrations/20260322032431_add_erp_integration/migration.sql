-- CreateEnum
CREATE TYPE "NpdStage" AS ENUM ('DISCOVERY', 'FEASIBILITY', 'DEVELOPMENT', 'VALIDATION', 'LAUNCH');

-- CreateEnum
CREATE TYPE "NpdStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'KILLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GateDecision" AS ENUM ('GO', 'KILL', 'HOLD', 'RECYCLE');

-- AlterTable
ALTER TABLE "ChangeRequest" ADD COLUMN     "affectedDocuments" TEXT[];

-- AlterTable
ALTER TABLE "ReleaseRequest" ADD COLUMN     "affectedDocuments" TEXT[];

-- CreateTable
CREATE TABLE "NpdProject" (
    "id" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stage" "NpdStage" NOT NULL DEFAULT 'DISCOVERY',
    "status" "NpdStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetLaunchDate" TIMESTAMP(3),
    "actualLaunchDate" TIMESTAMP(3),
    "projectLeadId" TEXT,
    "containerId" TEXT,
    "fgItemId" TEXT,
    "formulaId" TEXT,
    "linkedItemIds" TEXT[],
    "linkedFormulaIds" TEXT[],
    "linkedDocumentIds" TEXT[],
    "linkedSpecIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NpdProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateReview" (
    "id" TEXT NOT NULL,
    "npdProjectId" TEXT NOT NULL,
    "gate" "NpdStage" NOT NULL,
    "decision" "GateDecision",
    "mustMeetCriteria" JSONB NOT NULL,
    "shouldMeetCriteria" JSONB NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "comments" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GateReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageGateTemplate" (
    "id" TEXT NOT NULL,
    "industry" "Industry" NOT NULL,
    "stage" "NpdStage" NOT NULL,
    "deliverables" JSONB NOT NULL,
    "mustMeetCriteria" JSONB NOT NULL,
    "shouldMeetCriteria" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageGateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpIntegration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "erpType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "baseUrl" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "syncEntities" TEXT[],
    "syncSchedule" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "containerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpFieldMapping" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "plmField" TEXT NOT NULL,
    "erpField" TEXT NOT NULL,
    "transformRule" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSyncLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsTotal" INTEGER NOT NULL DEFAULT 0,
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "details" JSONB,
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ErpSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NpdProject_projectCode_key" ON "NpdProject"("projectCode");

-- CreateIndex
CREATE UNIQUE INDEX "StageGateTemplate_industry_stage_key" ON "StageGateTemplate"("industry", "stage");

-- AddForeignKey
ALTER TABLE "NpdProject" ADD CONSTRAINT "NpdProject_projectLeadId_fkey" FOREIGN KEY ("projectLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpdProject" ADD CONSTRAINT "NpdProject_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpdProject" ADD CONSTRAINT "NpdProject_fgItemId_fkey" FOREIGN KEY ("fgItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpdProject" ADD CONSTRAINT "NpdProject_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "Formula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateReview" ADD CONSTRAINT "GateReview_npdProjectId_fkey" FOREIGN KEY ("npdProjectId") REFERENCES "NpdProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateReview" ADD CONSTRAINT "GateReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpIntegration" ADD CONSTRAINT "ErpIntegration_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpFieldMapping" ADD CONSTRAINT "ErpFieldMapping_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ErpIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSyncLog" ADD CONSTRAINT "ErpSyncLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ErpIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
