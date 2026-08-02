-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER');

-- AlterTable
ALTER TABLE "PaymentConfirmation" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "paymentConfirmationId" TEXT;

-- CreateIndex
CREATE INDEX "Task_paymentConfirmationId_idx" ON "Task"("paymentConfirmationId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_paymentConfirmationId_fkey" FOREIGN KEY ("paymentConfirmationId") REFERENCES "PaymentConfirmation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
