-- CreateTable
CREATE TABLE "auth_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "method" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER DEFAULT 100,
    "tags" JSONB,
    "authConfig" JSONB NOT NULL,
    "conditions" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "auth_profiles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "auth_profiles_projectId_idx" ON "auth_profiles"("projectId");

-- CreateIndex
CREATE INDEX "auth_profiles_method_idx" ON "auth_profiles"("method");

-- CreateIndex
CREATE INDEX "auth_profiles_enabled_idx" ON "auth_profiles"("enabled");

-- CreateIndex
CREATE INDEX "auth_profiles_priority_idx" ON "auth_profiles"("priority");
