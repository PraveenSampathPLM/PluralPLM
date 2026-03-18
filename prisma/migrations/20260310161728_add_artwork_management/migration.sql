-- CreateEnum
CREATE TYPE "ArtworkStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'RELEASED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "ArtworkComponentType" AS ENUM ('LABEL', 'CARTON', 'LEAFLET', 'SHRINK', 'SLEEVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ArtworkFileType" AS ENUM ('SOURCE', 'PROOF', 'FINAL');

-- CreateEnum
CREATE TYPE "AnnotationStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ChangeRequest" ALTER COLUMN "affectedItems" DROP DEFAULT,
ALTER COLUMN "affectedFormulas" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReleaseRequest" ALTER COLUMN "targetItems" DROP DEFAULT,
ALTER COLUMN "targetFormulas" DROP DEFAULT,
ALTER COLUMN "affectedItems" DROP DEFAULT,
ALTER COLUMN "affectedFormulas" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL,
    "artworkCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "packSize" TEXT,
    "market" TEXT,
    "languageSet" JSONB,
    "status" "ArtworkStatus" NOT NULL DEFAULT 'DRAFT',
    "revisionMajor" INTEGER NOT NULL DEFAULT 1,
    "revisionIteration" INTEGER NOT NULL DEFAULT 1,
    "revisionLabel" TEXT NOT NULL DEFAULT '1.1',
    "legalCopy" TEXT,
    "claims" JSONB,
    "warnings" TEXT,
    "storageConditions" TEXT,
    "usageInstructions" TEXT,
    "fgItemId" TEXT,
    "packagingItemId" TEXT,
    "formulaId" TEXT,
    "releaseRequestId" TEXT,
    "containerId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkComponent" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "componentType" "ArtworkComponentType" NOT NULL,
    "name" TEXT NOT NULL,
    "dimensions" TEXT,
    "substrate" TEXT,
    "printProcess" TEXT,
    "variantKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtworkComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkFile" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "artworkComponentId" TEXT,
    "fileType" "ArtworkFileType" NOT NULL DEFAULT 'PROOF',
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtworkFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkAnnotation" (
    "id" TEXT NOT NULL,
    "artworkFileId" TEXT NOT NULL,
    "annotation" TEXT NOT NULL,
    "coordinates" JSONB,
    "status" "AnnotationStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtworkAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkLink" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtworkLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkApproval" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "approverRole" TEXT NOT NULL,
    "approverId" TEXT,
    "decision" TEXT,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtworkApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_artworkCode_key" ON "Artwork"("artworkCode");

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_fgItemId_fkey" FOREIGN KEY ("fgItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_packagingItemId_fkey" FOREIGN KEY ("packagingItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "Formula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_releaseRequestId_fkey" FOREIGN KEY ("releaseRequestId") REFERENCES "ReleaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ProductContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkComponent" ADD CONSTRAINT "ArtworkComponent_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkFile" ADD CONSTRAINT "ArtworkFile_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkFile" ADD CONSTRAINT "ArtworkFile_artworkComponentId_fkey" FOREIGN KEY ("artworkComponentId") REFERENCES "ArtworkComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkFile" ADD CONSTRAINT "ArtworkFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkAnnotation" ADD CONSTRAINT "ArtworkAnnotation_artworkFileId_fkey" FOREIGN KEY ("artworkFileId") REFERENCES "ArtworkFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkAnnotation" ADD CONSTRAINT "ArtworkAnnotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkLink" ADD CONSTRAINT "ArtworkLink_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkApproval" ADD CONSTRAINT "ArtworkApproval_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
