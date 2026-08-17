-- Backfill: Document.apartmentId was never set for documents uploaded via
-- apartmentInvoiceId/paymentConfirmationId/leaseId/utilityRecordId/
-- maintenanceRequestId/taskId (only the specific FK was set) — meaning the
-- Documents tab's "filter by apartment" silently excluded nearly every
-- invoice and payment-receipt document. This backfills apartmentId
-- transitively from whichever FK each row already has, for rows where it's
-- still NULL. Safe to re-run: only touches rows still missing apartmentId.

UPDATE "Document" d
SET "apartmentId" = li."apartmentId"
FROM "Lease" li
WHERE d."apartmentId" IS NULL AND d."leaseId" = li."id";

UPDATE "Document" d
SET "apartmentId" = mr."apartmentId"
FROM "MaintenanceRequest" mr
WHERE d."apartmentId" IS NULL AND d."maintenanceRequestId" = mr."id";

UPDATE "Document" d
SET "apartmentId" = ur."apartmentId"
FROM "UtilityRecord" ur
WHERE d."apartmentId" IS NULL AND d."utilityRecordId" = ur."id";

UPDATE "Document" d
SET "apartmentId" = ai."apartmentId"
FROM "ApartmentInvoice" ai
WHERE d."apartmentId" IS NULL AND d."apartmentInvoiceId" = ai."id";

UPDATE "Document" d
SET "apartmentId" = pc."apartmentId"
FROM "PaymentConfirmation" pc
WHERE d."apartmentId" IS NULL AND d."paymentConfirmationId" = pc."id";

UPDATE "Document" d
SET "apartmentId" = t."apartmentId"
FROM "Task" t
WHERE d."apartmentId" IS NULL AND d."taskId" = t."id" AND t."apartmentId" IS NOT NULL;
