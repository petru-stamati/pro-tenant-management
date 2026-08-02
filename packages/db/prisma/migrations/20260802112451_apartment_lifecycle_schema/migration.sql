-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('GENERAL', 'LEASE_RENEWAL', 'LEASE_SIGNING', 'MOVE_OUT_INSPECTION');

-- AlterEnum
ALTER TYPE "ApartmentStatus" ADD VALUE 'UNDER_MAINTENANCE';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "kind" "TaskKind" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "Showing" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "prospectName" TEXT NOT NULL,
    "prospectContact" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Showing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Showing_apartmentId_idx" ON "Showing"("apartmentId");

-- CreateIndex
CREATE INDEX "Showing_ownerId_idx" ON "Showing"("ownerId");

-- CreateIndex
CREATE INDEX "Showing_deletedAt_idx" ON "Showing"("deletedAt");

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
