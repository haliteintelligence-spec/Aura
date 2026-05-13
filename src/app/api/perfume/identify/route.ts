import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const imageFile = formData.get("image") as File | null;
  const imageUrl = formData.get("imageUrl") as string | null;

  if (!imageFile && !imageUrl) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  let imageDataUrl: string;

  if (imageFile) {
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mt = imageFile.type || "image/jpeg";
    imageDataUrl = `data:${mt};base64,${base64}`;
  } else {
    imageDataUrl = imageUrl!;
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageDataUrl } },
          {
            type: "text",
            text: `Identify the perfume in this image. Look at the bottle shape, label, brand name, and any visible text.

Return a JSON object with up to 3 candidates ordered by confidence:
{
  "candidates": [
    {
      "name": "Perfume Name",
      "brand": "Brand Name",
      "year": 2010,
      "description": "Brief evocative description",
      "top_notes": ["note1"],
      "heart_notes": ["note1"],
      "base_notes": ["note1"],
      "fragrance_family": ["Floral"],
      "gender": "feminine",
      "image_url": null,
      "confidence": 0.95
    }
  ]
}

If you cannot identify the perfume, return your best guesses based on bottle style and brand cues.`,
          },
        ],
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? '{"candidates":[]}';

  let result = { candidates: [] };
  try {
    result = JSON.parse(text);
  } catch {
    result = { candidates: [] };
  }

  return NextResponse.json(result);
}
