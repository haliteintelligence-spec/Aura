import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { topPerfumes, topBrands, topNotes, topFamilies } = await request.json();

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a perfume recommendation expert. Respond with valid JSON only.",
      },
      {
        role: "user",
        content: `Based on this user's fragrance profile, recommend 6 new perfumes to try:

Top perfumes (most worn): ${topPerfumes?.join(", ") || "none yet"}
Favorite brands: ${topBrands?.join(", ") || "none yet"}
Favorite notes: ${topNotes?.join(", ") || "none yet"}
Favorite families: ${topFamilies?.join(", ") || "none yet"}

Recommend 6 perfumes the user would likely love but hasn't tried. Mix mainstream and niche.

Return a JSON object with a "recommendations" array:
{
  "recommendations": [
    {
      "name": "Perfume Name",
      "brand": "Brand",
      "year": 2019,
      "description": "Why this suits them (2 sentences)",
      "top_notes": ["note1"],
      "heart_notes": ["note1"],
      "base_notes": ["note1"],
      "fragrance_family": ["Woody"],
      "gender": "unisex",
      "image_url": null,
      "reason": "Short reason why based on their profile"
    }
  ]
}`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? '{"recommendations":[]}';

  let recommendations = [];
  try {
    const parsed = JSON.parse(text);
    recommendations = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? []);
  } catch {
    recommendations = [];
  }

  return NextResponse.json({ recommendations });
}
