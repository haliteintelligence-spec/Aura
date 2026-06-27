import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`SELECT id, email, name, image FROM users WHERE id = ${session.user.id}`;
  return NextResponse.json({ user: rows[0] ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  await sql`UPDATE users SET name = ${name} WHERE id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
