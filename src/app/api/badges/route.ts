import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = session.user.id;

  const [allBadges, earnedBadges, collectionCount, logCount, comboCount, swapCount, familyItems, recentLogs] = await Promise.all([
    sql`SELECT * FROM badges`,
    sql`SELECT ub.*, row_to_json(b.*) AS badge FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = ${uid}`,
    sql`SELECT COUNT(*) FROM collection_items WHERE user_id = ${uid}`,
    sql`SELECT COUNT(*) FROM scent_logs WHERE user_id = ${uid}`,
    sql`SELECT COUNT(*) FROM layer_combos WHERE user_id = ${uid}`,
    sql`SELECT COUNT(*) FROM swap_listings WHERE user_id = ${uid}`,
    sql`SELECT ci.perfume_id, p.fragrance_family, up.fragrance_family AS up_family
        FROM collection_items ci
        LEFT JOIN perfumes p ON p.id = ci.perfume_id
        LEFT JOIN user_perfumes up ON up.id = ci.user_perfume_id
        WHERE ci.user_id = ${uid}`,
    sql`SELECT created_at FROM scent_logs WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 60`,
  ]);

  const familiesSet = new Set<string>();
  for (const row of familyItems) {
    for (const f of ((row.fragrance_family ?? row.up_family) as string[] | null) ?? []) familiesSet.add(f);
  }

  const logDays = new Set((recentLogs as unknown as { created_at: string }[]).map((l) => new Date(l.created_at).toISOString().slice(0, 10)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (logDays.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }

  const counts = {
    collection_count: parseInt((collectionCount[0] as { count: string }).count),
    log_count: parseInt((logCount[0] as { count: string }).count),
    combo_count: parseInt((comboCount[0] as { count: string }).count),
    swap_count: parseInt((swapCount[0] as { count: string }).count),
    families_explored: familiesSet.size,
    streak_days: streak,
  };

  return NextResponse.json({ allBadges, earnedBadges, counts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { badge_ids } = await req.json();
  if (!badge_ids?.length) return NextResponse.json({ ok: true });

  for (const badge_id of badge_ids as string[]) {
    await sql`
      INSERT INTO user_badges (user_id, badge_id) VALUES (${session.user.id}, ${badge_id})
      ON CONFLICT DO NOTHING`;
  }
  return NextResponse.json({ ok: true });
}
