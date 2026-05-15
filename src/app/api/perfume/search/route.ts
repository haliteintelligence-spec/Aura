import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { query } = await request.json();

  if (!query || query.length < 2) {
    return NextResponse.json({ mode: "name", results: [] });
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a fragrance encyclopaedia. Given a search query, determine whether the user is typing a BRAND NAME or a PERFUME NAME, then return the appropriate catalogue.

BRAND query (e.g. "Kayali", "Dior", "Jo Malone", "Tom Ford"):
- Return ALL perfumes made by that brand that you know of, sorted strictly A-Z by name.
- Include up to 60 perfumes. Omit descriptions and notes to save space.
- Set mode = "brand" and include the canonical brand name.

NAME query (e.g. "Vanilla", "Black Orchid", "Sauvage"):
- Return perfumes whose name STARTS WITH the query fragment, across any brand, sorted strictly A-Z by name.
- Up to 20 results. Include brief descriptions and key notes.
- Set mode = "name".

Respond with valid JSON only:
{
  "mode": "brand" | "name",
  "brand": "Exact Official Brand Name",
  "results": [
    {
      "name": "Exact fragrance name",
      "brand": "Exact brand name",
      "year": 2020,
      "description": null,
      "top_notes": [],
      "heart_notes": [],
      "base_notes": [],
      "fragrance_family": [],
      "gender": "unisex | masculine | feminine",
      "image_url": null
    }
  ]
}

For brand mode, description/notes can be null/empty — they will be loaded on demand.
Sort results strictly A-Z by name in all cases.
Only include fragrances you are certain about.`,
      },
      {
        role: "user",
        content: `Search query: "${query}"`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? '{"mode":"name","results":[]}';

  try {
    const parsed = JSON.parse(text);
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    return NextResponse.json({
      mode: parsed.mode ?? "name",
      brand: parsed.brand ?? "",
      results,
    });
  } catch {
    return NextResponse.json({ mode: "name", brand: "", results: [] });
  }
}
