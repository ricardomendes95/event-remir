-- AlterTable: tornar name e cpf obrigatórios (NOT NULL)
-- Backfill de registros criados sem esses campos (dados de teste DYNAMIC_ONLY)
UPDATE "public"."registrations" SET "name" = 'Participante' WHERE "name" IS NULL;
UPDATE "public"."registrations" SET "cpf" = '00000000000' WHERE "cpf" IS NULL;

ALTER TABLE "public"."registrations" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "public"."registrations" ALTER COLUMN "cpf" SET NOT NULL;
