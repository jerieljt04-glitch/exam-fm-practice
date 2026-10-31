import path from "path";

import { PrismaClient } from "@prisma/client";

/**
 * The SQLite database. Defaults to data/exam-fm.db in the project folder;
 * EXAM_FM_DATABASE_URL overrides it (the test suite uses a temporary file).
 */
export const DATABASE_URL = process.env.EXAM_FM_DATABASE_URL?.startsWith("file:")
  ? resolveFileUrl(process.env.EXAM_FM_DATABASE_URL)
  : `file:${path.join(process.cwd(), "data", "exam-fm.db")}`;

function resolveFileUrl(url: string): string {
  const target = url.slice("file:".length);
  // Relative URLs in the environment are relative to prisma/ (Prisma's convention).
  return path.isAbsolute(target) ? url : `file:${path.resolve(process.cwd(), "prisma", target)}`;
}

declare global {
  // eslint-disable-next-line no-var
  var __examFmPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__examFmPrisma ?? new PrismaClient({ datasourceUrl: DATABASE_URL, log: ["error"] });

if (process.env.NODE_ENV !== "production") globalThis.__examFmPrisma = prisma;
