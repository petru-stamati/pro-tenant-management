-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('BEDROOM', 'BATHROOM', 'KITCHEN', 'HALLWAY', 'LIVING_ROOM', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('GOOD', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InspectionOutcome" AS ENUM ('CONFIRMED_GOOD', 'NEEDS_ATTENTION', 'REPLACED', 'REMOVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'INSPECTION_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'INVOICES_PENDING_ASSIGNMENT';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "periodMonth" DATE;

-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "roomItemId" TEXT;

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "label" TEXT NOT NULL,
    "notFurnished" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomItem" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" "ItemCondition" NOT NULL DEFAULT 'GOOD',
    "conditionNote" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "performedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionResult" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "roomItemId" TEXT NOT NULL,
    "outcome" "InspectionOutcome" NOT NULL,
    "note" TEXT,
    "previousItemName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_apartmentId_idx" ON "Room"("apartmentId");

-- CreateIndex
CREATE INDEX "Room_ownerId_idx" ON "Room"("ownerId");

-- CreateIndex
CREATE INDEX "Room_deletedAt_idx" ON "Room"("deletedAt");

-- CreateIndex
CREATE INDEX "RoomItem_roomId_idx" ON "RoomItem"("roomId");

-- CreateIndex
CREATE INDEX "RoomItem_deletedAt_idx" ON "RoomItem"("deletedAt");

-- CreateIndex
CREATE INDEX "Inspection_apartmentId_idx" ON "Inspection"("apartmentId");

-- CreateIndex
CREATE INDEX "Inspection_ownerId_idx" ON "Inspection"("ownerId");

-- CreateIndex
CREATE INDEX "Inspection_deletedAt_idx" ON "Inspection"("deletedAt");

-- CreateIndex
CREATE INDEX "InspectionResult_inspectionId_idx" ON "InspectionResult"("inspectionId");

-- CreateIndex
CREATE INDEX "InspectionResult_roomItemId_idx" ON "InspectionResult"("roomItemId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_roomItemId_idx" ON "MaintenanceRequest"("roomItemId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomItem" ADD CONSTRAINT "RoomItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResult" ADD CONSTRAINT "InspectionResult_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResult" ADD CONSTRAINT "InspectionResult_roomItemId_fkey" FOREIGN KEY ("roomItemId") REFERENCES "RoomItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_roomItemId_fkey" FOREIGN KEY ("roomItemId") REFERENCES "RoomItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
