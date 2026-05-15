import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

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

function extractNotesFromText(text: string, labels: string[]): string[] {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:\\-]?\\s*([^.\\n<]{3,300})`, "i");
    const match = text.match(pattern);
    if (match?.[1]) {
      const notes = match[1]
        .split(/[,;|•·]+/)
        .map((s) => s.replace(/<[^>]+>/g, "").trim())
        .filter((s) => s.length > 1 && s.length < 50 && !/^(and|the|a|an|with|notes?)$/i.test(s));
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

async function getBrandDomain(brand: string): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 60,
      messages: [
        {
          role: "system",
          content: "Return only the primary domain of the brand's official website (e.g. kayali.com). No protocol, no path. Return 'unknown' if not confident.",
        },
        { role: "user", content: `Official website domain for fragrance brand: "${brand}"` },
      ],
    });
    const text = (completion.choices[0]?.message?.content ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!text || text === "unknown" || !text.includes(".")) return null;
    return text;
  } catch {
    return null;
  }
}

// Fetch a brand search page and return { productUrl, imageUrl } for the best match.
// Handles Shopify (embedded JSON in page) and generic HTML search pages.
async function brandSearch(domain: string, name: string, brand: string): Promise<{ productUrl: string | null; imageUrl: string | null }> {
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
      // Supports locale prefixes: /en-us/products/..., /en-ae/products/...
      const re = /href="((?:\/[a-z]{2}(?:-[a-z]{2})?)?\/(?:products?|fragrances?|fragrance|perfume|p\/)[^"?#]+)"/gi;
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
      if (best && best.score > 0) {
        return { productUrl: `https://${domain}${best.link}`, imageUrl: null };
      }
    } catch {
      continue;
    }
  }
  return { productUrl: null, imageUrl: null };
}

function bestProductLink(html: string, domain: string, name: string, brand: string): string | null {
  const re = /href="((?:\/[a-z]{2}(?:-[a-z]{2})?)?\/(?:products?|fragrances?|fragrance|perfume|p\/)[^"?#]+)"/gi;
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

  // Verify this page is actually about the right perfume — require ALL name tokens
  const nameWords = tokenise(name);
  const htmlLower = html.toLowerCase();
  const matchCount = nameWords.filter((w) => htmlLower.includes(w)).length;
  if (nameWords.length > 1 && matchCount < nameWords.length) return null;

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

  const { productUrl, imageUrl: searchImageUrl } = await brandSearch(domain, name, brand);

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

// ── Other image fallbacks ─────────────────────────────────────────────────────

async function fallbackImage(name: string, brand: string): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: "Return only a single direct image URL ending in .jpg, .jpeg, .png, or .webp. Return 'null' if unknown.",
        },
        {
          role: "user",
          content: `Direct product bottle image URL for "${name}" by ${brand}. Prefer Fragrantica CDN (fimgs.net) or the brand's official site. Return URL only or null.`,
        },
      ],
    });
    const text = (completion.choices[0]?.message?.content ?? "").trim();
    const m = text.match(/https?:\/\/\S+\.(jpg|jpeg|png|webp)/i);
    return m?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { name, brand } = await request.json();

  const empty = { image_url: null, top_notes: [], heart_notes: [], base_notes: [], description: null };
  if (!name || !brand) return NextResponse.json(empty);

  // 1. Brand's official website (most accurate)
  const brandResult = await tryBrandPage(name, brand).catch(() => null);
  if (brandResult?.image_url) {
    // Fill any missing notes from Fragrantica if brand page didn't have them
    if (!brandResult.top_notes.length && !brandResult.heart_notes.length && !brandResult.base_notes.length) {
      const frag = await tryFragrantica(name, brand).catch(() => null);
      if (frag) {
        brandResult.top_notes = frag.top_notes;
        brandResult.heart_notes = frag.heart_notes;
        brandResult.base_notes = frag.base_notes;
        if (!brandResult.description) brandResult.description = frag.description;
      }
    }
    return NextResponse.json(brandResult);
  }

  // 2. Fragrantica
  const fragResult = await tryFragrantica(name, brand).catch(() => null);
  if (fragResult) {
    return NextResponse.json({
      image_url: brandResult?.image_url ?? fragResult.image_url,
      description: brandResult?.description ?? fragResult.description,
      top_notes: brandResult?.top_notes?.length ? brandResult.top_notes : fragResult.top_notes,
      heart_notes: brandResult?.heart_notes?.length ? brandResult.heart_notes : fragResult.heart_notes,
      base_notes: brandResult?.base_notes?.length ? brandResult.base_notes : fragResult.base_notes,
    });
  }

  // 3. AI-generated image URL as last resort
  const fallback = await fallbackImage(name, brand);
  return NextResponse.json({
    ...empty,
    image_url: brandResult?.image_url ?? fallback,
    description: brandResult?.description ?? null,
    top_notes: brandResult?.top_notes ?? [],
    heart_notes: brandResult?.heart_notes ?? [],
    base_notes: brandResult?.base_notes ?? [],
  });
}
