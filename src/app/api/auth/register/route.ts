import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length > 0) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const password_hash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();
  await sql`INSERT INTO users (id, email, name, password_hash) VALUES (${id}, ${email}, ${name ?? null}, ${password_hash})`;

  return NextResponse.json({ ok: true });
}
