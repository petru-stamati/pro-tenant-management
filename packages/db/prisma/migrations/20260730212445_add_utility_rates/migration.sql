-- CreateTable
CREATE TABLE "UtilityRate" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "utilityType" "UtilityType" NOT NULL,
    "pricePerUnit" DECIMAL(10,4) NOT NULL,
    "conversionFactor" DECIMAL(10,4),
    "vatPercent" DECIMAL(5,2),
    "maintenanceFee" DECIMAL(10,2),
    "maintenanceVatPercent" DECIMAL(5,2),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UtilityRate_ownerId_utilityType_key" ON "UtilityRate"("ownerId", "utilityType");

-- AddForeignKey
ALTER TABLE "UtilityRate" ADD CONSTRAINT "UtilityRate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
