-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "rentVatIncluded" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "termMonths" INTEGER;
