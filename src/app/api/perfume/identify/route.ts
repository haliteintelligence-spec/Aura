import { NextRequest, NextResponse } from "next/server";
import { openai, MODEL } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { getBrandDomain, searchBrandSite } from "@/lib/brand-scraper";

async function enrichFromDB(name: string, brand: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("perfumes")
      .select("name,brand,year,description,top_notes,heart_notes,base_notes,fragrance_family,gender,image_url,prices")
      .ilike("brand", brand.trim())
      .ilike("name", `%${name.trim()}%`)
      .limit(1)
      .single();
    if (data) return data;

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

async function enrichFromBrandSite(name: string, brand: string): Promise<{ image_url?: string } | null> {
  try {
    const domain = await getBrandDomain(brand);
    if (!domain) return null;
    const results = await searchBrandSite(domain, name, brand);
    const match = results.find((r) => r.image_url);
    return match ? { image_url: match.image_url } : null;
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

  // Enrich each candidate: DB first, brand site if DB miss
  const enriched = await Promise.all(
    (parsed.candidates ?? []).map(async (c) => {
      const name = String(c.name ?? "");
      const brand = String(c.brand ?? "");
      if (!name || !brand) return c;

      const db = await enrichFromDB(name, brand);
      if (db) {
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
      }

      // DB miss — try brand site for image at minimum
      const brandSite = await enrichFromBrandSite(name, brand);
      if (brandSite?.image_url) {
        return { ...c, image_url: brandSite.image_url, source: "brand_site" };
      }

      return c;
    })
  );

  // If all candidates have low confidence or none matched DB, add similar DB matches
  const hasLowConfidence = enriched.every((c) => ((c as Record<string, unknown>).confidence as number ?? 0) < 0.7 || (c as Record<string, unknown>).source !== "database");
  if (hasLowConfidence && enriched.length > 0) {
    try {
      const supabase = await createClient();
      const topCandidate = enriched[0];
      const nameTokens = String(topCandidate.name ?? "").split(/\s+/).filter((w) => w.length > 2);
      const brand = String(topCandidate.brand ?? "");
      const seenNames = new Set(enriched.map((c) => `${c.brand}||${c.name}`.toLowerCase()));

      const dbSimilar: Array<Record<string, unknown>> = [];
      for (const token of nameTokens.slice(0, 2)) {
        const { data } = await supabase
          .from("perfumes")
          .select("name,brand,year,description,top_notes,heart_notes,base_notes,fragrance_family,gender,image_url")
          .ilike("brand", `%${brand.split(" ")[0]}%`)
          .ilike("name", `%${token}%`)
          .limit(3);
        for (const row of data ?? []) {
          const key = `${row.brand}||${row.name}`.toLowerCase();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            dbSimilar.push({ ...row, confidence: 0.5, source: "database_similar" });
          }
        }
      }
      enriched.push(...dbSimilar.slice(0, 3));
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ candidates: enriched });
}
