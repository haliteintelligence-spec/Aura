import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { name, brand } = await request.json();

  if (!name || !brand) return NextResponse.json({ image_url: null });

  // Try Fragrantica scrape first
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

    if (res.ok) {
      const html = await res.text();
      const match = html.match(/https:\/\/fimgs\.net\/mdimg\/perfume\/375x500\.\d+\.jpg/);
      if (match?.[0]) return NextResponse.json({ image_url: match[0] });
    }
  } catch {
    // fall through to OpenAI
  }

  // Fallback: ask OpenAI to find a perfume bottle image URL
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: "You are a fragrance database assistant. Return only a direct image URL for the perfume bottle, nothing else. The URL must end in .jpg, .jpeg, .png, or .webp. If you do not know a valid, real image URL, return the word null.",
        },
        {
          role: "user",
          content: `What is a direct product image URL for the perfume bottle of "${name}" by ${brand}? Prefer Fragrantica CDN URLs (fimgs.net) or the brand's official website. Return only the URL or null.`,
        },
      ],
    });

    const text = (completion.choices[0]?.message?.content ?? "").trim();
    const urlMatch = text.match(/https?:\/\/\S+\.(jpg|jpeg|png|webp)/i);
    return NextResponse.json({ image_url: urlMatch?.[0] ?? null });
  } catch {
    return NextResponse.json({ image_url: null });
  }
}
