-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "leaseId" TEXT;

-- CreateIndex
CREATE INDEX "Task_leaseId_idx" ON "Task"("leaseId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
