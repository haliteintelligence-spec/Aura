/**
 * Scrape all Kheir Fragrances products from kheirfragrances.com (Shopify).
 * Extracts notes from prose body_html via GPT, prices from variants.
 * Upserts into Supabase perfumes table.
 *
 * Run: node scripts/scrape-kheir.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OPENAI_KEY = env.OPENAI_API_KEY;
if (!OPENAI_KEY) { console.error("OPENAI_API_KEY not in .env.local"); process.exit(1); }

const BRAND = "Kheir Fragrances";
const DOMAIN = "kheirfragrances.com";

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function extractNotes(title, prose) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Extract fragrance notes from a perfume description. Return JSON: {\"top_notes\": [...], \"heart_notes\": [...], \"base_notes\": [...]}. Include only actual scent ingredients (not adjectives). Use common note names. If the description uses 'top/opening', 'heart/middle', 'base/dry down', map to those groups. If grouping is unclear, distribute by typical volatility.",
        },
        { role: "user", content: `Perfume: "${title}"\n\nDescription:\n${prose}` },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json();
  const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  return {
    top_notes: Array.isArray(parsed.top_notes) ? parsed.top_notes : [],
    heart_notes: Array.isArray(parsed.heart_notes) ? parsed.heart_notes : [],
    base_notes: Array.isArray(parsed.base_notes) ? parsed.base_notes : [],
  };
}

function buildPrices(variants) {
  return variants
    .filter((v) => v.price && parseFloat(v.price) > 0)
    .map((v) => ({
      size: v.title.trim(),
      price_min: parseFloat(v.price),
      price_max: parseFloat(v.price),
      currency: "USD",
    }));
}

async function main() {
  const res = await fetch(`https://${DOMAIN}/products.json?limit=50`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) { console.error(`products.json returned ${res.status}`); process.exit(1); }
  const { products } = await res.json();
  console.log(`Found ${products.length} products\n`);

  for (const p of products) {
    const title = p.title.replace(/\s+/g, " ").trim();
    const prose = stripHtml(p.body_html ?? "");
    const image_url = p.images?.[0]?.src ?? null;
    const prices = buildPrices(p.variants ?? []);

    console.log(`Processing: ${title}`);

    const notes = await extractNotes(title, prose);
    console.log(`  top: ${notes.top_notes.join(", ") || "(none)"}`);
    console.log(`  heart: ${notes.heart_notes.join(", ") || "(none)"}`);
    console.log(`  base: ${notes.base_notes.join(", ") || "(none)"}`);
    console.log(`  prices: ${prices.map((x) => `${x.size} $${x.price_min}`).join(" | ") || "(none)"}`);
    console.log(`  image: ${image_url ?? "(none)"}`);

    const row = {
      name: title,
      brand: BRAND,
      top_notes: notes.top_notes,
      heart_notes: notes.heart_notes,
      base_notes: notes.base_notes,
      fragrance_family: [],
      image_url,
      prices,
      description: prose.slice(0, 500),
    };

    // Upsert: update if exists, insert if not
    const { data: existing } = await db
      .from("perfumes")
      .select("id")
      .ilike("brand", BRAND)
      .ilike("name", title)
      .limit(1)
      .single();

    if (existing?.id) {
      const { error } = await db.from("perfumes").update(row).eq("id", existing.id);
      if (error) console.error(`  ERROR updating: ${error.message}`);
      else console.log(`  → Updated (id ${existing.id})`);
    } else {
      const { error } = await db.from("perfumes").insert(row);
      if (error) console.error(`  ERROR inserting: ${error.message}`);
      else console.log(`  → Inserted`);
    }

    console.log();
  }

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
