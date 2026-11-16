import { PrismaClient } from "@prisma/client";
import { safeErrorLog } from "@/lib/security/sanitize";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  dbDownUntil?: number;
};

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const DB_OP_TIMEOUT_MS = 6_000;
const DB_COOLDOWN_MS = 30_000;

function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "PrismaClientInitializationError" ||
    /Can't reach database|Timed out fetching a new connection|db_timeout|ECONNREFUSED|ETIMEDOUT/i.test(
      err.message
    )
  );
}

/**
 * Run a DB operation as best-effort: the database only backs caches and saved
 * trips, so an unreachable DB must never block or fail a request. After a
 * connection failure, DB calls are skipped for a short cooldown instead of
 * each one waiting out the connect timeout.
 */
export async function withDb<T>(
  label: string,
  op: () => Promise<T>,
  fallback: T
): Promise<T> {
  if (Date.now() < (globalForPrisma.dbDownUntil ?? 0)) return fallback;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      op(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("db_timeout")), DB_OP_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    if (isConnectionError(err)) {
      globalForPrisma.dbDownUntil = Date.now() + DB_COOLDOWN_MS;
    }
    safeErrorLog(`db:${label}`, err);
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
