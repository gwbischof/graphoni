import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth-guard";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await requireRole("admin");
  if (error) return error;

  const [row] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  await db
    .update(apiKeys)
    .set({ revoked: true })
    .where(eq(apiKeys.id, id));

  return NextResponse.json({ revoked: true });
}
