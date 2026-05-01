-- AlterEnum
ALTER TYPE "DraftStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "GeneratedDraft" ADD COLUMN     "progressPercent" INTEGER NOT NULL DEFAULT 0;
