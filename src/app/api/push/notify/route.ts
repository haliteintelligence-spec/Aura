import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import webpush from "web-push";

export async function POST(req: NextRequest) {
  webpush.setVapidDetails(
    "mailto:nnubdy@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, body, url } = await req.json();

  const subs = await sql<{ endpoint: string; p256dh: string; auth: string }[]>`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${session.user.id}`;

  if (!subs.length) return NextResponse.json({ sent: 0 });

  const payload = JSON.stringify({ title, body, url: url ?? "/closet" });
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
        }
      }
    })
  );

  return NextResponse.json({ sent });
}
