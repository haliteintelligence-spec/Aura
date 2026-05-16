import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

// ── DB lookup: match GPT candidate against our perfumes catalog ───────────────

async function enrichFromDB(name: string, brand: string) {
  try {
    const supabase = await createClient();
    // Try exact brand + fuzzy name first
    const { data } = await supabase
      .from("perfumes")
      .select("name,brand,year,description,top_notes,heart_notes,base_notes,fragrance_family,gender,image_url,prices")
      .ilike("brand", brand.trim())
      .ilike("name", `%${name.trim()}%`)
      .limit(1)
      .single();
    if (data) return data;

    // Looser: just name match across any brand
    const { data: loose } = await supabase
      .from("perfumes")
      .select("name,brand,year,description,top_notes,heart_notes,base_notes,fragrance_family,gender,image_url,prices")
      .ilike("name", `%${name.trim()}%`)
      .ilike("brand", `%${brand.trim().split(" ")[0]}%`)
      .limit(1)
      .single();
    return loose ?? null;
  } catch {
    return null;
  }
}

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
  let parsed: { candidates: Array<Record<string, unknown>> } = { candidates: [] };
  try { parsed = JSON.parse(text); } catch { /* keep empty */ }

  // Enrich each candidate with database data where available
  const enriched = await Promise.all(
    (parsed.candidates ?? []).map(async (c) => {
      const name = String(c.name ?? "");
      const brand = String(c.brand ?? "");
      if (!name || !brand) return c;

      const db = await enrichFromDB(name, brand);
      if (!db) return c;

      // DB wins on all factual fields; keep GPT confidence score
      return {
        ...c,
        name: db.name,
        brand: db.brand,
        year: db.year ?? c.year,
        description: db.description ?? c.description,
        top_notes: db.top_notes?.length ? db.top_notes : c.top_notes,
        heart_notes: db.heart_notes?.length ? db.heart_notes : c.heart_notes,
        base_notes: db.base_notes?.length ? db.base_notes : c.base_notes,
        fragrance_family: db.fragrance_family?.length ? db.fragrance_family : c.fragrance_family,
        gender: db.gender ?? c.gender,
        image_url: db.image_url ?? c.image_url,
        prices: db.prices ?? [],
        source: "database",
      };
    })
  );

  return NextResponse.json({ candidates: enriched });
}
