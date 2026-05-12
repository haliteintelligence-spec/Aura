import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { name, brand } = await request.json();

  if (!name || !brand) return NextResponse.json({ image_url: null });

  try {
    const query = encodeURIComponent(`${brand} ${name}`);
    const res = await fetch(`https://www.fragrantica.com/search/?query=${query}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return NextResponse.json({ image_url: null });

    const html = await res.text();

    // Fragrantica CDN image pattern
    const match = html.match(/https:\/\/fimgs\.net\/mdimg\/perfume\/375x500\.\d+\.jpg/);
    return NextResponse.json({ image_url: match?.[0] ?? null });
  } catch {
    return NextResponse.json({ image_url: null });
  }
}
