-- AlterTable
ALTER TABLE "Nfe" ADD COLUMN     "freightType" TEXT,
ADD COLUMN     "vehiclePlate" TEXT,
ADD COLUMN     "vehicleUf" TEXT,
ADD COLUMN     "volumesBrand" TEXT,
ADD COLUMN     "volumesQty" INTEGER,
ADD COLUMN     "volumesSpecies" TEXT,
ADD COLUMN     "weightGross" DECIMAL(14,3),
ADD COLUMN     "weightNet" DECIMAL(14,3);
