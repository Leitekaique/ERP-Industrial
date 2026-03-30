-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "cityCode" TEXT,
ADD COLUMN     "crt" TEXT DEFAULT '1',
ADD COLUMN     "icmsSnRate" DECIMAL(65,30),
ADD COLUMN     "number" TEXT,
ADD COLUMN     "zip" TEXT;
