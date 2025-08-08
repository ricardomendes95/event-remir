-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('MERCADO_PAGO', 'MANUAL');

-- AlterTable
ALTER TABLE "public"."registrations" ADD COLUMN     "paymentMethod" "public"."PaymentMethod" NOT NULL DEFAULT 'MERCADO_PAGO';
