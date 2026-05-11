import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const { topPerfumes, topBrands, topNotes, topFamilies } = await request.json();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: "You are a perfume recommendation expert. Respond with valid JSON only.",
    messages: [
      {
        role: "user",
        content: `Based on this user's fragrance profile, recommend 6 new perfumes to try:

Top perfumes (most worn): ${topPerfumes?.join(", ") || "none yet"}
Favorite brands: ${topBrands?.join(", ") || "none yet"}
Favorite notes: ${topNotes?.join(", ") || "none yet"}
Favorite families: ${topFamilies?.join(", ") || "none yet"}

Recommend 6 perfumes the user would likely love but hasn't tried. Mix mainstream and niche.

Return JSON array:
[
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

Return JSON array only.`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";

  let recommendations = [];
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    recommendations = JSON.parse(cleaned);
  } catch {
    recommendations = [];
  }

  return NextResponse.json({ recommendations });
}
