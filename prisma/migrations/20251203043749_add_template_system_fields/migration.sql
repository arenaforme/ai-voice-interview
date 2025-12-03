/*
  Warnings:

  - You are about to drop the column `questionCount` on the `InterviewTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "minRounds" INTEGER NOT NULL DEFAULT 5,
ALTER COLUMN "maxRounds" SET DEFAULT 10;

-- AlterTable
ALTER TABLE "InterviewTemplate" DROP COLUMN "questionCount",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxQuestions" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "minQuestions" INTEGER NOT NULL DEFAULT 5;

-- AddForeignKey
ALTER TABLE "InterviewTemplate" ADD CONSTRAINT "InterviewTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
