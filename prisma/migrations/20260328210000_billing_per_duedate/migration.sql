-- Migration: billing unique constraint changes from (tenant, company, customer, month, year)
-- to (tenant, company, customer, dueDate), enabling multiple billings per client per month
-- when receivables have different due dates (a50).

-- Step 1: Set dueDate on all billings that don't have one (from first receivable's dueDate)
UPDATE "Billing" b
SET "dueDate" = (
    SELECT date_trunc('day', MIN(r."dueDate"))
    FROM "Receivable" r
    WHERE r."billingId" = b.id
)
WHERE b."dueDate" IS NULL;

-- Step 2: For billings that still have no dueDate (no linked receivables), use createdAt
UPDATE "Billing"
SET "dueDate" = date_trunc('day', "createdAt")
WHERE "dueDate" IS NULL;

-- Step 3: Drop old unique constraint
DROP INDEX IF EXISTS "Billing_tenantId_companyId_customerId_month_year_key";

-- Step 4: Create new unique constraint on dueDate
CREATE UNIQUE INDEX "Billing_tenantId_companyId_customerId_dueDate_key"
ON "Billing"("tenantId", "companyId", "customerId", "dueDate");

-- Step 5: Make dueDate non-nullable
ALTER TABLE "Billing" ALTER COLUMN "dueDate" SET NOT NULL;
