import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const imageFile = formData.get("image") as File | null;
  const imageUrl = formData.get("imageUrl") as string | null;

  if (!imageFile && !imageUrl) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  type B64MediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  let imageSource:
    | { type: "base64"; media_type: B64MediaType; data: string }
    | { type: "url"; url: string };

  if (imageFile) {
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mt = (imageFile.type || "image/jpeg") as B64MediaType;
    imageSource = { type: "base64", media_type: mt, data: base64 };
  } else {
    imageSource = { type: "url", url: imageUrl! };
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: imageSource,
          },
          {
            type: "text",
            text: `Identify the perfume in this image. Look at the bottle shape, label, brand name, and any text visible.

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

If you cannot identify the perfume, return your best guesses based on bottle style and brand cues.
Return JSON only.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : '{"candidates":[]}';

  let result = { candidates: [] };
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    result = JSON.parse(cleaned);
  } catch {
    result = { candidates: [] };
  }

  return NextResponse.json(result);
}
