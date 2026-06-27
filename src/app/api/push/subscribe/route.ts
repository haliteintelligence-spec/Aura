import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription } = await req.json();
  const { endpoint, keys: { p256dh, auth: authKey } } = subscription;

  await sql`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (${crypto.randomUUID()}, ${session.user.id}, ${endpoint}, ${p256dh}, ${authKey})
    ON CONFLICT (user_id, endpoint) DO NOTHING`;

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await req.json();
  await sql`DELETE FROM push_subscriptions WHERE user_id = ${session.user.id} AND endpoint = ${endpoint}`;

  return NextResponse.json({ ok: true });
}
