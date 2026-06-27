import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const ALLOWED = new Set(["image_url", "description", "top_notes", "heart_notes", "base_notes", "fragrance_family", "product_type"]);
  for (const [col, val] of Object.entries(body)) {
    if (!ALLOWED.has(col)) continue;
    await sql`UPDATE perfumes SET ${sql(col)} = ${val as string} WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}
