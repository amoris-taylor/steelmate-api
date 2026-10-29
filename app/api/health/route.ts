import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jsonWithCors } from "@/lib/cors";
import { getRedis } from "@/lib/redis/match";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  const checks: Record<string, string> = { api: "ok" };

  try {
    if (process.env.DATABASE_URL) {
      const db = getDb();
      await db.execute(sql`select 1`);
      checks.database = "ok";
    } else {
      checks.database = "skipped";
    }
  } catch (e) {
    checks.database = e instanceof Error ? e.message : "error";
  }

  try {
    if (
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      await getRedis().ping();
      checks.redis = "ok";
    } else {
      checks.redis = "skipped";
    }
  } catch (e) {
    checks.redis = e instanceof Error ? e.message : "error";
  }

  const healthy =
    checks.database !== "error" && checks.redis !== "error";
  return jsonWithCors(
    { status: healthy ? "healthy" : "degraded", checks },
    { status: healthy ? 200 : 503, origin },
  );
}
