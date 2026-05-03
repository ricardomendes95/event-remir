-- AlterEnum
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'FREE';

-- CreateEnum
CREATE TYPE "public"."EventFormMode" AS ENUM ('FIXED_ONLY', 'DYNAMIC_ONLY', 'BOTH');

-- AlterTable
ALTER TABLE "public"."events" ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "formMode" "public"."EventFormMode" NOT NULL DEFAULT 'FIXED_ONLY',
ADD COLUMN     "dynamicFormFields" JSONB;

-- AlterTable
ALTER TABLE "public"."registrations" ADD COLUMN     "dynamicFormData" JSONB,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "cpf" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;
