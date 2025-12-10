-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('MANUAL', 'REALTIME');

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "mode" "InterviewMode" NOT NULL DEFAULT 'MANUAL';
