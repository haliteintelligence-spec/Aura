import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { getBrandDomain, searchBrandSite } from "@/lib/brand-scraper";
import type { PerfumeSearchResult } from "@/lib/types";

// ── GPT search ────────────────────────────────────────────────────────────────

async function searchWithGPT(brand?: string, name?: string): Promise<{ brand: string; results: PerfumeSearchResult[] }> {
  const hasBrand = !!brand;
  const hasName = !!name;

  let systemPrompt: string;
  let userPrompt: string;

  if (hasBrand && !hasName) {
    systemPrompt = `You are a fragrance encyclopaedia. Return every perfume made by the specified brand that you know of, sorted strictly A-Z by name. Up to 60 entries. Omit description and notes — they will be loaded later. Only include fragrances you are certain belong to this brand.`;
    userPrompt = `Brand: "${brand}"\n\nReturn JSON:\n{\n  "brand": "Exact Official Brand Name",\n  "results": [{ "name": "...", "brand": "...", "year": null, "gender": null, "description": null, "top_notes": [], "heart_notes": [], "base_notes": [], "fragrance_family": [], "image_url": null }]\n}`;
  } else if (!hasBrand && hasName) {
    systemPrompt = `You are a fragrance encyclopaedia with expert brand attribution. Return perfumes whose name STARTS WITH the given text, across all brands, sorted strictly A-Z by perfume name. Up to 20 results. Verify brand attribution carefully — never guess. Include brief notes.`;
    userPrompt = `Perfume name starts with: "${name}"\n\nReturn JSON:\n{\n  "brand": "",\n  "results": [{ "name": "...", "brand": "...", "year": null, "gender": null, "description": "...", "top_notes": ["note"], "heart_notes": [], "base_notes": [], "fragrance_family": [], "image_url": null }]\n}`;
  } else {
    systemPrompt = `You are a fragrance encyclopaedia. Find the exact perfume matching the given brand AND name. Return it first. If not found exactly, return up to 5 closest matches. Verify brand attribution carefully.`;
    userPrompt = `Brand: "${brand}", Perfume name: "${name}"\n\nReturn JSON:\n{\n  "brand": "${brand}",\n  "results": [{ "name": "...", "brand": "...", "year": null, "gender": null, "description": "...", "top_notes": ["note"], "heart_notes": [], "base_notes": [], "fragrance_family": [], "image_url": null }]\n}`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      brand: parsed.brand ?? "",
      results: Array.isArray(parsed.results) ? parsed.results : [],
    };
  } catch {
    return { brand: "", results: [] };
  }
}

// ── Database search ───────────────────────────────────────────────────────────

async function searchDatabase(brand?: string, name?: string): Promise<PerfumeSearchResult[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("perfumes")
      .select("id,name,brand,year,description,top_notes,heart_notes,base_notes,fragrance_family,gender,image_url,prices")
      .limit(40);

    if (brand && name) {
      query = query.ilike("brand", `%${brand}%`).ilike("name", `%${name}%`);
    } else if (brand) {
      query = query.ilike("brand", brand);
    } else if (name) {
      query = query.ilike("name", `%${name}%`);
    }

    const { data } = await query;
    return (data ?? []) as PerfumeSearchResult[];
  } catch {
    return [];
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

function normaliseResults(results: PerfumeSearchResult[]): PerfumeSearchResult[] {
  return results.map((r) => ({
    ...r,
    fragrance_family: r.fragrance_family?.map((f) =>
      /oriental/i.test(f) ? f.replace(/oriental/gi, "Resinous") : f
    ) ?? [],
  }));
}

export async function POST(request: NextRequest) {
  const { brand, name } = await request.json();

  const hasBrand = typeof brand === "string" && brand.trim().length >= 2;
  const hasName = typeof name === "string" && name.trim().length >= 2;

  if (!hasBrand && !hasName) {
    return NextResponse.json({ brand: "", results: [] });
  }

  const b = hasBrand ? brand.trim() : undefined;
  const n = hasName ? name.trim() : undefined;

  // 1. Database first — fast, real data, no API cost
  const dbResults = await searchDatabase(b, n);
  if (dbResults.length >= 3) {
    return NextResponse.json({ brand: b ?? dbResults[0]?.brand ?? "", results: normaliseResults(dbResults) });
  }

  // 2. Brand site scrape — before GPT, free, often has images
  let brandSiteResults: PerfumeSearchResult[] = [];
  if (hasBrand && hasName) {
    const domain = await getBrandDomain(b!).catch(() => null);
    if (domain) {
      brandSiteResults = await searchBrandSite(domain, n!, b!).catch(() => []);
    }
  }

  const seenAfterScrape = new Set(dbResults.map((r) => `${r.brand}||${r.name}`.toLowerCase()));
  const merged = [
    ...dbResults,
    ...brandSiteResults.filter((r) => !seenAfterScrape.has(`${r.brand}||${r.name}`.toLowerCase())),
  ];

  if (merged.length >= 3) {
    return NextResponse.json({ brand: b ?? merged[0]?.brand ?? "", results: normaliseResults(merged) });
  }

  // 3. GPT as last resort
  const gpt = await searchWithGPT(b, n);

  const seenAfterGPT = new Set(merged.map((r) => `${r.brand}||${r.name}`.toLowerCase()));
  const final = [
    ...merged,
    ...gpt.results.filter((r) => !seenAfterGPT.has(`${r.brand}||${r.name}`.toLowerCase())),
  ];

  return NextResponse.json({ brand: gpt.brand || b || "", results: normaliseResults(final) });
}
