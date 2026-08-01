-- CreateEnum
CREATE TYPE "ApartmentInvoiceType" AS ENUM ('RENT', 'UTILITIES', 'RENT_AND_UTILITIES');

-- CreateEnum
CREATE TYPE "ApartmentInvoiceStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "apartmentInvoiceId" TEXT,
ADD COLUMN     "paymentConfirmationId" TEXT;

-- CreateTable
CREATE TABLE "ApartmentInvoice" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "leaseId" TEXT,
    "type" "ApartmentInvoiceType" NOT NULL,
    "invoiceNumber" TEXT,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "periodMonth" DATE NOT NULL,
    "totalAmountRON" DECIMAL(10,2) NOT NULL,
    "paidAmountRON" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outstandingAmountRON" DECIMAL(10,2) NOT NULL,
    "status" "ApartmentInvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "autoExtracted" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApartmentInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConfirmation" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "totalAmountRON" DECIMAL(10,2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentApplication" (
    "id" TEXT NOT NULL,
    "paymentConfirmationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountRON" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApartmentInvoice_apartmentId_idx" ON "ApartmentInvoice"("apartmentId");

-- CreateIndex
CREATE INDEX "ApartmentInvoice_ownerId_idx" ON "ApartmentInvoice"("ownerId");

-- CreateIndex
CREATE INDEX "ApartmentInvoice_periodMonth_idx" ON "ApartmentInvoice"("periodMonth");

-- CreateIndex
CREATE INDEX "ApartmentInvoice_status_idx" ON "ApartmentInvoice"("status");

-- CreateIndex
CREATE INDEX "ApartmentInvoice_deletedAt_idx" ON "ApartmentInvoice"("deletedAt");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_apartmentId_idx" ON "PaymentConfirmation"("apartmentId");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_ownerId_idx" ON "PaymentConfirmation"("ownerId");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_deletedAt_idx" ON "PaymentConfirmation"("deletedAt");

-- CreateIndex
CREATE INDEX "PaymentApplication_paymentConfirmationId_idx" ON "PaymentApplication"("paymentConfirmationId");

-- CreateIndex
CREATE INDEX "PaymentApplication_invoiceId_idx" ON "PaymentApplication"("invoiceId");

-- CreateIndex
CREATE INDEX "Document_apartmentInvoiceId_idx" ON "Document"("apartmentInvoiceId");

-- CreateIndex
CREATE INDEX "Document_paymentConfirmationId_idx" ON "Document"("paymentConfirmationId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_apartmentInvoiceId_fkey" FOREIGN KEY ("apartmentInvoiceId") REFERENCES "ApartmentInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_paymentConfirmationId_fkey" FOREIGN KEY ("paymentConfirmationId") REFERENCES "PaymentConfirmation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentInvoice" ADD CONSTRAINT "ApartmentInvoice_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentInvoice" ADD CONSTRAINT "ApartmentInvoice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentInvoice" ADD CONSTRAINT "ApartmentInvoice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentInvoice" ADD CONSTRAINT "ApartmentInvoice_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_paymentConfirmationId_fkey" FOREIGN KEY ("paymentConfirmationId") REFERENCES "PaymentConfirmation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ApartmentInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
