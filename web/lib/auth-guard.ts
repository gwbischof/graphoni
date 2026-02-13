import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, users } from "@/lib/db/schema";

type Role = "guest" | "user" | "mod" | "admin";

const ROLE_LEVEL: Record<Role, number> = {
  guest: 0,
  user: 1,
  mod: 2,
  admin: 3,
};

async function resolveApiKey(): Promise<{
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: Role;
} | null> {
  const h = await headers();
  const authHeader = h.get("authorization");
  if (!authHeader?.startsWith("Bearer gk_")) return null;

  const rawKey = authHeader.slice(7); // "Bearer " = 7 chars
  const hash = createHash("sha256").update(rawKey).digest("hex");

  const rows = await db
    .select({
      keyId: apiKeys.id,
      revoked: apiKeys.revoked,
      expiresAt: apiKeys.expiresAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
      userRole: users.role,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(eq(apiKeys.key, hash))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.revoked) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  // Update lastUsedAt (fire and forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.keyId))
    .then(() => {})
    .catch(() => {});

  return {
    id: row.userId,
    name: row.userName,
    email: row.userEmail,
    image: row.userImage,
    role: row.userRole as Role,
  };
}

export async function requireRole(minimumRole: Role) {
  // Try NextAuth session first
  const session = await auth();

  if (session?.user) {
    const userRole = (session.user.role ?? "user") as Role;
    if (minimumRole !== "guest" && ROLE_LEVEL[userRole] < ROLE_LEVEL[minimumRole]) {
      return {
        session,
        user: session.user,
        error: NextResponse.json(
          {
            error: "Insufficient permissions",
            required: minimumRole,
            current: userRole,
          },
          { status: 403 }
        ),
      };
    }
    return { session, user: session.user };
  }

  // Fall back to API key
  const apiKeyUser = await resolveApiKey();

  if (apiKeyUser) {
    const userRole = apiKeyUser.role;
    if (minimumRole !== "guest" && ROLE_LEVEL[userRole] < ROLE_LEVEL[minimumRole]) {
      return {
        session: null,
        user: apiKeyUser,
        error: NextResponse.json(
          {
            error: "Insufficient permissions",
            required: minimumRole,
            current: userRole,
          },
          { status: 403 }
        ),
      };
    }
    return { session: null, user: apiKeyUser };
  }

  // No auth at all
  if (minimumRole === "guest") {
    return { session: null, user: null };
  }

  return {
    session: null,
    user: null,
    error: NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    ),
  };
}
