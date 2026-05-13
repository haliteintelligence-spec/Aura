import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL_MINI } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { name, brand, sizes } = await request.json();

  const completion = await openai.chat.completions.create({
    model: MODEL_MINI,
    max_tokens: 1000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a fragrance pricing expert with knowledge of retail prices across major retailers. Always respond with valid JSON only.",
      },
      {
        role: "user",
        content: `Provide retail price estimates for: "${name}" by ${brand}

Sizes requested: ${sizes.join(", ")}

Return a JSON object with a "prices" array, one entry per size:
{
  "prices": [
    {
      "size": "30ml",
      "price_min": 60,
      "price_max": 85,
      "currency": "USD"
    }
  ]
}

Base estimates on typical retail pricing at Sephora, Nordstrom, Bloomingdale's.
For niche brands, adjust accordingly.
If a size doesn't exist for this fragrance, omit it.`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? '{"prices":[]}';

  let prices = [];
  try {
    const parsed = JSON.parse(text);
    prices = Array.isArray(parsed) ? parsed : (parsed.prices ?? []);
  } catch {
    prices = [];
  }

  return NextResponse.json({ prices });
}
