import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth-guard";

export async function GET() {
  const { error } = await requireRole("admin");
  if (error) return error;

  const rows = await db
    .select({
      id: apiKeys.id,
      prefix: apiKeys.prefix,
      name: apiKeys.name,
      userId: apiKeys.userId,
      userName: users.name,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revoked: apiKeys.revoked,
    })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.userId, users.id))
    .orderBy(desc(apiKeys.createdAt));

  return NextResponse.json({ keys: rows });
}

export async function POST(request: NextRequest) {
  const { error } = await requireRole("admin");
  if (error) return error;

  const body = await request.json();
  const { name, userId, expiresAt } = body;

  if (!name || !userId) {
    return NextResponse.json(
      { error: "name and userId are required" },
      { status: 400 }
    );
  }

  // Verify user exists
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Generate key: gk_ + 32 hex chars
  const raw = `gk_${randomBytes(16).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 11); // "gk_" + first 8 hex chars

  const [row] = await db
    .insert(apiKeys)
    .values({
      key: hash,
      prefix,
      name,
      userId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning();

  return NextResponse.json(
    {
      id: row.id,
      key: raw, // Only time the raw key is returned
      prefix: row.prefix,
      name: row.name,
      createdAt: row.createdAt,
    },
    { status: 201 }
  );
}
