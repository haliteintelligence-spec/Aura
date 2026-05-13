import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { perfumes, occasion, season, mood, count, intensityLongevity, intensitySillage, mode } = await request.json();

  let prompt: string;

  if (mode === "generate") {
    prompt = `You are a master perfumer. Create a perfume layering combination.

Criteria:
- Occasion: ${occasion?.join(", ") || "any"}
- Season: ${season?.join(", ") || "any"}
- Mood: ${mood?.join(", ") || "any"}
- Number of perfumes: ${count || 2}
- Longevity intensity (1-10): ${intensityLongevity || 5}
- Sillage intensity (1-10): ${intensitySillage || 5}

Available perfumes in closet:
${perfumes.map((p: { name: string; brand: string; top_notes: string[]; heart_notes: string[]; base_notes: string[] }, i: number) => `${i + 1}. ${p.name} by ${p.brand} — Notes: ${[...p.top_notes, ...p.heart_notes, ...p.base_notes].join(", ")}`).join("\n")}

Select the best ${count || 2} perfumes from the list and explain how to layer them.`;
  } else {
    prompt = `You are a master perfumer. Analyze this perfume layering combination:

${perfumes.map((p: { name: string; brand: string; top_notes: string[]; heart_notes: string[]; base_notes: string[] }, i: number) => `${i + 1}. ${p.name} by ${p.brand}\n   Top: ${p.top_notes.join(", ")}\n   Heart: ${p.heart_notes.join(", ")}\n   Base: ${p.base_notes.join(", ")}`).join("\n\n")}

Analyze how these fragrances would interact when layered together.`;
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `${prompt}

Return a JSON object:
{
  "selected_perfumes": ["Perfume Name 1", "Perfume Name 2"],
  "layering_order": "Apply [X] first as the base, then [Y] on top...",
  "combined_profile": "Evocative description of the combined scent (3-4 sentences)",
  "dominant_notes": ["note1", "note2", "note3"],
  "character": "Romantic and warm | Fresh and energetic | etc.",
  "estimated_longevity": "6-8 hours",
  "estimated_sillage": "Moderate | Strong | Intimate",
  "tips": "Practical layering tips",
  "name_suggestion": "A poetic name for this combination"
}`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "{}";

  let result = {};
  try {
    result = JSON.parse(text);
  } catch {
    result = { combined_profile: text };
  }

  return NextResponse.json(result);
}
