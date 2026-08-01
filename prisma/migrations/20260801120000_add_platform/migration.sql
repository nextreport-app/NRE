-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('META', 'GOOGLE');

-- AlterTable: which ad platform the report's CSV came from (Meta vs Google
-- Ads) — see prisma/schema.prisma's Platform enum comment for what each
-- drives.
ALTER TABLE "Report" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'META';
