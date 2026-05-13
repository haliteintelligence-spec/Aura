import { NextRequest, NextResponse } from "next/server";

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
    // Step 1: search page → image + detail link
    const query = encodeURIComponent(`${brand} ${name}`);
    const searchRes = await fetch(`https://www.fragrantica.com/search/?query=${query}`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(5000),
    });

    if (!searchRes.ok) return NextResponse.json(empty);
    const searchHtml = await searchRes.text();

    const imageMatch = searchHtml.match(/https:\/\/fimgs\.net\/mdimg\/perfume\/375x500\.\d+\.jpg/);
    image_url = imageMatch?.[0] ?? null;

    // Step 2: detail page → enriched notes
    const detailPath = searchHtml.match(/href="(\/perfume\/[^"?]+\.html)"/)?.[1];
    if (detailPath) {
      try {
        const detailRes = await fetch(`https://www.fragrantica.com${detailPath}`, {
          headers: FETCH_HEADERS,
          signal: AbortSignal.timeout(7000),
        });
        if (detailRes.ok) {
          const html = await detailRes.text();

          if (!image_url) {
            const img = html.match(/https:\/\/fimgs\.net\/mdimg\/perfume\/375x500\.\d+\.jpg/);
            image_url = img?.[0] ?? null;
          }

          top_notes = extractNoteNames(html, "Top Notes");
          heart_notes = extractNoteNames(html, "Heart Notes");
          if (!heart_notes.length) heart_notes = extractNoteNames(html, "Middle Notes");
          base_notes = extractNoteNames(html, "Base Notes");

          // Try meta description
          const meta = html.match(/<meta name="description" content="([^"]{10,})"/i)?.[1];
          if (meta) description = meta;
        }
      } catch {
        // detail page failed — keep image from search
      }
    }
  } catch {
    // scraping entirely failed
  }

  return NextResponse.json({ image_url, top_notes, heart_notes, base_notes, description });
}
