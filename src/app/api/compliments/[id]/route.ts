import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { collection_item_ids, perfume_names, compliment_count } = await req.json();

  const fields = Object.entries({ collection_item_ids, perfume_names, compliment_count })
    .filter(([, v]) => v !== undefined);
  if (fields.length === 0) return NextResponse.json({ ok: true });

  for (const [col, val] of fields) {
    await sql`UPDATE compliment_entries SET ${sql(col)} = ${val as string}
              WHERE id = ${id} AND user_id = ${session.user.id}`;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await sql`DELETE FROM compliment_entries WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
