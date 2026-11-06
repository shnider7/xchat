/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'TESTE',
ADD COLUMN     "planPeriod" TEXT NOT NULL DEFAULT 'MENSAL',
ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'ATIVA',
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
