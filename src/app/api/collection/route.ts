import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");
  const rows = type
    ? await sql`
        SELECT ci.*,
          row_to_json(p.*) AS perfume,
          row_to_json(up.*) AS user_perfume
        FROM collection_items ci
        LEFT JOIN perfumes p ON p.id = ci.perfume_id
        LEFT JOIN user_perfumes up ON up.id = ci.user_perfume_id
        WHERE ci.user_id = ${session.user.id} AND ci.collection_type = ${type}
        ORDER BY ci.created_at DESC`
    : await sql`
        SELECT ci.*,
          row_to_json(p.*) AS perfume,
          row_to_json(up.*) AS user_perfume
        FROM collection_items ci
        LEFT JOIN perfumes p ON p.id = ci.perfume_id
        LEFT JOIN user_perfumes up ON up.id = ci.user_perfume_id
        WHERE ci.user_id = ${session.user.id}
        ORDER BY ci.created_at DESC`;

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    perfume_id, user_perfume_id, collection_type, bottle_sizes = [], size_prices = [],
    occasions = [], seasons = [], rating, notes, initial_level = "full", estimated_level = "full",
    available_for_swap = false,
  } = body;

  // Duplicate check
  const dupCheck = perfume_id
    ? await sql`SELECT collection_type FROM collection_items WHERE user_id = ${session.user.id} AND perfume_id = ${perfume_id} LIMIT 1`
    : await sql`SELECT collection_type FROM collection_items WHERE user_id = ${session.user.id} AND user_perfume_id = ${user_perfume_id} LIMIT 1`;
  if (dupCheck.length > 0) {
    return NextResponse.json({ error: `Already in your ${dupCheck[0].collection_type}` }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await sql`
    INSERT INTO collection_items
      (id, user_id, perfume_id, user_perfume_id, collection_type, bottle_sizes, size_prices,
       occasions, seasons, rating, notes, initial_level, estimated_level, available_for_swap)
    VALUES
      (${id}, ${session.user.id}, ${perfume_id ?? null}, ${user_perfume_id ?? null},
       ${collection_type}, ${bottle_sizes}, ${JSON.stringify(size_prices)},
       ${occasions}, ${seasons}, ${rating ?? null}, ${notes ?? null},
       ${initial_level}, ${estimated_level}, ${available_for_swap})`;

  return NextResponse.json({ id });
}
