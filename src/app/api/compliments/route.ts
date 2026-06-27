import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT * FROM compliment_entries WHERE user_id = ${session.user.id} ORDER BY date DESC, created_at DESC`;
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { collection_item_ids = [], perfume_names = [], date } = await req.json();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO compliment_entries (id, user_id, collection_item_ids, perfume_names, date)
    VALUES (${id}, ${session.user.id}, ${collection_item_ids}, ${perfume_names}, ${date ?? new Date().toISOString().slice(0, 10)})`;

  return NextResponse.json({ id });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  await sql`DELETE FROM compliment_entries WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
