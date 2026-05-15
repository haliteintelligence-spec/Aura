import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";
import type { PerfumeSearchResult } from "@/lib/types";

// ── Shared helpers (mirror of details/route.ts) ───────────────────────────────

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const STOP_WORDS = new Set(["de", "du", "la", "le", "les", "the", "and", "for", "eau", "parfum", "toilette", "cologne"]);

function tokenise(s: string): string[] {
  return s.toLowerCase().split(/[\s\-_'./|]+/).filter((w) => (w.length > 2 || /^\d+$/.test(w)) && !STOP_WORDS.has(w));
}

function scoreMatch(text: string, name: string, brand: string): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const w of tokenise(name)) if (t.includes(w)) score += 2;
  for (const w of tokenise(brand)) if (t.includes(w)) score += 1;
  return score;
}

// ── Brand website search (fallback when GPT doesn't know the perfume) ─────────

const FRAGRANCE_KEYWORDS = /\b(fragrance|perfume|parfum|scent|cologne|eau\s*de|edp|edt|notes?|olfact|ml\b|spray|mist|body\s*oil)/i;

async function isFragranceDomain(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/products.json?limit=10`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json() as { products?: Array<{ title: string; body_html?: string; product_type?: string }> };
      const products = json.products ?? [];
      if (products.length > 0) return products.some((p) =>
        FRAGRANCE_KEYWORDS.test(p.title) || FRAGRANCE_KEYWORDS.test(p.product_type ?? "") || FRAGRANCE_KEYWORDS.test((p.body_html ?? "").slice(0, 300))
      );
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch(`https://${domain}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
    if (res.ok) return FRAGRANCE_KEYWORDS.test((await res.text()).slice(0, 8000));
  } catch { /* fall through */ }
  return false;
}

async function getBrandDomain(brand: string): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [
        { role: "system", content: "Return up to 3 candidate domains for the fragrance brand's official website, most likely first. No protocol, no path. Return 'unknown' if not confident." },
        { role: "user", content: `Official website domain(s) for fragrance brand: "${brand}"` },
      ],
    });
    const raw = (completion.choices[0]?.message?.content ?? "").trim().toLowerCase();
    const candidates = raw.split(/[\s,;|]+/).map((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim()).filter((d) => d && d !== "unknown" && d.includes(".") && !d.includes(" "));
    for (const domain of candidates) {
      if (await isFragranceDomain(domain)) return domain;
    }
    return null;
  } catch {
    return null;
  }
}

// Slug → readable title: "vanilla-28-eau-de-parfum" → "Vanilla 28 Eau De Parfum"
function slugToTitle(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function searchBrandSite(domain: string, name: string, brand: string): Promise<PerfumeSearchResult[]> {
  const q = encodeURIComponent(name);
  const searchPaths = [
    `/search?q=${q}&type=product`,
    `/search?q=${q}`,
    `/search?query=${q}`,
  ];

  for (const path of searchPaths) {
    try {
      const res = await fetch(`https://${domain}${path}`, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      // ── Shopify embedded JSON — title + image are both available ─────────
      const shopifyMatches = [
        ...html.matchAll(/"title":"([^"]+)"[^{}]*?"url":"(\/[^"?]+)"[^{}]*?"image":\{"src":"(\/\/[^"]+)"/g),
      ];
      if (shopifyMatches.length > 0) {
        return shopifyMatches
          .map((m) => ({ title: m[1], src: m[3], score: scoreMatch(m[1], name, brand) }))
          .filter((m) => m.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map((m) => ({
            name: m.title,
            brand,
            top_notes: [],
            heart_notes: [],
            base_notes: [],
            fragrance_family: [],
            image_url: m.src.startsWith("//") ? `https:${m.src}` : m.src,
          }));
      }

      // ── Generic href links — derive name from URL slug ───────────────────
      const re = /href="((?:\/[a-z]{2}(?:-[a-z]{2})?)?\/(?:products?|fragrances?|fragrance|perfume|p\/)[^"?#]+)"/gi;
      const entries: Array<{ link: string; score: number }> = [];
      const seen = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const link = m[1];
        if (seen.has(link)) continue;
        seen.add(link);
        const score = scoreMatch(link, name, brand);
        if (score > 0) entries.push({ link, score });
      }
      if (entries.length > 0) {
        entries.sort((a, b) => b.score - a.score);
        return entries.slice(0, 5).map((e) => {
          const slug = e.link.split("/").filter(Boolean).pop() ?? "";
          return {
            name: slugToTitle(slug) || name,
            brand,
            top_notes: [],
            heart_notes: [],
            base_notes: [],
            fragrance_family: [],
          };
        });
      }
    } catch {
      continue;
    }
  }

  // ── Shopify products.json fallback (handles JS-rendered search pages) ────────
  try {
    const catalogRes = await fetch(`https://${domain}/products.json?limit=250`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    if (catalogRes.ok) {
      const json = await catalogRes.json() as { products?: Array<{ title: string; handle: string; images?: Array<{ src: string }> }> };
      const products = json.products ?? [];
      return products
        .map((p) => ({ p, score: scoreMatch(`${p.title} ${p.handle}`, name, brand) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(({ p }) => ({
          name: p.title,
          brand,
          top_notes: [],
          heart_notes: [],
          base_notes: [],
          fragrance_family: [],
          image_url: p.images?.[0]?.src ?? undefined,
        }));
    }
  } catch { /* fall through */ }

  return [];
}

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

  // 1. Ask GPT first
  const gpt = await searchWithGPT(b, n);

  // 2. If GPT came up empty AND both brand + name were given, go to the brand's
  //    actual website — this catches newer releases and niche perfumes that
  //    aren't in GPT's training data.
  if (gpt.results.length === 0 && hasBrand && hasName) {
    const domain = await getBrandDomain(b!).catch(() => null);
    if (domain) {
      const brandResults = await searchBrandSite(domain, n!, b!).catch(() => [] as PerfumeSearchResult[]);
      if (brandResults.length > 0) {
        return NextResponse.json({ brand: b, results: normaliseResults(brandResults) });
      }
    }
  }

  return NextResponse.json({ brand: gpt.brand || b || "", results: normaliseResults(gpt.results) });
}
