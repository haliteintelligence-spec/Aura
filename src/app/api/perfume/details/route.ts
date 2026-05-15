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

function firstImageMatch(html: string, ...patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[0]) return m[0];
  }
  return null;
}

async function tryFragrantica(name: string, brand: string) {
  const query = encodeURIComponent(`${brand} ${name}`);
  const searchRes = await fetch(`https://www.fragrantica.com/search/?query=${query}`, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!searchRes.ok) return null;
  const searchHtml = await searchRes.text();

  let image_url = firstImageMatch(searchHtml, /https:\/\/fimgs\.net\/mdimg\/perfume\/375x500\.\d+\.jpg/);
  let top_notes: string[] = [];
  let heart_notes: string[] = [];
  let base_notes: string[] = [];
  let description: string | null = null;

  const detailPath = searchHtml.match(/href="(\/perfume\/[^"?]+\.html)"/)?.[1];
  if (detailPath) {
    try {
      const detailRes = await fetch(`https://www.fragrantica.com${detailPath}`, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(7000),
      });
      if (detailRes.ok) {
        const html = await detailRes.text();
        if (!image_url) image_url = firstImageMatch(html, /https:\/\/fimgs\.net\/mdimg\/perfume\/375x500\.\d+\.jpg/);
        top_notes = extractNoteNames(html, "Top Notes");
        heart_notes = extractNoteNames(html, "Heart Notes");
        if (!heart_notes.length) heart_notes = extractNoteNames(html, "Middle Notes");
        base_notes = extractNoteNames(html, "Base Notes");
        const meta = html.match(/<meta name="description" content="([^"]{10,})"/i)?.[1];
        if (meta) description = meta;
      }
    } catch { /* keep image from search */ }
  }

  return { image_url, top_notes, heart_notes, base_notes, description };
}

async function tryScrapeSite(url: string, ...imagePatterns: RegExp[]): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { ...FETCH_HEADERS, Referer: new URL(url).origin }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const html = await res.text();
    return firstImageMatch(html, ...imagePatterns);
  } catch {
    return null;
  }
}

async function fallbackImageSources(name: string, brand: string): Promise<string | null> {
  const q = encodeURIComponent(`${brand} ${name}`);

  // ScentSplit (Shopify CDN)
  const scentsplit = await tryScrapeSite(
    `https://www.scentsplit.com/search?q=${q}`,
    /https:\/\/cdn\.shopify\.com\/s\/files\/[^"'\s]+perfume[^"'\s]+\.(jpg|jpeg|png|webp)/i,
    /https:\/\/cdn\.shopify\.com\/s\/files\/[^"'\s]+\.(jpg|jpeg|png|webp)/i,
  );
  if (scentsplit) return scentsplit;

  // Scentbird
  const scentbird = await tryScrapeSite(
    `https://www.scentbird.com/search?q=${q}`,
    /https:\/\/[a-z0-9.-]*cloudfront\.net\/[^"'\s]+\.(jpg|jpeg|png|webp)/i,
    /https:\/\/[a-z0-9.-]*scentbird[^"'\s]+\.(jpg|jpeg|png|webp)/i,
  );
  if (scentbird) return scentbird;

  // FragranceX
  const fragrancex = await tryScrapeSite(
    `https://www.fragrancex.com/products/_cid_perfume-am-l-00_-sid_search-am-l-00_-lid_1-am-size-am-w_-wsize_5.html?q=${q}`,
    /https:\/\/[^"'\s]+fragrancex[^"'\s]+\.(jpg|jpeg|png|webp)/i,
    /https:\/\/[^"'\s]+(?:products|images)[^"'\s]+\.(jpg|jpeg|png|webp)/i,
  );
  if (fragrancex) return fragrancex;

  // Lucky Scent
  const lucky = await tryScrapeSite(
    `https://www.luckyscent.com/search.aspx?q=${q}`,
    /https:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/i,
  );
  if (lucky) return lucky;

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
          content: `Direct product bottle image URL for "${name}" by ${brand}. Prefer Fragrantica CDN (fimgs.net), brand official site, or major retailer. Return URL only or null.`,
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

  // Primary: Fragrantica
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

  // If no image found, try alternative sources
  if (!image_url) {
    image_url = await fallbackImageSources(name, brand);
  }

  return NextResponse.json({ image_url, top_notes, heart_notes, base_notes, description });
}
