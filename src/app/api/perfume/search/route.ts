import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { query } = await request.json();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a fragrance encyclopaedia with expert-level knowledge of every perfume house and their catalogues.
Brand attribution is your highest priority — never guess or approximate a brand name.
If you are not certain which brand made a fragrance, omit it rather than risk a wrong attribution.
Common mistakes to avoid: confusing niche houses with similar names, attributing a fragrance to the wrong house in a conglomerate (e.g. Penhaligon's and Jo Malone are both British but entirely separate brands), or misremembering limited-edition or regional releases.
Always respond with valid JSON only.`,
      },
      {
        role: "user",
        content: `Search query: "${query}"

Return up to 8 real perfumes that best match this query.
Before writing each result, verify in your knowledge: which brand actually made this specific fragrance?
Do not confuse fragrances with similar names from different houses.

Return a JSON object with a "results" array. Each item must have:
{
  "name": "Exact official fragrance name",
  "brand": "Exact official brand/house name",
  "year": 2010,
  "description": "Brief evocative description (2-3 sentences)",
  "top_notes": ["note1", "note2"],
  "heart_notes": ["note1", "note2"],
  "base_notes": ["note1", "note2"],
  "fragrance_family": ["Floral", "Woody"],
  "gender": "unisex | masculine | feminine",
  "image_url": null
}

Only include fragrances you are certain about.`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? '{"results":[]}';

  let results = [];
  try {
    const parsed = JSON.parse(text);
    results = Array.isArray(parsed) ? parsed : (parsed.results ?? []);
    if (!Array.isArray(results)) results = [];
  } catch {
    results = [];
  }

  return NextResponse.json({ results });
}
