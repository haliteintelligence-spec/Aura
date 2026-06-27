import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, brand, year, description, top_notes = [], heart_notes = [], base_notes = [], fragrance_family = [], gender, image_url } = body;

  // Upsert: if same user+name+brand exists, return the existing id
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM user_perfumes WHERE user_id = ${session.user.id} AND name = ${name} AND brand = ${brand}`;
  if (existing[0]) return NextResponse.json({ id: existing[0].id });

  const id = crypto.randomUUID();
  await sql`
    INSERT INTO user_perfumes (id, user_id, name, brand, year, description, top_notes, heart_notes, base_notes, fragrance_family, gender, image_url)
    VALUES (${id}, ${session.user.id}, ${name}, ${brand}, ${year ?? null}, ${description ?? null},
            ${top_notes}, ${heart_notes}, ${base_notes}, ${fragrance_family}, ${gender ?? null}, ${image_url ?? null})`;

  return NextResponse.json({ id });
}
