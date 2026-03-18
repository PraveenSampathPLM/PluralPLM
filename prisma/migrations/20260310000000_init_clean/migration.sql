-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('CPG', 'CHEMICAL', 'TYRE', 'POLYMER', 'PAINT', 'FOOD_BEVERAGE');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('RAW_MATERIAL', 'INTERMEDIATE', 'FINISHED_GOOD', 'PACKAGING');

-- CreateEnum
CREATE TYPE "LifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OBSOLETE', 'UNDER_CHANGE');

-- CreateEnum
CREATE TYPE "FormulaStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'RELEASED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "FGStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'RELEASED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('ECR', 'ECO', 'ECN', 'DCO');

-- CreateEnum
CREATE TYPE "ChangePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('NEW', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('NEW', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'RELEASED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'RELEASED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SDS', 'TDS', 'COA', 'SPECIFICATION', 'PROCESS', 'QUALITY', 'REGULATORY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductContainer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industry" "Industry" NOT NULL DEFAULT 'CHEMICAL',
    "status" "ContainerStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductContainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerRole" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContainerRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerMembership" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "containerRoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContainerMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "revisionMajor" INTEGER NOT NULL DEFAULT 1,
    "revisionIteration" INTEGER NOT NULL DEFAULT 1,
    "revisionLabel" TEXT NOT NULL DEFAULT '1.1',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industryType" "Industry" NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "uom" TEXT NOT NULL,
    "density" DOUBLE PRECISION,
    "viscosity" DOUBLE PRECISION,
    "pH" DOUBLE PRECISION,
    "flashPoint" DOUBLE PRECISION,
    "regulatoryFlags" JSONB,
    "attributes" JSONB,
    "containerId" TEXT,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formula" (
    "id" TEXT NOT NULL,
    "formulaCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "revisionMajor" INTEGER NOT NULL DEFAULT 1,
    "revisionIteration" INTEGER NOT NULL DEFAULT 1,
    "revisionLabel" TEXT NOT NULL DEFAULT '1.1',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industryType" "Industry" NOT NULL,
    "targetYield" DOUBLE PRECISION,
    "yieldUom" TEXT,
    "batchSize" DOUBLE PRECISION,
    "batchUom" TEXT,
    "processingInstructions" TEXT,
    "status" "FormulaStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "containerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Formula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulaIngredient" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "itemId" TEXT,
    "inputFormulaId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION,
    "lowerLimit" DOUBLE PRECISION,
    "upperLimit" DOUBLE PRECISION,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "substitutionGroup" TEXT,
    "additionStep" TEXT,
    "additionSequence" INTEGER,
    "mixingTime" TEXT,
    CONSTRAINT "FormulaIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FGStructure" (
    "id" TEXT NOT NULL,
    "fgItemId" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revisionMajor" INTEGER NOT NULL DEFAULT 1,
    "revisionIteration" INTEGER NOT NULL DEFAULT 1,
    "revisionLabel" TEXT NOT NULL DEFAULT '1.1',
    "status" "FGStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3),
    "containerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FGStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FGPackagingLine" (
    "id" TEXT NOT NULL,
    "fgStructureId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lineNumber" INTEGER,
    "quantity" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    CONSTRAINT "FGPackagingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "crNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChangeType" NOT NULL,
    "priority" "ChangePriority" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "affectedItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedFormulas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proposedChanges" JSONB,
    "impactAssessment" TEXT,
    "containerId" TEXT,
    "status" "ChangeStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseRequest" (
    "id" TEXT NOT NULL,
    "rrNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'NEW',
    "requestedById" TEXT NOT NULL,
    "containerId" TEXT,
    "targetItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetFormulas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedFormulas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReleaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "docType" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "revisionMajor" INTEGER NOT NULL DEFAULT 1,
    "revisionIteration" INTEGER NOT NULL DEFAULT 1,
    "revisionLabel" TEXT NOT NULL DEFAULT '1.1',
    "ownerId" TEXT NOT NULL,
    "containerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "states" JSONB NOT NULL,
    "transitions" JSONB NOT NULL,
    "actions" JSONB,
    "industry" "Industry" NOT NULL,
    "entityType" TEXT NOT NULL,
    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "currentState" TEXT NOT NULL,
    "history" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specification" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "formulaId" TEXT,
    "containerId" TEXT,
    "specType" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "value" TEXT,
    "uom" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "testMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Specification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "ProductContainer_code_key" ON "ProductContainer"("code");
CREATE UNIQUE INDEX "ContainerRole_containerId_name_key" ON "ContainerRole"("containerId", "name");
CREATE UNIQUE INDEX "ContainerMembership_containerId_userId_key" ON "ContainerMembership"("containerId", "userId");
CREATE UNIQUE INDEX "Item_itemCode_revisionMajor_revisionIteration_key" ON "Item"("itemCode", "revisionMajor", "revisionIteration");
CREATE UNIQUE INDEX "Formula_formulaCode_version_key" ON "Formula"("formulaCode", "version");
CREATE UNIQUE INDEX "FGStructure_fgItemId_version_key" ON "FGStructure"("fgItemId", "version");
CREATE UNIQUE INDEX "ChangeRequest_crNumber_key" ON "ChangeRequest"("crNumber");
CREATE UNIQUE INDEX "ReleaseRequest_rrNumber_key" ON "ReleaseRequest"("rrNumber");
CREATE UNIQUE INDEX "Document_docNumber_key" ON "Document"("docNumber");

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductContainer" ADD CONSTRAINT "ProductContainer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContainerRole" ADD CONSTRAINT "ContainerRole_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContainerMembership" ADD CONSTRAINT "ContainerMembership_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContainerMembership" ADD CONSTRAINT "ContainerMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContainerMembership" ADD CONSTRAINT "ContainerMembership_containerRoleId_fkey" FOREIGN KEY ("containerRoleId") REFERENCES "ContainerRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Formula" ADD CONSTRAINT "Formula_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Formula" ADD CONSTRAINT "Formula_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormulaIngredient" ADD CONSTRAINT "FormulaIngredient_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "Formula"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormulaIngredient" ADD CONSTRAINT "FormulaIngredient_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormulaIngredient" ADD CONSTRAINT "FormulaIngredient_inputFormulaId_fkey" FOREIGN KEY ("inputFormulaId") REFERENCES "Formula"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FGStructure" ADD CONSTRAINT "FGStructure_fgItemId_fkey" FOREIGN KEY ("fgItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FGStructure" ADD CONSTRAINT "FGStructure_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "Formula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FGStructure" ADD CONSTRAINT "FGStructure_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FGPackagingLine" ADD CONSTRAINT "FGPackagingLine_fgStructureId_fkey" FOREIGN KEY ("fgStructureId") REFERENCES "FGStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FGPackagingLine" ADD CONSTRAINT "FGPackagingLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReleaseRequest" ADD CONSTRAINT "ReleaseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleaseRequest" ADD CONSTRAINT "ReleaseRequest_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Specification" ADD CONSTRAINT "Specification_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Specification" ADD CONSTRAINT "Specification_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "Formula"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Specification" ADD CONSTRAINT "Specification_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
