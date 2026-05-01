/*
  Warnings:

  - The values [VIDEO] on the enum `SourceType` will be removed. If these variants are still used in the database, this will fail.
  - The `content` column on the `GeneratedDraft` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "IndexingStatus" AS ENUM ('INDEXING', 'READY', 'ERROR');

-- AlterEnum
BEGIN;
CREATE TYPE "SourceType_new" AS ENUM ('PDF', 'YOUTUBE', 'WEBPAGE');
ALTER TABLE "public"."ContentSource" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "ContentSource" ALTER COLUMN "type" TYPE "SourceType_new" USING ("type"::text::"SourceType_new");
ALTER TYPE "SourceType" RENAME TO "SourceType_old";
ALTER TYPE "SourceType_new" RENAME TO "SourceType";
DROP TYPE "public"."SourceType_old";
ALTER TABLE "ContentSource" ALTER COLUMN "type" SET DEFAULT 'PDF';
COMMIT;

-- DropForeignKey
ALTER TABLE "GeneratedDraft" DROP CONSTRAINT "GeneratedDraft_sourceId_fkey";

-- AlterTable
ALTER TABLE "ContentSource" ADD COLUMN     "indexingStatus" "IndexingStatus" NOT NULL DEFAULT 'INDEXING',
ADD COLUMN     "progressPercent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "certificationBank" JSONB,
ADD COLUMN     "finalProject" JSONB,
ADD COLUMN     "placementBank" JSONB;

-- AlterTable
ALTER TABLE "GeneratedDraft" ADD COLUMN     "certificationBank" JSONB,
ADD COLUMN     "finalProject" JSONB,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "placementBank" JSONB,
ADD COLUMN     "title" TEXT,
DROP COLUMN "content",
ADD COLUMN     "content" JSONB,
ALTER COLUMN "sourceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "GeneratedDraft" ADD CONSTRAINT "GeneratedDraft_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
