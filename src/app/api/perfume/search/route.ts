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
    system: `You are a fragrance encyclopaedia with expert-level knowledge of every perfume house and their catalogues.
Brand attribution is your highest priority — never guess or approximate a brand name.
If you are not certain which brand made a fragrance, omit it rather than risk a wrong attribution.
Common mistakes to avoid: confusing niche houses with similar names, attributing a fragrance to the wrong house in a conglomerate (e.g. Penhaligon's and Jo Malone are both British but entirely separate brands), or misremembering limited-edition or regional releases.
Always respond with valid JSON only, no other text.`,
    messages: [
      {
        role: "user",
        content: `Search query: "${query}"

Return a JSON array of up to 8 real perfumes that best match this query.
Before writing each result, verify in your knowledge: which brand actually made this specific fragrance?
Do not confuse fragrances with similar names from different houses.

Each object must have:
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

Only include fragrances you are certain about. Return JSON array only.`,
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
