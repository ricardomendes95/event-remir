-- AlterEnum
ALTER TYPE "public"."RegistrationStatus" ADD VALUE 'PAYMENT_FAILED';

-- AlterTable
ALTER TABLE "public"."events" ADD COLUMN     "paymentConfig" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."registrations" ADD COLUMN     "paymentDetails" JSONB,
ADD COLUMN     "paymentError" TEXT;
