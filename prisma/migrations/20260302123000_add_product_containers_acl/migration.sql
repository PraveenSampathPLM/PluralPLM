-- Product container and container-level RBAC foundation.

CREATE TYPE "ContainerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

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

CREATE UNIQUE INDEX "ProductContainer_code_key" ON "ProductContainer"("code");

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

CREATE UNIQUE INDEX "ContainerRole_containerId_name_key" ON "ContainerRole"("containerId", "name");

CREATE TABLE "ContainerMembership" (
  "id" TEXT NOT NULL,
  "containerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "containerRoleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContainerMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContainerMembership_containerId_userId_key" ON "ContainerMembership"("containerId", "userId");

ALTER TABLE "Item" ADD COLUMN "containerId" TEXT;
ALTER TABLE "Formula" ADD COLUMN "containerId" TEXT;
ALTER TABLE "BOM" ADD COLUMN "containerId" TEXT;
ALTER TABLE "ChangeRequest" ADD COLUMN "containerId" TEXT;
ALTER TABLE "Specification" ADD COLUMN "containerId" TEXT;

ALTER TABLE "ProductContainer"
ADD CONSTRAINT "ProductContainer_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContainerRole"
ADD CONSTRAINT "ContainerRole_containerId_fkey"
FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContainerMembership"
ADD CONSTRAINT "ContainerMembership_containerId_fkey"
FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContainerMembership"
ADD CONSTRAINT "ContainerMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContainerMembership"
ADD CONSTRAINT "ContainerMembership_containerRoleId_fkey"
FOREIGN KEY ("containerRoleId") REFERENCES "ContainerRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Item"
ADD CONSTRAINT "Item_containerId_fkey"
FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Formula"
ADD CONSTRAINT "Formula_containerId_fkey"
FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BOM"
ADD CONSTRAINT "BOM_containerId_fkey"
FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChangeRequest"
ADD CONSTRAINT "ChangeRequest_containerId_fkey"
FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Specification"
ADD CONSTRAINT "Specification_containerId_fkey"
FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
