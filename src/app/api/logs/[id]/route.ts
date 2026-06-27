import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // Support updating got_compliment only, or full log update
  if (Object.keys(body).length === 1 && "got_compliment" in body) {
    await sql`UPDATE scent_logs SET got_compliment = ${body.got_compliment} WHERE id = ${id} AND user_id = ${session.user.id}`;
  } else {
    const { collection_item_ids, mood, event_type, event_types, duration, rating, notes } = body;
    await sql`
      UPDATE scent_logs SET
        collection_item_ids = ${collection_item_ids},
        mood = ${mood},
        event_type = ${event_type ?? ""},
        event_types = ${event_types ?? []},
        duration = ${duration ?? null},
        rating = ${rating ?? null},
        notes = ${notes ?? null}
      WHERE id = ${id} AND user_id = ${session.user.id}`;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await sql`DELETE FROM scent_logs WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
