-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PDF', 'VIDEO', 'WEBPAGE');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "SourceType" NOT NULL DEFAULT 'PDF',
    "url" TEXT,
    "courseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDraft" (
    "id" TEXT NOT NULL,
    "syllabus" JSONB,
    "content" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "teacherId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDraft_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContentSource" ADD CONSTRAINT "ContentSource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDraft" ADD CONSTRAINT "GeneratedDraft_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDraft" ADD CONSTRAINT "GeneratedDraft_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
