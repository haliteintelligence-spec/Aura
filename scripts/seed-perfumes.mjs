/**
 * Seed script — generates ~1000 popular fragrances via GPT and writes
 * supabase/migrations/002_seed_perfumes.sql
 *
 * Run: node scripts/seed-perfumes.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error("OPENAI_API_KEY not set"); process.exit(1); }

const BATCHES = [
  { label: "Chanel",             prompt: "List 20 iconic Chanel fragrances (both classic and modern)" },
  { label: "Dior",               prompt: "List 20 iconic Christian Dior fragrances" },
  { label: "YSL",                prompt: "List 20 iconic Yves Saint Laurent fragrances" },
  { label: "Guerlain",           prompt: "List 20 iconic Guerlain fragrances" },
  { label: "Hermès",             prompt: "List 20 iconic Hermès fragrances" },
  { label: "Tom Ford",           prompt: "List 25 Tom Ford fragrances including Private Blend" },
  { label: "Creed",              prompt: "List 20 iconic Creed fragrances" },
  { label: "Maison Margiela",    prompt: "List 15 Maison Margiela Replica fragrances" },
  { label: "Jo Malone",          prompt: "List 20 popular Jo Malone London fragrances" },
  { label: "Byredo",             prompt: "List 20 popular Byredo fragrances" },
  { label: "Diptyque",           prompt: "List 20 popular Diptyque fragrances" },
  { label: "Le Labo",            prompt: "List 15 popular Le Labo fragrances" },
  { label: "Maison Francis Kurkdjian", prompt: "List 15 Maison Francis Kurkdjian fragrances" },
  { label: "Amouage",            prompt: "List 15 iconic Amouage fragrances" },
  { label: "Nishane",            prompt: "List 15 popular Nishane fragrances" },
  { label: "Parfums de Marly",   prompt: "List 15 popular Parfums de Marly fragrances" },
  { label: "Initio",             prompt: "List 10 popular Initio Parfums Privés fragrances" },
  { label: "Xerjoff",            prompt: "List 12 popular Xerjoff fragrances" },
  { label: "Penhaligon's",       prompt: "List 12 popular Penhaligon's fragrances" },
  { label: "Kayali",             prompt: "List 12 popular Kayali fragrances" },
  { label: "Armani",             prompt: "List 15 popular Giorgio Armani fragrances" },
  { label: "Versace",            prompt: "List 12 popular Versace fragrances" },
  { label: "Prada",              prompt: "List 12 popular Prada fragrances" },
  { label: "Burberry",           prompt: "List 10 popular Burberry fragrances" },
  { label: "Viktor & Rolf",      prompt: "List 10 popular Viktor and Rolf fragrances" },
  { label: "Thierry Mugler",     prompt: "List 12 popular Mugler fragrances" },
  { label: "Jean Paul Gaultier", prompt: "List 10 popular Jean Paul Gaultier fragrances" },
  { label: "Lancôme",            prompt: "List 12 popular Lancôme fragrances" },
  { label: "Givenchy",           prompt: "List 12 popular Givenchy fragrances" },
  { label: "Bulgari",            prompt: "List 12 popular Bulgari fragrances" },
  { label: "Acqua di Parma",     prompt: "List 12 popular Acqua di Parma fragrances" },
  { label: "Montale",            prompt: "List 15 popular Montale fragrances" },
  { label: "Memo Paris",         prompt: "List 10 popular Memo Paris fragrances" },
  { label: "Juliette Has a Gun", prompt: "List 10 popular Juliette Has a Gun fragrances" },
  { label: "Serge Lutens",       prompt: "List 12 popular Serge Lutens fragrances" },
  { label: "L'Artisan Parfumeur",prompt: "List 10 popular L'Artisan Parfumeur fragrances" },
  { label: "Kilian",             prompt: "List 12 popular Kilian Paris fragrances" },
  { label: "House of Bo",        prompt: "List all House of Bo fragrances you know" },
  { label: "Rabanne",            prompt: "List 10 popular Paco Rabanne fragrances" },
  { label: "Carolina Herrera",   prompt: "List 10 popular Carolina Herrera fragrances" },
  { label: "Marc Jacobs",        prompt: "List 10 popular Marc Jacobs fragrances" },
  { label: "Narciso Rodriguez",  prompt: "List 8 popular Narciso Rodriguez fragrances" },
  { label: "Valentino",          prompt: "List 8 popular Valentino fragrances" },
  { label: "Dolce & Gabbana",    prompt: "List 10 popular Dolce and Gabbana fragrances" },
  { label: "Versace Niche",      prompt: "List 5 popular Versace Atelier fragrances" },
  { label: "Frederic Malle",     prompt: "List 10 popular Frederic Malle fragrances" },
  { label: "Comme des Garçons",  prompt: "List 10 popular Comme des Garçons fragrances" },
  { label: "Histoires de Parfums", prompt: "List 10 popular Histoires de Parfums fragrances" },
  { label: "Roja Parfums",       prompt: "List 10 popular Roja Parfums fragrances" },
];

const SYSTEM = `You are a fragrance expert database. For each fragrance listed, return structured JSON.
RULES:
- brand must exactly match the real brand name (e.g. "Chanel" not "CHANEL")
- name must be the exact official name
- year is an integer (null if unknown)
- gender: "Women", "Men", or "Unisex"
- fragrance_family: array of 1-2 families from: Floral, Woody, Oriental, Resinous, Fresh, Citrus, Gourmand, Aromatic, Chypre, Fougère, Aquatic, Spicy, Leather, Powdery, Green
- top_notes, heart_notes, base_notes: arrays of 2-5 individual note names each
- Do NOT use "Oriental" — use "Resinous" instead
- Return ONLY valid JSON, no markdown`;

async function fetchBatch(prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${prompt}.\n\nReturn: {"perfumes": [{"name":"...","brand":"...","year":2020,"gender":"Unisex","fragrance_family":["Floral"],"top_notes":["Bergamot"],"heart_notes":["Rose"],"base_notes":["Musk"]}]}` },
      ],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return JSON.parse(json.choices[0].message.content).perfumes ?? [];
}

function escape(s) {
  if (s == null) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

function pgArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "'{}'";
  const items = arr.map((s) => `"${String(s).replace(/"/g, '\\"')}"`).join(",");
  return `'{${items}}'`;
}

async function main() {
  const all = [];
  const seen = new Set();

  for (const { label, prompt } of BATCHES) {
    process.stdout.write(`Fetching ${label}... `);
    try {
      const perfumes = await fetchBatch(prompt);
      let added = 0;
      for (const p of perfumes) {
        const key = `${p.brand}||${p.name}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(p);
        added++;
      }
      console.log(`${added} added (total: ${all.length})`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\nGenerating SQL for ${all.length} perfumes...`);

  const rows = all.map((p) =>
    `  (uuid_generate_v4(), ${escape(p.name)}, ${escape(p.brand)}, ${p.year ? p.year : "NULL"}, ${escape(p.description ?? null)}, ${pgArray(p.top_notes)}, ${pgArray(p.heart_notes)}, ${pgArray(p.base_notes)}, ${pgArray(p.fragrance_family)}, ${escape(p.gender ?? null)}, NULL, now())`
  );

  const sql = `-- Seed: ${all.length} popular fragrances
-- Generated ${new Date().toISOString()}
-- Run in Supabase SQL editor (uses service role, bypasses RLS)

insert into public.perfumes
  (id, name, brand, year, description, top_notes, heart_notes, base_notes, fragrance_family, gender, image_url, created_at)
values
${rows.join(",\n")}
on conflict do nothing;
`;

  const outPath = path.join(__dirname, "../supabase/migrations/002_seed_perfumes.sql");
  fs.writeFileSync(outPath, sql, "utf8");
  console.log(`\n✓ Written to ${outPath}`);
  console.log(`  ${all.length} perfumes total`);
}

main().catch((e) => { console.error(e); process.exit(1); });
