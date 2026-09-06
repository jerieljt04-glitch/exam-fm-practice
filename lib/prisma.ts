// Prisma Client singleton with safe runtime resolution

type PrismaClientType = any;

let PrismaClientConstructor: any = null;

try {
  // Dynamically require to prevent compile/runtime failure if prisma generate hasn't run
  const clientModule = require("@prisma/client");
  PrismaClientConstructor = clientModule.PrismaClient;
} catch {
  // Prisma client not yet generated
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

export const prisma: PrismaClientType =
  globalForPrisma.prisma ??
  (PrismaClientConstructor
    ? new PrismaClientConstructor({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      })
    : null);

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
