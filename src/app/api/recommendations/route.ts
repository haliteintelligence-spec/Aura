import { NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ recommendations: [] });

  // ── 1. Check daily cache ─────────────────────────────────────────────────────
  try {
    const { data: cached } = await supabase
      .from("user_recommendations")
      .select("recommendations, updated_at")
      .eq("user_id", user.id)
      .single();

    if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS) {
      return NextResponse.json({ recommendations: cached.recommendations });
    }
  } catch { /* table may not exist yet or no row — proceed */ }

  // ── 2. Load user's entire collection (all types) ─────────────────────────────
  const { data: collectionItems } = await supabase
    .from("collection_items")
    .select("perfume_id, perfume:perfumes(name, brand, top_notes, heart_notes, base_notes, fragrance_family), user_perfume:user_perfumes(name, brand, top_notes, heart_notes, base_notes, fragrance_family)")
    .eq("user_id", user.id);

  const excludedPerfumeIds = new Set<string>(
    (collectionItems ?? []).map((i) => i.perfume_id).filter(Boolean)
  );

  // ── 3. Build taste profile from collection ───────────────────────────────────
  const noteCounts: Record<string, number> = {};
  const familyCounts: Record<string, number> = {};
  const brandCounts: Record<string, number> = {};

  for (const item of collectionItems ?? []) {
    const p = (item.perfume ?? item.user_perfume) as unknown as PerfumeRow | null;
    if (!p) continue;
    for (const n of [...(p.top_notes ?? []), ...(p.heart_notes ?? []), ...(p.base_notes ?? [])]) {
      noteCounts[n] = (noteCounts[n] ?? 0) + 1;
    }
    for (const f of p.fragrance_family ?? []) {
      familyCounts[f] = (familyCounts[f] ?? 0) + 1;
    }
    if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] ?? 0) + 1;
  }

  const topFamilies = Object.entries(familyCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f);

  // ── 4. Query DB for candidates not already in collections ────────────────────
  let dbQuery = supabase
    .from("perfumes")
    .select("id, name, brand, top_notes, heart_notes, base_notes, fragrance_family, image_url, description")
    .limit(CANDIDATE_LIMIT);

  // Filter by preferred families if the user has taste data
  if (topFamilies.length > 0) {
    dbQuery = dbQuery.overlaps("fragrance_family", topFamilies);
  }

  // Exclude already-owned perfumes
  if (excludedPerfumeIds.size > 0) {
    dbQuery = dbQuery.not("id", "in", `(${[...excludedPerfumeIds].join(",")})`);
  }

  const { data: candidates } = await dbQuery;

  // ── 5. Score candidates by taste profile overlap ─────────────────────────────
  const scored = (candidates as PerfumeRow[] ?? [])
    .map((p) => {
      let score = 0;
      const allNotes = [...(p.top_notes ?? []), ...(p.heart_notes ?? []), ...(p.base_notes ?? [])];
      for (const n of allNotes) score += noteCounts[n] ?? 0;
      for (const f of p.fragrance_family ?? []) score += (familyCounts[f] ?? 0) * 2;
      score += (brandCounts[p.brand] ?? 0) * 1.5;
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULT_COUNT);

  // If DB has no good matches (empty collection / no families match), fall back
  // to a random sample of DB perfumes not in the user's collection
  let picks = scored;
  if (picks.length < RESULT_COUNT) {
    const { data: fallback } = await supabase
      .from("perfumes")
      .select("id, name, brand, top_notes, heart_notes, base_notes, fragrance_family, image_url, description")
      .not("id", "in", excludedPerfumeIds.size > 0 ? `(${[...excludedPerfumeIds].join(",")})` : "(00000000-0000-0000-0000-000000000000)")
      .limit(RESULT_COUNT - picks.length + 20);

    const fallbackFiltered = (fallback as PerfumeRow[] ?? [])
      .filter((p) => !picks.some((x) => x.id === p.id))
      .slice(0, RESULT_COUNT - picks.length);

    picks = [...picks, ...fallbackFiltered.map((p) => ({ ...p, score: 0 }))];
  }

  if (picks.length === 0) return NextResponse.json({ recommendations: [] });

  // ── 6. GPT: add a short personalised "reason" for each pick ─────────────────
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
        {
          role: "user",
          content: `The user loves notes: ${topNotesList.join(", ") || "various"}.
Brands they own: ${topBrandsList.join(", ") || "various"}.
Families they prefer: ${topFamilies.join(", ") || "various"}.

For each perfume, write a one-sentence reason why it suits this user.

Perfumes:
${picks.map((p, i) => `${i + 1}. ${p.brand} ${p.name} [${(p.fragrance_family ?? []).join(", ")}] — notes: ${[...(p.top_notes ?? []), ...(p.heart_notes ?? []), ...(p.base_notes ?? [])].slice(0, 5).join(", ")}`).join("\n")}

Return JSON: {"reasons": ["reason for 1", "reason for 2", ...]}`,
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const reasons: string[] = parsed.reasons ?? [];
    recs = picks.map((p, i) => ({ ...p, reason: reasons[i] ?? undefined }));
  } catch { /* non-critical — recommendations are still valid without reason text */ }

  // ── 7. Cache results ─────────────────────────────────────────────────────────
  try {
    await supabase.from("user_recommendations").upsert({
      user_id: user.id,
      recommendations: recs,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  } catch { /* non-critical */ }

  return NextResponse.json({ recommendations: recs });
}
