import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL_MINI } from "@/lib/openai";
import { BOTTLE_SIZES } from "@/lib/utils";

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Size matching ─────────────────────────────────────────────────────────────

const SIZE_ML: Record<string, number> = Object.fromEntries(
  BOTTLE_SIZES.filter((b) => b.ml > 0).map((b) => [b.value, b.ml])
);

function parseMlFromText(text: string): number | null {
  const t = text.toLowerCase();
  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml/);
  if (ml) return parseFloat(ml[1]);
  const oz = t.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz/);
  if (oz) return Math.round(parseFloat(oz[1]) * 29.5735);
  return null;
}

function sizeMatches(sizeValue: string, variantText: string): boolean {
  const t = variantText.toLowerCase();
  const targetMl = SIZE_ML[sizeValue];
  if (!targetMl) {
    if (sizeValue === "sample") return /sample|vial|trial|decant/i.test(t);
    return false;
  }
  const variantMl = parseMlFromText(t);
  if (variantMl !== null) return Math.abs(variantMl - targetMl) / targetMl < 0.08;
  return false;
}

// ── Price extraction from page HTML ──────────────────────────────────────────

interface Variant { title: string; price: number; }

function extractVariants(html: string): Variant[] {
  const results: Variant[] = [];

  // Method 1: <script type="application/json"> blocks (Shopify product JSON)
  const jsonScripts = [...html.matchAll(/<script[^>]+type="application\/json"[^>]*>([\s\S]{10,60000}?)<\/script>/gi)];
  for (const s of jsonScripts) {
    try {
      const data = JSON.parse(s[1]);
      const variants: unknown[] =
        Array.isArray(data) ? data :
        Array.isArray(data.variants) ? data.variants :
        Array.isArray(data.product?.variants) ? data.product.variants :
        [];
      if (variants.length === 0) continue;
      for (const v of variants as Record<string, unknown>[]) {
        const rawPrice = v.price;
        const price = typeof rawPrice === "number"
          ? rawPrice / 100
          : parseFloat(String(rawPrice ?? "0")) / 100;
        const title = String(v.title ?? v.option1 ?? v.name ?? "");
        if (price > 0 && title) results.push({ title, price });
      }
      if (results.length > 0) return results;
    } catch { continue; }
  }

  // Method 2: application/ld+json Product with offers
  const ldScripts = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const s of ldScripts) {
    try {
      const data = JSON.parse(s[1]);
      if (data["@type"] !== "Product" || !data.offers) continue;
      const offers: Record<string, unknown>[] = Array.isArray(data.offers) ? data.offers : [data.offers];
      for (const o of offers) {
        const price = parseFloat(String(o.price ?? o.lowPrice ?? "0"));
        const title = String(o.name ?? o.sku ?? data.name ?? "");
        if (price > 0) results.push({ title, price });
      }
      if (results.length > 0) return results;
    } catch { continue; }
  }

  // Method 3: Single meta price tag
  const metaMatch =
    html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([\d.]+)"/i) ??
    html.match(/<meta[^>]+content="([\d.]+)"[^>]+property="product:price:amount"/i) ??
    html.match(/<meta[^>]+property="og:price:amount"[^>]+content="([\d.]+)"/i);
  if (metaMatch) results.push({ title: "", price: parseFloat(metaMatch[1]) });

  return results;
}

function matchPrices(
  sizes: string[],
  variants: Variant[]
): Array<{ size: string; price_min: number; price_max: number }> {
  const matched: Array<{ size: string; price_min: number; price_max: number }> = [];
  for (const size of sizes) {
    const hit = variants.find((v) => sizeMatches(size, v.title));
    if (hit) {
      matched.push({ size, price_min: hit.price, price_max: hit.price });
    } else if (variants.length === 1 && sizes.length === 1) {
      // Single price, single size requested — just use it
      matched.push({ size, price_min: variants[0].price, price_max: variants[0].price });
    }
  }
  return matched;
}

// ── Brand domain + product URL (mirrors details route) ────────────────────────

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

const FRAGRANCE_KEYWORDS = /\b(fragrance|perfume|parfum|scent|cologne|eau\s*de|edp|edt|notes?|olfact|ml\b|spray|mist|body\s*oil)/i;

async function isFragranceDomain(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/products.json?limit=10`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error("no products.json");
    const json = await res.json() as { products?: Array<{ title: string; body_html?: string; product_type?: string }> };
    const products = json.products ?? [];
    if (products.length === 0) throw new Error("empty products.json");
    return products.some((p) =>
      FRAGRANCE_KEYWORDS.test(p.title) || FRAGRANCE_KEYWORDS.test(p.product_type ?? "") || FRAGRANCE_KEYWORDS.test((p.body_html ?? "").slice(0, 300))
    );
  } catch { /* fall through to homepage */ }
  try {
    const res = await fetch(`https://${domain}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
    if (res.ok) return FRAGRANCE_KEYWORDS.test((await res.text()).slice(0, 100000));
  } catch { /* fall through */ }
  return false;
}

async function getBrandDomain(brand: string): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_MINI,
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

async function findProductUrl(domain: string, name: string, brand: string): Promise<string | null> {
  const q = encodeURIComponent(name);
  const paths = [`/search?q=${q}&type=product`, `/search?q=${q}`, `/search?query=${q}`];

  for (const path of paths) {
    try {
      const res = await fetch(`https://${domain}${path}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const html = await res.text();

      // Shopify embedded product JSON
      const shopify = [...html.matchAll(/"title":"([^"]+)"[^{}]*?"url":"(\/[^"?]+)"[^{}]*?"image":\{"src":"(\/\/[^"]+)"/g)];
      if (shopify.length > 0) {
        const best = shopify.map((m) => ({ path: m[2], score: scoreMatch(m[1], name, brand) }))
          .sort((a, b) => b.score - a.score)[0];
        if (best.score > 0) return `https://${domain}${best.path.split("?")[0]}`;
      }

      // Generic product hrefs
      const re = /href="((?:\/[a-z]{2}(?:-[a-z]{2})?)?\/(?:products?|fragrances?|fragrance|perfume|p\/)[^"?#]+)"/gi;
      const entries: { link: string; score: number }[] = [];
      const seen = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        if (!seen.has(m[1])) { seen.add(m[1]); entries.push({ link: m[1], score: scoreMatch(m[1], name, brand) }); }
      }
      entries.sort((a, b) => b.score - a.score);
      if (entries[0]?.score > 0) return `https://${domain}${entries[0].link}`;
    } catch { continue; }
  }

  // Shopify products.json fallback (for JS-rendered storefronts)
  try {
    const catalogRes = await fetch(`https://${domain}/products.json?limit=250`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(7000) });
    if (catalogRes.ok) {
      const json = await catalogRes.json() as { products?: Array<{ title: string; handle: string }> };
      const best = (json.products ?? [])
        .map((p) => ({ p, score: scoreMatch(`${p.title} ${p.handle}`, name, brand) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (best) return `https://${domain}/products/${best.p.handle}`;
    }
  } catch { /* fall through */ }

  return null;
}

// ── Retailer price scraping ───────────────────────────────────────────────────

const RETAILERS = [
  { domain: "scentsplit.com",  searchPath: "/search?type=product&q=" },
  { domain: "jomashop.com",    searchPath: "/search?query=" },
  { domain: "twistedlily.com", searchPath: "/search?type=product&q=" },
  { domain: "luckyscent.com",  searchPath: "/search.aspx?term=" },
];

async function getRetailerPrices(
  name: string,
  brand: string,
  sizes: string[]
): Promise<Array<{ size: string; price_min: number; price_max: number }>> {
  for (const { domain, searchPath } of RETAILERS) {
    try {
      const q = encodeURIComponent(`${brand} ${name}`);
      const searchRes = await fetch(`https://${domain}${searchPath}${q}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(7000) });
      if (!searchRes.ok) continue;
      const searchHtml = await searchRes.text();

      // Find best product link
      const re = /href="((?:\/[a-z]{2}(?:-[a-z]{2})?)?\/(?:products?|fragrances?|fragrance|perfume|catalog(?:\/product)?|shop\/product|p\/)[^"?#]+)"/gi;
      const entries: { link: string; score: number }[] = [];
      const seen = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = re.exec(searchHtml)) !== null) {
        if (!seen.has(m[1])) { seen.add(m[1]); entries.push({ link: m[1], score: scoreMatch(m[1], name, brand) }); }
      }
      entries.sort((a, b) => b.score - a.score);
      if (!entries[0] || entries[0].score === 0) continue;

      const productRes = await fetch(`https://${domain}${entries[0].link}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
      if (!productRes.ok) continue;
      const productHtml = await productRes.text();
      const variants = extractVariants(productHtml);
      if (variants.length === 0) continue;
      const matched = matchPrices(sizes, variants);
      if (matched.length > 0) return matched;
    } catch { continue; }
  }
  return [];
}

// ── GPT fallback for any unresolved sizes ─────────────────────────────────────

async function getGPTPrices(
  name: string,
  brand: string,
  sizes: string[]
): Promise<Array<{ size: string; price_min: number; price_max: number }>> {
  const sizeList = sizes
    .map((s) => {
      const entry = BOTTLE_SIZES.find((b) => b.value === s);
      return entry ? `"${entry.label}" (value: "${s}")` : `"${s}"`;
    })
    .join(", ");

  const completion = await openai.chat.completions.create({
    model: MODEL_MINI,
    max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Estimate current retail prices for the requested perfume sizes. Use real-world brand pricing. Return JSON only." },
      { role: "user", content: `"${name}" by ${brand}.\nSizes needed: ${sizeList}\nReturn: {"prices":[{"size":"<value>","price_min":68,"price_max":75}]}` },
    ],
  });
  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const arr: Record<string, unknown>[] = Array.isArray(parsed.prices) ? parsed.prices : [];
    return arr
      .map((p) => ({
        size: String(p.size ?? ""),
        price_min: Number(p.price_min ?? 0),
        price_max: Number(p.price_max ?? 0),
      }))
      .filter((p) => p.size && p.price_min > 0);
  } catch {
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { name, brand, sizes } = await request.json();

  if (!name || !brand || !Array.isArray(sizes) || sizes.length === 0) {
    return NextResponse.json({ prices: [] });
  }

  const allPrices: Array<{ size: string; price_min: number; price_max: number; currency: string }> = [];
  let remaining = [...sizes].filter((s) => s !== "other");

  // 1. Brand's own website
  try {
    const domain = await getBrandDomain(brand);
    if (domain) {
      const productUrl = await findProductUrl(domain, name, brand);
      if (productUrl) {
        const pageRes = await fetch(productUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const variants = extractVariants(html);
          const matched = matchPrices(remaining, variants);
          for (const p of matched) {
            allPrices.push({ ...p, currency: "USD" });
            remaining = remaining.filter((s) => s !== p.size);
          }
        }
      }
    }
  } catch { /* fall through */ }

  // 2. Retailer sites for anything not found on the brand page
  if (remaining.length > 0) {
    try {
      const retailerPrices = await getRetailerPrices(name, brand, remaining);
      for (const p of retailerPrices) {
        allPrices.push({ ...p, currency: "USD" });
        remaining = remaining.filter((s) => s !== p.size);
      }
    } catch { /* fall through */ }
  }

  // 3. GPT estimate for anything still unresolved
  if (remaining.length > 0) {
    try {
      const gptPrices = await getGPTPrices(name, brand, remaining);
      for (const p of gptPrices) {
        allPrices.push({ ...p, currency: "USD" });
      }
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ prices: allPrices });
}
