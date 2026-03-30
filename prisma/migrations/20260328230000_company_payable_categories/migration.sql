-- AddColumn payableCategories to Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "payableCategories" JSONB DEFAULT '[]';
