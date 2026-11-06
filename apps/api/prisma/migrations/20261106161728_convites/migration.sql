-- CreateTable
CREATE TABLE "ManagerInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerInvite_workspaceId_managerId_key" ON "ManagerInvite"("workspaceId", "managerId");

-- AddForeignKey
ALTER TABLE "ManagerInvite" ADD CONSTRAINT "ManagerInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
