-- AddColumn IBPT rates to Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "ibptFederalPct" DECIMAL(5,2);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "ibptEstadualPct" DECIMAL(5,2);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "ibptUpdatedAt" TIMESTAMP(3);
