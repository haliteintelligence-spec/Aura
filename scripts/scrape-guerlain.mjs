/**
 * Enrich Guerlain perfumes using GPT-4o knowledge.
 * guerlain.com is blocked by Akamai WAF — GPT training data is used as source.
 * Updates existing 21 entries with full notes + inserts new ones.
 *
 * Run: node scripts/scrape-guerlain.mjs
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

const BRAND = "Guerlain";

async function gptFetchCatalog(batch) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a fragrance encyclopaedia. Return detailed, accurate data for Guerlain perfumes.
For each perfume include: name (exact official name), year (launch year), gender (feminine/masculine/unisex),
description (2-3 sentences, evocative), top_notes, heart_notes, base_notes, fragrance_family (array of family names like Floral, Oriental, Chypre, Fougère, Gourmand, Citrus, Woody, Aromatic, etc.).
Only include fragrances — no skincare, makeup, candles.`,
        },
        {
          role: "user",
          content: `Return a complete list of Guerlain fragrances${batch ? ` (batch: ${batch})` : ""} in this JSON format:
{
  "perfumes": [
    {
      "name": "Shalimar",
      "year": 1925,
      "gender": "feminine",
      "description": "...",
      "top_notes": ["Bergamot", "Lemon"],
      "heart_notes": ["Rose", "Jasmine", "Iris"],
      "base_notes": ["Tonka Bean", "Vanilla", "Civet", "Incense"],
      "fragrance_family": ["Oriental", "Vanilla"]
    }
  ]
}

Include all major releases and iconic classics. ${batch === "classics"
  ? "Focus on fragrances launched before 2000: Shalimar, Jicky, L'Heure Bleue, Mitsouko, Vol de Nuit, Habit Rouge, Samsara, Nahema, Champs-Élysées, Vetiver, Chamade, Parure, Jardins de Bagatelle, Héritage, Après L'Ondée, Derby, Mahora, Insolence, Idylle, Mon Exclusif, and all others pre-2000."
  : batch === "modern"
  ? "Focus on fragrances launched from 2000 onwards: Mon Guerlain, La Petite Robe Noire series, Aqua Allegoria collection, L'Instant series, Meteorites, Terre Précieuse, Abeille Royale editions, Bloom of Rose, Cherry Blossom, Rose Barbare, Arsène Lupin Dandy, Bois Mystérieux, L'Art et la Matière collection, Spiritueuse Double Vanille, Encens Mythique, Rose Nacré du Désert, Oud Essentiel, Cuir Beluga, Musc Noble, Vétiver pour Elle, Iris Ganache, Mahora, Terracotta, Cruel Gardénia, La Cologne du Parfumeur, and all others post-2000."
  : "Include all Guerlain fragrances you know of, aiming for 40+ entries."
}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GPT error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  return Array.isArray(parsed.perfumes) ? parsed.perfumes : [];
}

async function tryGetImage(name) {
  // Try the /api/perfume/details endpoint to fetch image from web
  try {
    const res = await fetch("http://localhost:3000/api/perfume/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brand: BRAND }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.image_url ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

async function main() {
  // Load existing Guerlain entries from DB
  const { data: existing } = await db
    .from("perfumes")
    .select("id,name")
    .ilike("brand", BRAND);

  const existingMap = new Map(
    (existing ?? []).map((r) => [r.name.toLowerCase().trim(), r.id])
  );
  console.log(`Existing Guerlain entries in DB: ${existingMap.size}`);

  // Fetch catalog in three GPT batches for thoroughness
  console.log("\nFetching classic Guerlain catalog from GPT...");
  const classics = await gptFetchCatalog("classics");
  console.log(`  Got ${classics.length} classics`);

  console.log("Fetching modern Guerlain catalog from GPT...");
  const modern = await gptFetchCatalog("modern");
  console.log(`  Got ${modern.length} modern`);

  console.log("Fetching additional Guerlain catalog from GPT...");
  const extra = await gptFetchCatalog(null);
  console.log(`  Got ${extra.length} additional`);

  // Deduplicate across batches
  const seen = new Set();
  const all = [];
  for (const p of [...classics, ...modern, ...extra]) {
    const key = p.name?.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    all.push(p);
  }
  console.log(`\nTotal unique perfumes from GPT: ${all.length}`);

  let updated = 0, inserted = 0, failed = 0;

  for (const p of all) {
    if (!p.name) continue;
    const nameClean = p.name.trim();
    const row = {
      name: nameClean,
      brand: BRAND,
      year: p.year ?? null,
      gender: p.gender ?? null,
      description: p.description ?? null,
      top_notes: Array.isArray(p.top_notes) ? p.top_notes : [],
      heart_notes: Array.isArray(p.heart_notes) ? p.heart_notes : [],
      base_notes: Array.isArray(p.base_notes) ? p.base_notes : [],
      fragrance_family: Array.isArray(p.fragrance_family) ? p.fragrance_family : [],
      prices: [],
    };

    const existingId = existingMap.get(nameClean.toLowerCase());
    if (existingId) {
      // Update but keep existing image_url if present
      const { error } = await db
        .from("perfumes")
        .update(row)
        .eq("id", existingId);
      if (error) {
        console.error(`  ERR updating ${nameClean}: ${error.message}`);
        failed++;
      } else {
        process.stdout.write(`  ↑ Updated: ${nameClean}\n`);
        updated++;
      }
    } else {
      const { error } = await db.from("perfumes").insert(row);
      if (error) {
        console.error(`  ERR inserting ${nameClean}: ${error.message}`);
        failed++;
      } else {
        process.stdout.write(`  + Inserted: ${nameClean}\n`);
        inserted++;
      }
    }
  }

  console.log(`\n── Results ──────────────────────`);
  console.log(`Updated:  ${updated}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Failed:   ${failed}`);
  console.log(`\nNote: Images will be backfilled separately via backfill-images.mjs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
