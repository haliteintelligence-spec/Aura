import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const ALLOWED = new Set(["name", "occasion", "season", "mood", "intensity_longevity", "intensity_sillage", "combined_profile", "saved", "perfume_names", "collection_item_ids"]);
  for (const [col, val] of Object.entries(body)) {
    if (!ALLOWED.has(col)) continue;
    await sql`UPDATE layer_combos SET ${sql(col)} = ${val as string} WHERE id = ${id} AND user_id = ${session.user.id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await sql`DELETE FROM layer_combos WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
