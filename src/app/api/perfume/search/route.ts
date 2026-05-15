import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { brand, name } = await request.json();

  const hasBrand = typeof brand === "string" && brand.trim().length >= 2;
  const hasName = typeof name === "string" && name.trim().length >= 2;

  if (!hasBrand && !hasName) {
    return NextResponse.json({ results: [] });
  }

  let systemPrompt: string;
  let userPrompt: string;

  if (hasBrand && !hasName) {
    // Brand-only: return full brand catalogue sorted A-Z
    systemPrompt = `You are a fragrance encyclopaedia. Return every perfume made by the specified brand that you know of, sorted strictly A-Z by name. Up to 60 entries. Omit description and notes to fit more results — they will be loaded later. Only include fragrances you are certain belong to this brand.`;
    userPrompt = `Brand: "${brand.trim()}"

Return JSON:
{
  "brand": "Exact Official Brand Name",
  "results": [
    { "name": "Fragrance name", "brand": "Brand", "year": 2020, "gender": "unisex", "description": null, "top_notes": [], "heart_notes": [], "base_notes": [], "fragrance_family": [], "image_url": null }
  ]
}`;
  } else if (!hasBrand && hasName) {
    // Name-only: cross-brand, names starting with the query
    systemPrompt = `You are a fragrance encyclopaedia with expert brand attribution. Return perfumes whose name STARTS WITH the given text, across all brands, sorted strictly A-Z by perfume name. Up to 20 results. Verify each brand attribution carefully — never guess. Include brief fragrance notes.`;
    userPrompt = `Perfume name starts with: "${name.trim()}"

Return JSON:
{
  "brand": "",
  "results": [
    { "name": "Fragrance name", "brand": "Exact brand", "year": 2020, "gender": "unisex", "description": "Brief description", "top_notes": ["note"], "heart_notes": [], "base_notes": [], "fragrance_family": ["Floral"], "image_url": null }
  ]
}`;
  } else {
    // Both: find the specific perfume
    systemPrompt = `You are a fragrance encyclopaedia. Find the exact perfume matching the given brand AND name. Return it as the first result. If not found exactly, return up to 5 closest matches. Verify brand attribution carefully. Include full fragrance details.`;
    userPrompt = `Brand: "${brand!.trim()}", Perfume name: "${name!.trim()}"

Return JSON:
{
  "brand": "${brand!.trim()}",
  "results": [
    { "name": "Fragrance name", "brand": "Exact brand", "year": 2020, "gender": "unisex", "description": "Description", "top_notes": ["note"], "heart_notes": [], "base_notes": [], "fragrance_family": ["Floral"], "image_url": null }
  ]
}`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? '{"results":[]}';
    const parsed = JSON.parse(text);
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    return NextResponse.json({ brand: parsed.brand ?? "", results });
  } catch {
    return NextResponse.json({ brand: "", results: [] });
  }
}
