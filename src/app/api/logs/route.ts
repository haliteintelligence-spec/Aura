import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
  const rows = await sql`
    SELECT * FROM scent_logs
    WHERE user_id = ${session.user.id}
    ORDER BY date DESC, created_at DESC
    LIMIT ${limit}`;

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    collection_item_ids = [], date, mood = [], event_type, event_types = [],
    rating, duration, notes, got_compliment = false, spray_intensities,
  } = body;

  const id = crypto.randomUUID();
  await sql`
    INSERT INTO scent_logs
      (id, user_id, collection_item_ids, date, mood, event_type, event_types,
       rating, duration, notes, got_compliment, spray_intensities)
    VALUES
      (${id}, ${session.user.id}, ${collection_item_ids}, ${date},
       ${mood}, ${event_type ?? null}, ${event_types},
       ${rating ?? null}, ${duration ?? null}, ${notes ?? null},
       ${got_compliment}, ${spray_intensities ? JSON.stringify(spray_intensities) : null})`;

  return NextResponse.json({ id });
}
