-- AlterTable
ALTER TABLE "FGStructure" ADD COLUMN     "checkedOutAt" TIMESTAMP(3),
ADD COLUMN     "checkedOutById" TEXT,
ADD COLUMN     "checkoutSnapshot" JSONB;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "assignedRoles" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "FGStructure" ADD CONSTRAINT "FGStructure_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
