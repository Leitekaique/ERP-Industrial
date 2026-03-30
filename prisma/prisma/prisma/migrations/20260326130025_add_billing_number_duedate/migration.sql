-- AlterTable
ALTER TABLE "Billing" ADD COLUMN     "billingNumber" SERIAL NOT NULL,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3);
