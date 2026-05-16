/**
 * Backfill image URLs and notes for seeded perfumes by scraping brand pages.
 * Reads perfume list from 002_seed_perfumes.sql, hits the local
 * /api/perfume/details endpoint, and writes 003_backfill_images.sql
 *
 * Run: node scripts/backfill-images.mjs
 * Requires: npm run dev running on localhost:3000
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = "http://localhost:3000/api/perfume/details";
const CONCURRENCY = 3;   // parallel requests at a time
const DELAY_MS = 500;    // ms between batches

// ── Parse perfumes from the seed SQL ─────────────────────────────────────────

function parseSeedSQL() {
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/002_seed_perfumes.sql"),
    "utf8"
  );
  const perfumes = [];
  // Match each values row: (uuid_generate_v4(), 'Name', 'Brand', ...)
  const re = /uuid_generate_v4\(\),\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    perfumes.push({
      name: m[1].replace(/''/g, "'"),
      brand: m[2].replace(/''/g, "'"),
    });
  }
  return perfumes;
}

// ── Fetch details for one perfume ─────────────────────────────────────────────

async function fetchDetails(name, brand) {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brand }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Run in batches ────────────────────────────────────────────────────────────

async function runBatch(items) {
  return Promise.all(items.map(({ name, brand }) => fetchDetails(name, brand)));
}

function escape(s) {
  return s.replace(/'/g, "''");
}

function pgArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const items = arr.map((s) => `"${String(s).replace(/"/g, '\\"')}"`).join(",");
  return `'{${items}}'`;
}

async function main() {
  const perfumes = parseSeedSQL();
  console.log(`Found ${perfumes.length} perfumes in seed SQL\n`);

  const results = []; // { name, brand, image_url, top_notes, heart_notes, base_notes }
  let done = 0;

  for (let i = 0; i < perfumes.length; i += CONCURRENCY) {
    const batch = perfumes.slice(i, i + CONCURRENCY);
    const details = await runBatch(batch);

    for (let j = 0; j < batch.length; j++) {
      const { name, brand } = batch[j];
      const d = details[j];
      done++;
      const pct = Math.round((done / perfumes.length) * 100);

      const hasImage = d?.image_url;
      const hasNotes = d?.top_notes?.length || d?.heart_notes?.length || d?.base_notes?.length;

      if (d && (hasImage || hasNotes)) {
        results.push({
          name,
          brand,
          image_url: d.image_url ?? null,
          top_notes: d.top_notes ?? [],
          heart_notes: d.heart_notes ?? [],
          base_notes: d.base_notes ?? [],
        });
        const flags = [hasImage ? "img" : "", hasNotes ? "notes" : ""].filter(Boolean).join("+");
        console.log(`[${pct}%] ✓ ${brand} – ${name} (${flags})`);
      } else {
        process.stdout.write(`[${pct}%] · ${brand} – ${name} (no data)\n`);
      }
    }

    if (i + CONCURRENCY < perfumes.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n── Results ──────────────────────────────`);
  console.log(`Perfumes with data: ${results.length} / ${perfumes.length}`);

  if (results.length === 0) {
    console.log("No data found — is the dev server running on localhost:3000?");
    process.exit(1);
  }

  const updates = results.map(({ name, brand, image_url, top_notes, heart_notes, base_notes }) => {
    const sets = [];
    if (image_url) sets.push(`image_url = '${escape(image_url)}'`);
    const top = pgArray(top_notes);
    const heart = pgArray(heart_notes);
    const base = pgArray(base_notes);
    if (top) sets.push(`top_notes = ${top}`);
    if (heart) sets.push(`heart_notes = ${heart}`);
    if (base) sets.push(`base_notes = ${base}`);
    if (sets.length === 0) return null;
    return `update public.perfumes set ${sets.join(", ")} where name = '${escape(name)}' and brand = '${escape(brand)}';`;
  }).filter(Boolean);

  const sql = `-- Backfill: images + notes for ${results.length} perfumes (scraped from brand pages)
-- Generated ${new Date().toISOString()}
-- Paste in Supabase SQL Editor and run

${updates.join("\n")}
`;

  const outPath = path.join(__dirname, "../supabase/migrations/003_backfill_images.sql");
  fs.writeFileSync(outPath, sql, "utf8");
  console.log(`\n✓ Written to ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
