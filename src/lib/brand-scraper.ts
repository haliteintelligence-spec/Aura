/**
 * Shared brand-site scraping utilities used by perfume/search, perfume/identify,
 * and beauty/search routes.
 */

import { openai } from "@/lib/openai";
import type { PerfumeSearchResult } from "@/lib/types";

export const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const STOP_WORDS = new Set(["de", "du", "la", "le", "les", "the", "and", "for", "eau", "parfum", "toilette", "cologne"]);

export function tokenise(s: string): string[] {
  return s.toLowerCase().split(/[\s\-_'./|]+/).filter((w) => (w.length > 2 || /^\d+$/.test(w)) && !STOP_WORDS.has(w));
}

export function scoreMatch(text: string, name: string, brand: string): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const w of tokenise(name)) if (t.includes(w)) score += 2;
  for (const w of tokenise(brand)) if (t.includes(w)) score += 1;
  return score;
}

export function slugToTitle(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ── Domain validation ─────────────────────────────────────────────────────────

const FRAGRANCE_KEYWORDS = /\b(fragrance|perfume|parfum|scent|cologne|eau\s*de|edp|edt|notes?|olfact|ml\b|spray|mist|body\s*oil)/i;

export async function isFragranceDomain(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/products.json?limit=10`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error();
    const json = await res.json() as { products?: Array<{ title: string; body_html?: string; product_type?: string }> };
    const products = json.products ?? [];
    if (products.length === 0) throw new Error();
    return products.some((p) =>
      FRAGRANCE_KEYWORDS.test(p.title) ||
      FRAGRANCE_KEYWORDS.test(p.product_type ?? "") ||
      FRAGRANCE_KEYWORDS.test((p.body_html ?? "").slice(0, 300))
    );
  } catch {
    try {
      const res = await fetch(`https://${domain}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return false;
      return FRAGRANCE_KEYWORDS.test((await res.text()).slice(0, 100000));
    } catch { return false; }
  }
}

/** Permissive domain check for beauty — just verifies the site returns products. */
export async function isBrandSite(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/products.json?limit=5`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json() as { products?: unknown[] };
      if ((json.products ?? []).length > 0) return true;
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch(`https://${domain}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch { return false; }
}

// ── Domain resolution ─────────────────────────────────────────────────────────

async function resolveDomain(brand: string, validate: (d: string) => Promise<boolean>): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [
        { role: "system", content: "Return up to 3 candidate official website domains for the brand, most likely first. No protocol, no path. Return 'unknown' if not confident." },
        { role: "user", content: `Official website domain(s) for brand: "${brand}"` },
      ],
    });
    const raw = (completion.choices[0]?.message?.content ?? "").trim().toLowerCase();
    const candidates = raw
      .split(/[\s,;|]+/)
      .map((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim())
      .filter((d) => d && d !== "unknown" && d.includes(".") && !d.includes(" "));
    for (const domain of candidates) {
      if (await validate(domain)) return domain;
    }
    return null;
  } catch {
    return null;
  }
}

/** Resolves domain for fragrance brands (requires fragrance keyword validation). */
export function getBrandDomain(brand: string): Promise<string | null> {
  return resolveDomain(brand, isFragranceDomain);
}

/** Resolves domain for any brand (permissive — any site that responds with products). */
export function getBrandDomainAny(brand: string): Promise<string | null> {
  return resolveDomain(brand, isBrandSite);
}

// ── Brand site search ─────────────────────────────────────────────────────────

export async function searchBrandSite(domain: string, name: string, brand: string): Promise<PerfumeSearchResult[]> {
  const q = encodeURIComponent(name);
  const searchPaths = [
    `/search?q=${q}&type=product`,
    `/search?q=${q}`,
    `/search?query=${q}`,
  ];

  for (const path of searchPaths) {
    try {
      const res = await fetch(`https://${domain}${path}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(7000) });
      if (!res.ok) continue;
      const html = await res.text();

      // Shopify embedded JSON
      const shopifyMatches = [...html.matchAll(/"title":"([^"]+)"[^{}]*?"url":"(\/[^"?]+)"[^{}]*?"image":\{"src":"(\/\/[^"]+)"/g)];
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

      // Generic href product links
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
        return entries.slice(0, 5).map((e) => ({
          name: slugToTitle(e.link.split("/").filter(Boolean).pop() ?? "") || name,
          brand,
          top_notes: [],
          heart_notes: [],
          base_notes: [],
          fragrance_family: [],
        }));
      }
    } catch { continue; }
  }

  // Shopify products.json fallback
  try {
    const res = await fetch(`https://${domain}/products.json?limit=250`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(7000) });
    if (res.ok) {
      const json = await res.json() as { products?: Array<{ title: string; handle: string; images?: Array<{ src: string }> }> };
      return (json.products ?? [])
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
