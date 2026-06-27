import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { sql } from "@/lib/db";
import { getBrandDomainAny, searchBrandSite } from "@/lib/brand-scraper";
import type { BeautyProduct, BeautyCategory } from "@/lib/types";

const VALID_CATEGORIES = new Set(["skincare", "bodycare", "haircare", "candle", "home_fragrance", "fragrance", "other"]);

// ── Database search ───────────────────────────────────────────────────────────

async function searchDB(query: string, category?: string): Promise<BeautyProduct[]> {
  try {
    const like = '%' + query + '%';
    const rows = category && VALID_CATEGORIES.has(category)
      ? await sql<BeautyProduct[]>`
          SELECT id,name,brand,category,subcategory,description,key_ingredients,full_ingredients,scent_notes,image_url,prices,tags,source_url
          FROM beauty_products WHERE (name ILIKE ${like} OR brand ILIKE ${like}) AND category = ${category} LIMIT 30`
      : await sql<BeautyProduct[]>`
          SELECT id,name,brand,category,subcategory,description,key_ingredients,full_ingredients,scent_notes,image_url,prices,tags,source_url
          FROM beauty_products WHERE name ILIKE ${like} OR brand ILIKE ${like} LIMIT 30`;
    return rows;
  } catch {
    return [];
  }
}

// ── GPT enrichment ────────────────────────────────────────────────────────────

async function searchWithGPT(query: string, category?: string): Promise<BeautyProduct[]> {
  const categoryHint = category ? `Focus on ${category} products.` : "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a beauty product encyclopaedia. Return up to 8 matching beauty products for the given query. ${categoryHint} Categories: skincare, bodycare, haircare, candle, home_fragrance, fragrance, other. Use 'fragrance' for hair mists, body mists, body sprays, and hair perfumes.`,
        },
        {
          role: "user",
          content: `Query: "${query}"\n\nReturn JSON with ALL price variants and FULL ingredient list for each product:\n{"results":[{"name":"...","brand":"...","category":"skincare","subcategory":"serum","description":"...","key_ingredients":["Vitamin C","Hyaluronic Acid"],"full_ingredients":"Aqua, Glycerin, Niacinamide...","scent_notes":[],"tags":["vegan"],"image_url":null,"prices":[{"size":"30ml","price_min":45,"price_max":45,"currency":"USD"},{"size":"50ml","price_min":65,"price_max":65,"currency":"USD"}]}]}`,
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    return results.filter((r: BeautyProduct) => r.name && r.brand) as BeautyProduct[];
  } catch {
    return [];
  }
}

// ── Brand site image enrichment ───────────────────────────────────────────────

async function enrichImagesFromBrandSite(products: BeautyProduct[]): Promise<BeautyProduct[]> {
  const brandDomainCache = new Map<string, string | null>();

  return Promise.all(
    products.map(async (p) => {
      if (p.image_url) return p;

      let domain = brandDomainCache.get(p.brand);
      if (domain === undefined) {
        domain = await getBrandDomainAny(p.brand).catch(() => null);
        brandDomainCache.set(p.brand, domain);
      }
      if (!domain) return p;

      try {
        const hits = await searchBrandSite(domain, p.name, p.brand);
        const withImage = hits.find((h) => h.image_url);
        return withImage ? { ...p, image_url: withImage.image_url } : p;
      } catch {
        return p;
      }
    })
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { query, category } = await request.json() as { query?: string; category?: string };

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const q = query.trim();
  const cat = category && VALID_CATEGORIES.has(category) ? category : undefined;

  // 1. DB first
  const dbResults = await searchDB(q, cat);
  if (dbResults.length >= 5) {
    return NextResponse.json({ results: dbResults });
  }

  // 2. Brand site scrape — for image enrichment and supplemental results
  // (uses DB results' brands first, then falls through to GPT if empty)

  // 3. GPT fallback
  const gptResults = await searchWithGPT(q, cat);

  // Merge: DB results win over GPT duplicates
  const seenNames = new Set(dbResults.map((r) => `${r.brand}||${r.name}`.toLowerCase()));
  const merged: BeautyProduct[] = [
    ...dbResults,
    ...gptResults.filter((r) => !seenNames.has(`${r.brand}||${r.name}`.toLowerCase())),
  ];

  // 4. Enrich images from brand sites where missing
  const enriched = await enrichImagesFromBrandSite(merged);

  return NextResponse.json({ results: enriched });
}
