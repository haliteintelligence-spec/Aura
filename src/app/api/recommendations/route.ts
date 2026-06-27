import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { openai, MODEL } from "@/lib/openai";
import { sql } from "@/lib/db";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_LIMIT = 200;
const RESULT_COUNT = 6;

interface PerfumeRow {
  id: string;
  name: string;
  brand: string;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  fragrance_family: string[];
  image_url: string | null;
  description: string | null;
}

function collectionKey(name: string, brand: string) {
  return `${name.trim().toLowerCase()}|${brand.trim().toLowerCase()}`;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ recommendations: [] });
  const userId = session.user.id;

  const collectionItems = await sql<{
    perfume_id: string | null;
    perfume: PerfumeRow | null;
    user_perfume: PerfumeRow | null;
  }[]>`
    SELECT ci.perfume_id,
      row_to_json(p.*) AS perfume,
      row_to_json(up.*) AS user_perfume
    FROM collection_items ci
    LEFT JOIN perfumes p ON p.id = ci.perfume_id
    LEFT JOIN user_perfumes up ON up.id = ci.user_perfume_id
    WHERE ci.user_id = ${userId}`;

  const excludedIds = new Set<string>();
  const excludedKeys = new Set<string>();
  for (const item of collectionItems) {
    if (item.perfume_id) excludedIds.add(item.perfume_id);
    const p = (item.perfume ?? item.user_perfume) as PerfumeRow | null;
    if (p) {
      if ((p as PerfumeRow & { id?: string }).id) excludedIds.add((p as PerfumeRow & { id: string }).id);
      excludedKeys.add(collectionKey(p.name, p.brand));
    }
  }

  function isExcluded(p: PerfumeRow) {
    return excludedIds.has(p.id) || excludedKeys.has(collectionKey(p.name, p.brand));
  }

  // Check daily cache
  try {
    const cached = await sql<{ recommendations: PerfumeRow[]; updated_at: string }[]>`
      SELECT recommendations, updated_at FROM user_recommendations WHERE user_id = ${userId}`;
    if (cached[0] && Date.now() - new Date(cached[0].updated_at).getTime() < CACHE_TTL_MS) {
      const filtered = (cached[0].recommendations as PerfumeRow[]).filter((r) => !isExcluded(r));
      return NextResponse.json({ recommendations: filtered });
    }
  } catch { /* no cache */ }

  // Build taste profile
  const noteCounts: Record<string, number> = {};
  const familyCounts: Record<string, number> = {};
  const brandCounts: Record<string, number> = {};
  for (const item of collectionItems) {
    const p = (item.perfume ?? item.user_perfume) as PerfumeRow | null;
    if (!p) continue;
    for (const n of [...(p.top_notes ?? []), ...(p.heart_notes ?? []), ...(p.base_notes ?? [])]) {
      noteCounts[n] = (noteCounts[n] ?? 0) + 1;
    }
    for (const f of p.fragrance_family ?? []) familyCounts[f] = (familyCounts[f] ?? 0) + 1;
    if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] ?? 0) + 1;
  }
  const topFamilies = Object.entries(familyCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f);

  // Query candidates
  let candidates: PerfumeRow[] = [];
  if (excludedIds.size > 0 && topFamilies.length > 0) {
    candidates = await sql<PerfumeRow[]>`
      SELECT id, name, brand, top_notes, heart_notes, base_notes, fragrance_family, image_url, description
      FROM perfumes
      WHERE fragrance_family && ${topFamilies}
        AND id != ALL(${[...excludedIds]}::uuid[])
      LIMIT ${CANDIDATE_LIMIT}`;
  } else if (topFamilies.length > 0) {
    candidates = await sql<PerfumeRow[]>`
      SELECT id, name, brand, top_notes, heart_notes, base_notes, fragrance_family, image_url, description
      FROM perfumes WHERE fragrance_family && ${topFamilies} LIMIT ${CANDIDATE_LIMIT}`;
  } else {
    candidates = await sql<PerfumeRow[]>`
      SELECT id, name, brand, top_notes, heart_notes, base_notes, fragrance_family, image_url, description
      FROM perfumes LIMIT ${CANDIDATE_LIMIT}`;
  }

  const scored = candidates
    .filter((p) => !isExcluded(p))
    .map((p) => {
      let score = 0;
      for (const n of [...(p.top_notes ?? []), ...(p.heart_notes ?? []), ...(p.base_notes ?? [])]) score += noteCounts[n] ?? 0;
      for (const f of p.fragrance_family ?? []) score += (familyCounts[f] ?? 0) * 2;
      score += (brandCounts[p.brand] ?? 0) * 1.5;
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULT_COUNT);

  let picks = scored;
  if (picks.length < RESULT_COUNT) {
    const fallback = await sql<PerfumeRow[]>`
      SELECT id, name, brand, top_notes, heart_notes, base_notes, fragrance_family, image_url, description
      FROM perfumes LIMIT ${RESULT_COUNT * 3}`;
    const extra = fallback
      .filter((p) => !isExcluded(p) && !picks.some((x) => x.id === p.id))
      .slice(0, RESULT_COUNT - picks.length);
    picks = [...picks, ...extra.map((p) => ({ ...p, score: 0 }))];
  }

  if (picks.length === 0) return NextResponse.json({ recommendations: [] });

  // GPT reasons
  const topNotesList = Object.entries(noteCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
  const topBrandsList = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([b]) => b);
  let recs = picks.map((p) => ({ ...p, reason: undefined as string | undefined }));
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a concise perfume advisor. Return valid JSON only." },
        { role: "user", content: `The user loves notes: ${topNotesList.join(", ") || "various"}.\nBrands they own: ${topBrandsList.join(", ") || "various"}.\nFamilies they prefer: ${topFamilies.join(", ") || "various"}.\n\nFor each perfume, write a one-sentence reason why it suits this user.\n\nPerfumes:\n${picks.map((p, i) => `${i + 1}. ${p.brand} ${p.name} [${(p.fragrance_family ?? []).join(", ")}] — notes: ${[...(p.top_notes ?? []), ...(p.heart_notes ?? []), ...(p.base_notes ?? [])].slice(0, 5).join(", ")}`).join("\n")}\n\nReturn JSON: {"reasons": ["reason for 1", "reason for 2", ...]}` },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    recs = picks.map((p, i) => ({ ...p, reason: (parsed.reasons as string[])?.[i] }));
  } catch { /* non-critical */ }

  // Cache
  try {
    await sql`
      INSERT INTO user_recommendations (user_id, recommendations, updated_at)
      VALUES (${userId}, ${JSON.stringify(recs)}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET recommendations = EXCLUDED.recommendations, updated_at = NOW()`;
  } catch { /* non-critical */ }

  return NextResponse.json({ recommendations: recs });
}
