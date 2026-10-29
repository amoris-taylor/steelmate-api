import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

export async function requireAuthUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new AuthError("Unauthorized", 401);
  await ensureUserRow(userId);
  return userId;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function ensureUserRow(clerkId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ clerkId: users.clerkId })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (rows.length > 0) return;
  const user = await currentUser();
  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    null;
  await db.insert(users).values({ clerkId, displayName }).onConflictDoNothing();
}
