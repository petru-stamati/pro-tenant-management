-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT';

-- AlterTable
ALTER TABLE "Apartment" ADD COLUMN     "creditBalanceRON" DECIMAL(10,2) NOT NULL DEFAULT 0;
