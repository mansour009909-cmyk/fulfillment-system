-- AlterTable: Employee becomes the single unified account (mobile PIN + web login)
ALTER TABLE "Employee" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "username" TEXT,
ALTER COLUMN "pinHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_username_key" ON "Employee"("username");

-- Data migration: move AdminUser rows into Employee (no name collisions in current data)
INSERT INTO "Employee" ("name", "username", "passwordHash", "role", "active", "createdAt")
SELECT "username", "username", "passwordHash", "role", "active", "createdAt" FROM "AdminUser";

-- CreateTable
CREATE TABLE "EmployeePermission" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "module" TEXT NOT NULL,

    CONSTRAINT "EmployeePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePermission_employeeId_module_key" ON "EmployeePermission"("employeeId", "module");

-- Data migration: move AdminPermission rows into EmployeePermission (matched via username)
INSERT INTO "EmployeePermission" ("employeeId", "module")
SELECT e."id", ap."module"
FROM "AdminPermission" ap
JOIN "AdminUser" au ON au."id" = ap."adminUserId"
JOIN "Employee" e ON e."username" = au."username";

-- DropForeignKey
ALTER TABLE "AdminPermission" DROP CONSTRAINT "AdminPermission_adminUserId_fkey";

-- DropTable
DROP TABLE "AdminPermission";

-- DropTable
DROP TABLE "AdminUser";

-- AddForeignKey
ALTER TABLE "EmployeePermission" ADD CONSTRAINT "EmployeePermission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
