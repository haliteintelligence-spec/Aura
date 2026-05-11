import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const { name, brand, sizes } = await request.json();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: "You are a fragrance pricing expert with knowledge of retail prices across major retailers. Always respond with valid JSON only.",
    messages: [
      {
        role: "user",
        content: `Provide retail price estimates for: "${name}" by ${brand}

Sizes requested: ${sizes.join(", ")}

Return a JSON array with one entry per size:
[
  {
    "size": "30ml",
    "price_min": 60,
    "price_max": 85,
    "currency": "USD"
  }
]

Base estimates on typical retail pricing at Sephora, Nordstrom, Bloomingdale's.
For niche brands, adjust accordingly.
If a size doesn't exist for this fragrance, omit it.
Return JSON array only.`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";

  let prices = [];
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    prices = JSON.parse(cleaned);
  } catch {
    prices = [];
  }

  return NextResponse.json({ prices });
}
