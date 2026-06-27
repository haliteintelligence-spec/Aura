import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const fields = Object.entries(body);
  if (fields.length === 0) return NextResponse.json({ ok: true });

  // Build dynamic update — only allow known safe columns
  const ALLOWED = new Set([
    "collection_type", "bottle_sizes", "size_prices", "occasions", "seasons",
    "rating", "notes", "initial_level", "estimated_level", "available_for_swap",
  ]);
  const updates = fields.filter(([k]) => ALLOWED.has(k));
  if (updates.length === 0) return NextResponse.json({ ok: true });

  for (const [col, val] of updates) {
    const v = col === "size_prices" ? JSON.stringify(val) : val;
    await sql`UPDATE collection_items SET ${sql(col)} = ${v as string}, updated_at = NOW()
              WHERE id = ${id} AND user_id = ${session.user.id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await sql`DELETE FROM collection_items WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
