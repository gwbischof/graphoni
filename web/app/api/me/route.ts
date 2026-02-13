import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";

export async function GET() {
  const { user, error } = await requireRole("user");
  if (error) return error;

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user!.id,
      name: user!.name,
      email: user!.email,
      image: user!.image,
      role: user!.role,
    },
  });
}
