import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const { query } = await request.json();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `You are a perfume expert database. When given a search query, return up to 8 matching perfumes.
Always respond with valid JSON only, no other text.`,
    messages: [
      {
        role: "user",
        content: `Search query: "${query}"

Return a JSON array of up to 8 perfumes matching this query. Each object must have:
{
  "name": "Perfume Name",
  "brand": "Brand Name",
  "year": 2010,
  "description": "Brief evocative description (2-3 sentences)",
  "top_notes": ["note1", "note2"],
  "heart_notes": ["note1", "note2"],
  "base_notes": ["note1", "note2"],
  "fragrance_family": ["Floral", "Woody"],
  "gender": "unisex | masculine | feminine",
  "image_url": null
}

Be accurate. Include real perfumes only. Return JSON array only.`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";

  let results = [];
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    results = JSON.parse(cleaned);
  } catch {
    results = [];
  }

  return NextResponse.json({ results });
}
