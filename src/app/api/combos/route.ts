import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const savedOnly = req.nextUrl.searchParams.get("saved") === "true";
  const rows = savedOnly
    ? await sql`SELECT * FROM layer_combos WHERE user_id = ${session.user.id} AND saved = true ORDER BY created_at DESC`
    : await sql`SELECT * FROM layer_combos WHERE user_id = ${session.user.id} ORDER BY created_at DESC`;

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, collection_item_ids = [], perfume_names = [], occasion = [], season = [], mood = [],
    intensity_longevity = 5, intensity_sillage = 5, combined_profile, saved = false,
  } = body;

  const id = crypto.randomUUID();
  await sql`
    INSERT INTO layer_combos
      (id, user_id, name, collection_item_ids, perfume_names, occasion, season, mood,
       intensity_longevity, intensity_sillage, combined_profile, saved)
    VALUES
      (${id}, ${session.user.id}, ${name ?? null}, ${collection_item_ids}, ${perfume_names},
       ${occasion}, ${season}, ${mood}, ${intensity_longevity}, ${intensity_sillage},
       ${combined_profile ?? null}, ${saved})`;

  return NextResponse.json({ id });
}
