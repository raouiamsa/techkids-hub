/*
  Warnings:

  - You are about to drop the column `teacherFeedback` on the `GeneratedDraft` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GeneratedDraft" DROP COLUMN "teacherFeedback",
ADD COLUMN     "generalFeedback" TEXT,
ADD COLUMN     "initialPrompt" TEXT,
ADD COLUMN     "moduleFeedbacks" JSONB;
