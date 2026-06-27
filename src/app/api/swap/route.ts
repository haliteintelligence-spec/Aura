import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const mine = req.nextUrl.searchParams.get("mine") === "true";
  if (mine) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ data: [] });
    const rows = await sql`
      SELECT sl.*, row_to_json(ci.*) AS collection_item
      FROM swap_listings sl
      JOIN collection_items ci ON ci.id = sl.collection_item_id
      WHERE sl.user_id = ${session.user.id}
      ORDER BY sl.created_at DESC`;
    return NextResponse.json({ data: rows });
  }
  const rows = await sql`
    SELECT sl.*,
      row_to_json(ci.*) AS collection_item,
      json_build_object('id', u.id, 'email', u.email, 'name', u.name) AS profile
    FROM swap_listings sl
    JOIN collection_items ci ON ci.id = sl.collection_item_id
    JOIN users u ON u.id = sl.user_id
    WHERE sl.status = 'available'
    ORDER BY sl.created_at DESC`;
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { collection_item_id, description } = await req.json();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO swap_listings (id, user_id, collection_item_id, description)
    VALUES (${id}, ${session.user.id}, ${collection_item_id}, ${description ?? null})`;

  await sql`
    UPDATE collection_items SET available_for_swap = true
    WHERE id = ${collection_item_id} AND user_id = ${session.user.id}`;

  return NextResponse.json({ id });
}
