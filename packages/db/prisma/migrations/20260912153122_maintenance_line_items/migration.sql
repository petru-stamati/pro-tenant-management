-- AlterTable
ALTER TABLE "MaintenanceProposal" ALTER COLUMN "contractorName" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MaintenanceLineItem" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceEUR" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceLineItem_proposalId_idx" ON "MaintenanceLineItem"("proposalId");

-- AddForeignKey
ALTER TABLE "MaintenanceLineItem" ADD CONSTRAINT "MaintenanceLineItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "MaintenanceProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
