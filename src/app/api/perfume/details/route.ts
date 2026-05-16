import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

interface ShopifyProduct {
  title: string;
  handle: string;
  body_html?: string;
  images?: Array<{ src: string }>;
  variants?: Array<{ title: string; price: string; compare_at_price: string | null }>;
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Shared helpers ────────────────────────────────────────────────────────────

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

function isValidNote(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 35) return false;
  if (!/[a-z]/i.test(t)) return false;
  // Reject size/measurement and price patterns
  if (/\d+\s*(ml|oz|fl|mg|cl|g\b)/i.test(t)) return false;
  if (/[$€£]\s*\d/.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  // Reject obvious non-note words
  if (/^(size|qty|quantity|add|buy|shop|view|more|select|free|shipping|return|policy|sale|discount|stock|available|option|color|colour|new|gift|set|kit|bundle)$/i.test(t)) return false;
  return true;
}

function extractNotesFromText(text: string, labels: string[]): string[] {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:\\-]?\\s*([^.\\n<]{3,300})`, "i");
    const match = text.match(pattern);
    if (match?.[1]) {
      // Stop at the next notes section label to avoid bleeding into adjacent sections
      const section = match[1].split(/\s*(?:top|heart|middle|base)\s*notes?\s*[:\-]?/i)[0];
      const notes = section
        .split(/[,;|•·]+|\s+-\s+/)
        .map((s) => s.replace(/<[^>]+>/g, "").trim())
        .filter((s) => isValidNote(s) && !/^(and|the|a|an|of|from|with|in|notes?)$/i.test(s) && !/^(of|from|with|in)\s/i.test(s));
      if (notes.length > 0) return notes.slice(0, 8);
    }
  }
  return [];
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ");
}

// ── Brand page (primary source) ───────────────────────────────────────────────

const FRAGRANCE_KEYWORDS = /\b(fragrance|perfume|parfum|scent|cologne|eau\s*de|edp|edt|notes?|olfact|ml\b|spray|mist|body\s*oil)/i;

async function isFragranceDomain(domain: string): Promise<boolean> {
  // Try Shopify products.json first; fall back to homepage keyword scan for non-Shopify sites
  try {
    const res = await fetch(`https://${domain}/products.json?limit=10`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error("no products.json");
    const json = await res.json() as { products?: Array<{ title: string; body_html?: string; product_type?: string }> };
    const products = json.products ?? [];
    if (products.length === 0) throw new Error("empty products.json");
    return products.some((p) =>
      FRAGRANCE_KEYWORDS.test(p.title) ||
      FRAGRANCE_KEYWORDS.test(p.product_type ?? "") ||
      FRAGRANCE_KEYWORDS.test((p.body_html ?? "").slice(0, 300))
    );
  } catch {
    // products.json unavailable or non-Shopify — scan homepage for fragrance keywords
    try {
      const res = await fetch(`https://${domain}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return false;
      const text = await res.text();
      return FRAGRANCE_KEYWORDS.test(text.slice(0, 100000));
    } catch {
      return false;
    }
  }
}

async function getBrandDomain(brand: string): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: "Return up to 3 candidate domains for the fragrance brand's official website, most likely first (e.g. 'kayali.com, kayali.co'). No protocol, no path. Return 'unknown' if not confident.",
        },
        { role: "user", content: `Official website domain(s) for fragrance brand: "${brand}"` },
      ],
    });
    const raw = (completion.choices[0]?.message?.content ?? "").trim().toLowerCase();
    const candidates = raw
      .split(/[\s,;|]+/)
      .map((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim())
      .filter((d) => d && d !== "unknown" && d.includes(".") && !d.includes(" "));

    for (const domain of candidates) {
      if (await isFragranceDomain(domain)) return domain;
    }
    return null;
  } catch {
    return null;
  }
}

async function brandSearch(domain: string, name: string, brand: string): Promise<{ productUrl: string | null; imageUrl: string | null; shopifyProduct?: ShopifyProduct }> {
  const q = encodeURIComponent(name);
  const searchPaths = [
    `/search?q=${q}&type=product`,
    `/search?q=${q}`,
    `/search?query=${q}`,
    `/?s=${q}&post_type=product`,
    `/shop/?s=${q}&post_type=product`,
  ];

  for (const path of searchPaths) {
    try {
      const res = await fetch(`https://${domain}${path}`, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      // ── Shopify path: parse embedded productVariants JSON ──────────────────
      // Shopify search pages embed results as JSON inside a <script> tag.
      // Extract: "title":"...", "url":"/...products/...", "image":{"src":"//..."}
      const shopifyMatches = [...html.matchAll(/"title":"([^"]+)"[^{}]*?"url":"(\/[^"?]+)"[^{}]*?"image":\{"src":"(\/\/[^"]+)"/g)];
      if (shopifyMatches.length > 0) {
        const best = shopifyMatches
          .map((m) => ({ title: m[1], path: m[2], src: m[3], score: scoreMatch(m[1], name, brand) }))
          .sort((a, b) => b.score - a.score)[0];
        if (best.score > 0) {
          // Normalise: "//domain/path" → "https://domain/path"
          const imageUrl = best.src.startsWith("//") ? `https:${best.src}` : best.src;
          const productUrl = `https://${domain}${best.path.split("?")[0]}`;
          return { productUrl, imageUrl };
        }
      }

      // ── Generic path: score href links with product-like paths ────────────
      // Handles relative (/product/...) and absolute (https://domain/product/...) hrefs
      const escapedDomain = domain.replace(/\./g, "\\.");
      const re = new RegExp(
        `href="((?:https?://${escapedDomain})?(?:/[a-z]{2}(?:-[a-z]{2})?)?/(?:products?|fragrances?|fragrance|perfume|p/)[^"?#]+)"`,
        "gi"
      );
      const seen = new Set<string>();
      const entries: Array<{ link: string; score: number }> = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        // Normalise to a relative path for scoring and dedup
        const raw = m[1];
        const link = raw.startsWith("http") ? raw.replace(/^https?:\/\/[^/]+/, "") : raw;
        if (seen.has(link)) continue;
        seen.add(link);
        entries.push({ link, score: scoreMatch(link, name, brand) });
      }
      // Sort by score DESC, then URL length ASC (shorter = main product page, not a size variant)
      entries.sort((a, b) => b.score - a.score || a.link.length - b.link.length);
      const best = entries[0];
      if (best && best.score > 0) {
        return { productUrl: `https://${domain}${best.link}`, imageUrl: null };
      }
    } catch {
      continue;
    }
  }
  // ── Shopify products.json fallback (works when search page is JS-rendered) ──
  // Shopify stores expose /products.json with full product data including images.
  try {
    const catalogRes = await fetch(`https://${domain}/products.json?limit=250`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    if (catalogRes.ok) {
      const json = await catalogRes.json() as { products?: ShopifyProduct[] };
      const products = json.products ?? [];
      const scored = products
        .map((p) => ({ p, score: scoreMatch(`${p.title} ${p.handle}`, name, brand) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      if (scored.length > 0) {
        // Prefer products whose body_html contains a note pyramid
        const withNotes = scored.find(({ p }) =>
          /(top|heart|middle|base)\s*notes?\s*[:\-]/i.test(p.body_html ?? "")
        );
        const best = (withNotes ?? scored[0]).p;
        const imageUrl = best.images?.[0]?.src ?? null;
        const productUrl = `https://${domain}/products/${best.handle}`;
        return { productUrl, imageUrl, shopifyProduct: best };
      }
    }
  } catch { /* fall through */ }

  return { productUrl: null, imageUrl: null };
}

function bestProductLink(html: string, domain: string, name: string, brand: string): string | null {
  // Broad pattern covers brand sites, Shopify, JoMashop (/catalog), Macy's/Bloomingdale's (/shop/product)
  const re = /href="((?:\/[a-z]{2}(?:-[a-z]{2})?)?\/(?:products?|fragrances?|fragrance|perfume|catalog(?:\/product)?|shop\/product|p\/)[^"?#]+)"/gi;
  const seen = new Set<string>();
  const entries: Array<{ link: string; score: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const link = m[1];
    if (seen.has(link)) continue;
    seen.add(link);
    entries.push({ link, score: scoreMatch(link, name, brand) });
  }

  entries.sort((a, b) => b.score - a.score);
  const best = entries[0];
  if (!best || best.score === 0) return null;
  return `https://${domain}${best.link}`;
}

async function extractFromProductPage(url: string, name: string) {
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const html = await res.text();

  // Verify this page is actually about the right perfume by checking the page title
  // (body text is too noisy — e.g., "28" can appear in dates or related products)
  const nameWords = tokenise(name);
  const pageTitle = (
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i)?.[1] ??
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ??
    ""
  ).toLowerCase();
  const titleMatchCount = nameWords.filter((w) => pageTitle.includes(w)).length;
  if (nameWords.length > 1 && titleMatchCount < nameWords.length) return null;

  // Image: prefer og:image (universal), fall back to first large product img
  const image_url =
    html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i)?.[1] ??
    null;

  // Description
  const description =
    html.match(/<meta\s+property="og:description"\s+content="([^"]{20,})"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]{20,})"\s+property="og:description"/i)?.[1] ??
    null;

  // Notes from page text
  const text = stripHtml(html);
  const top_notes = extractNotesFromText(text, ["top notes?", "top note"]);
  const heart_notes = extractNotesFromText(text, ["heart notes?", "heart note", "middle notes?", "middle note"]);
  const base_notes = extractNotesFromText(text, ["base notes?", "base note"]);

  return { image_url, description, top_notes, heart_notes, base_notes };
}

async function getProductUrl(domain: string, name: string, brand: string): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: "Return only the direct product page URL (https://...) for the specified perfume. Must point to the exact product, not a search or category page. Return 'unknown' if not confident.",
        },
        { role: "user", content: `Direct product URL for "${name}" by ${brand} on ${domain}` },
      ],
    });
    const text = (completion.choices[0]?.message?.content ?? "").trim();
    const m = text.match(/https?:\/\/[^\s"'<>]+/);
    if (!m) return null;
    try {
      const hostname = new URL(m[0]).hostname;
      if (!hostname.includes(domain.replace(/^www\./, ""))) return null;
    } catch { return null; }
    return m[0];
  } catch {
    return null;
  }
}

async function tryBrandPage(name: string, brand: string) {
  const domain = await getBrandDomain(brand);
  if (!domain) return null;

  const { productUrl, imageUrl: searchImageUrl, shopifyProduct } = await brandSearch(domain, name, brand);

  // 0. If the products.json catalogue returned a Shopify product, extract notes from body_html directly.
  //    This handles JS-rendered storefronts where the product page has no static note content.
  if (shopifyProduct) {
    const text = (shopifyProduct.body_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const top_notes = extractNotesFromText(text, ["top notes?", "top note"]);
    const heart_notes = extractNotesFromText(text, ["heart notes?", "heart note", "middle notes?", "middle note"]);
    const base_notes = extractNotesFromText(text, ["base notes?", "base note"]);
    const image_url = searchImageUrl ?? shopifyProduct.images?.[0]?.src ?? null;
    const description = text.trim().slice(0, 500) || null;
    // Return if we got at least an image or notes (page scrape below will try to enrich further)
    if (image_url || top_notes.length || heart_notes.length || base_notes.length) {
      // Still try the product page for better data, but don't block on it
      const pageResult = productUrl ? await extractFromProductPage(productUrl, name).catch(() => null) : null;
      return {
        image_url: pageResult?.image_url ?? image_url,
        description: pageResult?.description ?? description,
        top_notes: pageResult?.top_notes?.length ? pageResult.top_notes : top_notes,
        heart_notes: pageResult?.heart_notes?.length ? pageResult.heart_notes : heart_notes,
        base_notes: pageResult?.base_notes?.length ? pageResult.base_notes : base_notes,
      };
    }
  }

  // 1. Try URL found via search page
  if (productUrl) {
    try {
      const pageResult = await extractFromProductPage(productUrl, name);
      if (pageResult) {
        if (!pageResult.image_url && searchImageUrl) pageResult.image_url = searchImageUrl;
        return pageResult;
      }
    } catch { /* fall through */ }
  }

  // 2. Try AI-generated direct product URL (good for well-known fragrances on Shopify stores)
  const aiUrl = await getProductUrl(domain, name, brand).catch(() => null);
  if (aiUrl && aiUrl !== productUrl) {
    try {
      const pageResult = await extractFromProductPage(aiUrl, name);
      if (pageResult) {
        if (!pageResult.image_url && searchImageUrl) pageResult.image_url = searchImageUrl;
        return pageResult;
      }
    } catch { /* fall through */ }
  }

  return null;
}

// ── Fragrantica (secondary source) ───────────────────────────────────────────

function extractNoteNames(html: string, label: string): string[] {
  const pattern = new RegExp(`${label}[\\s\\S]{0,200}(<div[\\s\\S]{0,1500}?)(?=<h4|id="pyramid-middle|id="pyramid-base|id="pyramid-top|<\\/div><\\/div><\\/div>)`, "i");
  const section = html.match(pattern)?.[1] ?? "";
  if (!section) return [];
  return [...section.matchAll(/<span[^>]*>([^<]{2,35})<\/span>/gi)]
    .map((m) => m[1].trim())
    .filter((s) => !/^(Top|Heart|Base|Middle|Notes?|&nbsp;|\s)$/i.test(s));
}

function extractSearchEntries(html: string): Array<{ link: string; imageUrl: string | null }> {
  const entries: Array<{ link: string; imageUrl: string | null }> = [];
  const seen = new Set<string>();
  const re = /href="(\/perfume\/[^"?#]+\.html)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const link = m[1];
    if (seen.has(link)) continue;
    seen.add(link);
    const ctx = html.slice(Math.max(0, m.index - 400), Math.min(html.length, m.index + 700));
    const img = ctx.match(/https:\/\/fimgs\.net\/[^"'\s]+\.(jpg|jpeg|png|webp)/i);
    entries.push({ link, imageUrl: img?.[0] ?? null });
  }
  return entries;
}

async function tryFragrantica(name: string, brand: string) {
  const query = encodeURIComponent(`${brand} ${name}`);
  const searchRes = await fetch(`https://www.fragrantica.com/search/?query=${query}`, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(6000),
  });
  if (!searchRes.ok) return null;
  const searchHtml = await searchRes.text();

  const entries = extractSearchEntries(searchHtml);
  if (entries.length === 0) return null;

  // Pick best-scoring entry; fall back to first if nothing scores
  const scored = entries
    .map((e) => ({ ...e, score: scoreMatch(e.link, name, brand) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0].score > 0 ? scored[0] : entries[0];

  let image_url = best.imageUrl;
  let top_notes: string[] = [];
  let heart_notes: string[] = [];
  let base_notes: string[] = [];
  let description: string | null = null;

  try {
    const detailRes = await fetch(`https://www.fragrantica.com${best.link}`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (detailRes.ok) {
      const html = await detailRes.text();
      const detailImg = html.match(/https:\/\/fimgs\.net\/[^"'\s]+\.(jpg|jpeg|png|webp)/i);
      if (detailImg?.[0]) image_url = detailImg[0];

      top_notes = extractNoteNames(html, "Top Notes");
      heart_notes = extractNoteNames(html, "Heart Notes");
      if (!heart_notes.length) heart_notes = extractNoteNames(html, "Middle Notes");
      base_notes = extractNoteNames(html, "Base Notes");

      const meta = html.match(/<meta name="description" content="([^"]{10,})"/i)?.[1];
      if (meta) description = meta;
    }
  } catch { /* keep image from search page if detail fails */ }

  return { image_url, top_notes, heart_notes, base_notes, description };
}

// ── Retail site fallbacks ─────────────────────────────────────────────────────

const RETAILERS = [
  { domain: "scentsplit.com",        searchPath: "/search?type=product&q=" },
  { domain: "twistedlily.com",       searchPath: "/search?type=product&q=" },
  { domain: "luckyscent.com",        searchPath: "/search.aspx?term=" },
  { domain: "jomashop.com",          searchPath: "/search?query=" },
  { domain: "www.harrods.com",       searchPath: "/en-gb/search?query=" },
  { domain: "www.macys.com",         searchPath: "/shop/catalog/search.ognc?keyword=" },
  { domain: "www.bloomingdales.com", searchPath: "/shop/search?keyword=" },
];

async function tryRetailer(domain: string, searchPath: string, name: string, brand: string) {
  const q = encodeURIComponent(`${brand} ${name}`);
  try {
    const res = await fetch(`https://${domain}${searchPath}${q}`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const productUrl = bestProductLink(html, domain, name, brand);
    if (!productUrl) return null;
    return await extractFromProductPage(productUrl, name);
  } catch {
    return null;
  }
}

async function tryRetailers(name: string, brand: string) {
  for (const { domain, searchPath } of RETAILERS) {
    const result = await tryRetailer(domain, searchPath, name, brand).catch(() => null);
    if (result?.image_url) return result;
  }
  return null;
}

// ── AI fallback: notes + optional image ──────────────────────────────────────

async function getAIFallback(name: string, brand: string) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a fragrance expert. Always return the scent notes for the requested perfume. Never return empty arrays — use your best knowledge. Do not use the term 'Oriental', use 'Resinous' instead. Return valid JSON only.",
        },
        {
          role: "user",
          content: `Return the fragrance pyramid for "${name}" by ${brand}. JSON format: { "top_notes": ["note1", "note2"], "heart_notes": ["note1", "note2"], "base_notes": ["note1", "note2"], "image_url": null }`,
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      top_notes: Array.isArray(parsed.top_notes) ? parsed.top_notes : [],
      heart_notes: Array.isArray(parsed.heart_notes) ? parsed.heart_notes : [],
      base_notes: Array.isArray(parsed.base_notes) ? parsed.base_notes : [],
      image_url: typeof parsed.image_url === "string" && parsed.image_url !== "null"
        ? parsed.image_url
        : null,
    };
  } catch {
    return { top_notes: [], heart_notes: [], base_notes: [], image_url: null };
  }
}


// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { name, brand } = await request.json();

  const empty = { image_url: null, top_notes: [] as string[], heart_notes: [] as string[], base_notes: [] as string[], description: null as string | null };
  if (!name || !brand) return NextResponse.json(empty);

  // Accumulate the best data found from each source
  let image_url: string | null = null;
  let description: string | null = null;
  let top_notes: string[] = [];
  let heart_notes: string[] = [];
  let base_notes: string[] = [];

  type Result = { image_url?: string | null; description?: string | null; top_notes?: string[]; heart_notes?: string[]; base_notes?: string[] };
  function merge(r: Result | null) {
    if (!r) return;
    if (r.image_url && !image_url) image_url = r.image_url;
    if (r.description && !description) description = r.description;
    if (r.top_notes?.length && !top_notes.length) top_notes = r.top_notes;
    if (r.heart_notes?.length && !heart_notes.length) heart_notes = r.heart_notes;
    if (r.base_notes?.length && !base_notes.length) base_notes = r.base_notes;
  }

  // 1. Brand's official website
  merge(await tryBrandPage(name, brand).catch(() => null));

  // 2. Fragrantica (always run if notes are still missing)
  if (!image_url || !top_notes.length) {
    merge(await tryFragrantica(name, brand).catch(() => null));
  }

  // 3. Retail sites (ScentSplit, Twisted Lily, Lucky Scent, JoMashop, Harrods, Macy's, Bloomingdale's)
  if (!image_url || !top_notes.length) {
    merge(await tryRetailers(name, brand).catch(() => null));
  }

  // 4. AI fallback — fires when EITHER notes or image are still missing
  if (!top_notes.length || !image_url) {
    merge(await getAIFallback(name, brand).catch(() => null));
  }

  return NextResponse.json({ image_url, description, top_notes, heart_notes, base_notes });
}
