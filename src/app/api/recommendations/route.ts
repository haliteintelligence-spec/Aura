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

function collectionKey(name: string, brand: string) {
  return `${name.trim().toLowerCase()}|${brand.trim().toLowerCase()}`;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ recommendations: [] });

  // ── 1. Load user's entire collection (all types) — always needed for exclusion ─
  const { data: collectionItems } = await supabase
    .from("collection_items")
    .select("perfume_id, perfume:perfumes(id, name, brand, top_notes, heart_notes, base_notes, fragrance_family), user_perfume:user_perfumes(name, brand, top_notes, heart_notes, base_notes, fragrance_family)")
    .eq("user_id", user.id);

  // Build exclusion sets: by perfume_id AND by name+brand (catches user_perfumes)
  const excludedIds = new Set<string>();
  const excludedKeys = new Set<string>();

  for (const item of collectionItems ?? []) {
    if (item.perfume_id) excludedIds.add(item.perfume_id);
    const p = (item.perfume ?? item.user_perfume) as unknown as { id?: string; name: string; brand: string } | null;
    if (p) {
      if (p.id) excludedIds.add(p.id);
      excludedKeys.add(collectionKey(p.name, p.brand));
    }
  }

  function isExcluded(p: PerfumeRow) {
    return excludedIds.has(p.id) || excludedKeys.has(collectionKey(p.name, p.brand));
  }

  // ── 2. Check daily cache — re-filter against current collection before serving ─
  try {
    const { data: cached } = await supabase
      .from("user_recommendations")
      .select("recommendations, updated_at")
      .eq("user_id", user.id)
      .single();

    if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS) {
      const filtered = (cached.recommendations as PerfumeRow[]).filter((r) => !isExcluded(r));
      return NextResponse.json({ recommendations: filtered });
    }
  } catch { /* no cache row yet — proceed to compute */ }

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

  // ── 4. Query DB for candidates ───────────────────────────────────────────────
  let dbQuery = supabase
    .from("perfumes")
    .select("id, name, brand, top_notes, heart_notes, base_notes, fragrance_family, image_url, description")
    .limit(CANDIDATE_LIMIT);

  if (topFamilies.length > 0) {
    dbQuery = dbQuery.overlaps("fragrance_family", topFamilies);
  }

  if (excludedIds.size > 0) {
    dbQuery = dbQuery.not("id", "in", `(${[...excludedIds].join(",")})`);
  }

  const { data: candidates } = await dbQuery;

  // ── 5. Score, filter, pick ───────────────────────────────────────────────────
  const scored = (candidates as PerfumeRow[] ?? [])
    .filter((p) => !isExcluded(p))
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

  let picks = scored;

  // Fallback: fetch more if not enough matches
  if (picks.length < RESULT_COUNT) {
    const placeholder = "(00000000-0000-0000-0000-000000000000)";
    const { data: fallback } = await supabase
      .from("perfumes")
      .select("id, name, brand, top_notes, heart_notes, base_notes, fragrance_family, image_url, description")
      .not("id", "in", excludedIds.size > 0 ? `(${[...excludedIds].join(",")})` : placeholder)
      .limit(RESULT_COUNT - picks.length + 20);

    const extra = (fallback as PerfumeRow[] ?? [])
      .filter((p) => !isExcluded(p) && !picks.some((x) => x.id === p.id))
      .slice(0, RESULT_COUNT - picks.length);

    picks = [...picks, ...extra.map((p) => ({ ...p, score: 0 }))];
  }

  if (picks.length === 0) return NextResponse.json({ recommendations: [] });

  // ── 6. GPT: one-sentence reason per pick ─────────────────────────────────────
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
  } catch { /* non-critical */ }

  // ── 7. Cache ─────────────────────────────────────────────────────────────────
  try {
    await supabase.from("user_recommendations").upsert({
      user_id: user.id,
      recommendations: recs,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  } catch { /* non-critical */ }

  return NextResponse.json({ recommendations: recs });
}
