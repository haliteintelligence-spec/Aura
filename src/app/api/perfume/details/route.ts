import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function extractNoteNames(html: string, label: string): string[] {
  const pattern = new RegExp(`${label}[\\s\\S]{0,200}(<div[\\s\\S]{0,1500}?)(?=<h4|id="pyramid-middle|id="pyramid-base|id="pyramid-top|<\\/div><\\/div><\\/div>)`, "i");
  const section = html.match(pattern)?.[1] ?? "";
  if (!section) return [];
  return [...section.matchAll(/<span[^>]*>([^<]{2,35})<\/span>/gi)]
    .map((m) => m[1].trim())
    .filter((s) => !/^(Top|Heart|Base|Middle|Notes?|&nbsp;|\s)$/i.test(s));
}

// Extract all unique detail-page links from Fragrantica search HTML,
// each paired with the nearest product image found in surrounding context.
function extractSearchEntries(html: string): Array<{ link: string; imageUrl: string | null }> {
  const entries: Array<{ link: string; imageUrl: string | null }> = [];
  const seen = new Set<string>();
  const linkRe = /href="(\/perfume\/[^"?#]+\.html)"/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const link = m[1];
    if (seen.has(link)) continue;
    seen.add(link);
    const start = Math.max(0, m.index - 400);
    const end = Math.min(html.length, m.index + 700);
    const context = html.slice(start, end);
    const img = context.match(/https:\/\/fimgs\.net\/mdimg\/perfume\/375x500\.\d+\.jpg/);
    entries.push({ link, imageUrl: img?.[0] ?? null });
  }
  return entries;
}

// Score how well a Fragrantica detail URL matches our target brand + name.
// Fragrantica URLs look like: /perfume/Chanel/Bleu-de-Chanel-49996.html
// We tokenise both the URL and the target and count keyword hits.
function scoreEntry(link: string, name: string, brand: string): number {
  const linkLower = link.toLowerCase();
  const stopWords = new Set(["de", "du", "la", "le", "les", "the", "and", "for", "by", "eau", "parfum", "toilette", "cologne"]);
  const tokenise = (s: string) =>
    s.toLowerCase().split(/[\s\-_'.]+/).filter((w) => w.length > 2 && !stopWords.has(w));

  let score = 0;
  for (const w of tokenise(brand)) if (linkLower.includes(w)) score += 3;
  for (const w of tokenise(name)) if (linkLower.includes(w)) score += 1;
  return score;
}

async function tryFragrantica(name: string, brand: string) {
  const query = encodeURIComponent(`${brand} ${name}`);
  const searchRes = await fetch(`https://www.fragrantica.com/search/?query=${query}`, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(6000),
  });
  if (!searchRes.ok) return null;
  const searchHtml = await searchRes.text();

  // Pick the search result whose URL best matches our target — not just the first one
  const entries = extractSearchEntries(searchHtml);
  if (entries.length === 0) return null;

  const scored = entries
    .map((e) => ({ ...e, score: scoreEntry(e.link, name, brand) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  // Require at least one token match to avoid completely wrong results
  if (best.score === 0) return null;

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
      // Prefer the detail page image (higher resolution / more reliable)
      const detailImg = html.match(/https:\/\/fimgs\.net\/mdimg\/perfume\/375x500\.\d+\.jpg/);
      if (detailImg?.[0]) image_url = detailImg[0];

      top_notes = extractNoteNames(html, "Top Notes");
      heart_notes = extractNoteNames(html, "Heart Notes");
      if (!heart_notes.length) heart_notes = extractNoteNames(html, "Middle Notes");
      base_notes = extractNoteNames(html, "Base Notes");

      const meta = html.match(/<meta name="description" content="([^"]{10,})"/i)?.[1];
      if (meta) description = meta;
    }
  } catch { /* use search-page image if detail fetch fails */ }

  return { image_url, top_notes, heart_notes, base_notes, description };
}

async function tryScrapeSite(url: string, ...imagePatterns: RegExp[]): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { ...FETCH_HEADERS, Referer: new URL(url).origin },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    for (const p of imagePatterns) {
      const m = html.match(p);
      if (m?.[0]) return m[0];
    }
    return null;
  } catch {
    return null;
  }
}

async function fallbackImageSources(name: string, brand: string): Promise<string | null> {
  const q = encodeURIComponent(`${brand} ${name}`);

  const scentsplit = await tryScrapeSite(
    `https://www.scentsplit.com/search?q=${q}`,
    /https:\/\/cdn\.shopify\.com\/s\/files\/[^"'\s]+perfume[^"'\s]+\.(jpg|jpeg|png|webp)/i,
    /https:\/\/cdn\.shopify\.com\/s\/files\/[^"'\s]+\.(jpg|jpeg|png|webp)/i,
  );
  if (scentsplit) return scentsplit;

  const scentbird = await tryScrapeSite(
    `https://www.scentbird.com/search?q=${q}`,
    /https:\/\/[a-z0-9.-]*cloudfront\.net\/[^"'\s]+\.(jpg|jpeg|png|webp)/i,
  );
  if (scentbird) return scentbird;

  const fragrancex = await tryScrapeSite(
    `https://www.fragrancex.com/products/_cid_perfume-am-l-00_-sid_search-am-l-00_-lid_1-am-size-am-w_-wsize_5.html?q=${q}`,
    /https:\/\/[^"'\s]+(?:products|images)[^"'\s]+\.(jpg|jpeg|png|webp)/i,
  );
  if (fragrancex) return fragrancex;

  // Final fallback: OpenAI knowledge
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: "Return only a single direct image URL ending in .jpg, .jpeg, .png, or .webp. If unknown, return: null",
        },
        {
          role: "user",
          content: `Direct product bottle image URL for "${name}" by ${brand}. Prefer Fragrantica CDN (fimgs.net) or brand official site. Return URL only or null.`,
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

export async function POST(request: NextRequest) {
  const { name, brand } = await request.json();

  const empty = { image_url: null, top_notes: [], heart_notes: [], base_notes: [], description: null };
  if (!name || !brand) return NextResponse.json(empty);

  let image_url: string | null = null;
  let top_notes: string[] = [];
  let heart_notes: string[] = [];
  let base_notes: string[] = [];
  let description: string | null = null;

  try {
    const result = await tryFragrantica(name, brand);
    if (result) {
      image_url = result.image_url;
      top_notes = result.top_notes;
      heart_notes = result.heart_notes;
      base_notes = result.base_notes;
      description = result.description;
    }
  } catch { /* fall through */ }

  if (!image_url) {
    image_url = await fallbackImageSources(name, brand);
  }

  return NextResponse.json({ image_url, top_notes, heart_notes, base_notes, description });
}
