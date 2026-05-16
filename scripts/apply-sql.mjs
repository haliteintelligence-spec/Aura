/**
 * Apply 003_backfill_images.sql and 004_scraped_brands.sql to Supabase.
 * Parses each SQL file and uses the JS client (service role) to execute.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local:
 *   1. Go to Supabase Dashboard → Project Settings → API
 *   2. Copy the "service_role" key
 *   3. Add to .env.local:  SUPABASE_SERVICE_ROLE_KEY=your_key_here
 *
 * Run: node scripts/apply-sql.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ───────────────────────────────────────────────────────────

const envPath = path.join(__dirname, "../.env.local");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) { console.error("NEXT_PUBLIC_SUPABASE_URL missing from .env.local"); process.exit(1); }
if (!SERVICE_KEY) {
  console.error(`
SUPABASE_SERVICE_ROLE_KEY is not set in .env.local

Steps to fix:
  1. Open Supabase Dashboard → Project Settings → API
  2. Copy the "service_role" secret key
  3. Open .env.local in a text editor and add:
       SUPABASE_SERVICE_ROLE_KEY=your_key_here
  4. Run this script again
`);
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── SQL string unescaping ─────────────────────────────────────────────────────

function unesc(s) {
  return s.replace(/''/g, "'");
}

function parsePgArray(s) {
  // '{item1,item2}' or '{"item 1","item 2"}'
  const inner = s.replace(/^\{|\}$/g, "");
  if (!inner) return [];
  const items = [];
  let buf = "", inQ = false;
  for (const ch of inner) {
    if (ch === '"' && !inQ) { inQ = true; continue; }
    if (ch === '"' && inQ) { inQ = false; continue; }
    if (ch === "," && !inQ) { items.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf) items.push(buf);
  return items;
}

// ── Apply 003_backfill_images.sql (UPDATE statements) ────────────────────────

async function applyBackfill(filePath) {
  console.log(`\nApplying ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, "utf8");

  // Match: update public.perfumes set ... where name = '...' and brand = '...';
  const stmtRe = /update\s+public\.perfumes\s+set\s+([\s\S]+?)\s+where\s+name\s*=\s*'((?:[^']|'')*)'\s+and\s+brand\s*=\s*'((?:[^']|'')*)'\s*;/gi;

  const records = [];
  let m;
  while ((m = stmtRe.exec(sql)) !== null) {
    const setClause = m[1];
    const name = unesc(m[2]);
    const brand = unesc(m[3]);

    const update = { name, brand };

    const imgMatch = /image_url\s*=\s*'((?:[^']|'')*)'/.exec(setClause);
    if (imgMatch) update.image_url = unesc(imgMatch[1]);

    const topMatch = /top_notes\s*=\s*'(\{[^}]*\})'/.exec(setClause);
    if (topMatch) update.top_notes = parsePgArray(topMatch[1]);

    const heartMatch = /heart_notes\s*=\s*'(\{[^}]*\})'/.exec(setClause);
    if (heartMatch) update.heart_notes = parsePgArray(heartMatch[1]);

    const baseMatch = /base_notes\s*=\s*'(\{[^}]*\})'/.exec(setClause);
    if (baseMatch) update.base_notes = parsePgArray(baseMatch[1]);

    records.push(update);
  }

  console.log(`  Parsed ${records.length} updates`);

  let ok = 0, fail = 0;
  const BATCH = 20;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await Promise.all(batch.map(async ({ name, brand, ...fields }) => {
      const { error } = await db
        .from("perfumes")
        .update(fields)
        .eq("name", name)
        .eq("brand", brand);
      if (error) { console.error(`  FAIL ${brand} – ${name}: ${error.message}`); fail++; }
      else ok++;
    }));
    process.stdout.write(`  ${Math.min(i + BATCH, records.length)}/${records.length}\r`);
  }
  console.log(`\n  Done: ${ok} updated, ${fail} failed`);
}

// ── Apply 004_scraped_brands.sql (INSERT statements) ─────────────────────────

async function applyScraped(filePath) {
  console.log(`\nApplying ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, "utf8");

  // Extract the VALUES block
  const valuesBlock = sql.match(/values\s*([\s\S]+?)\son\s+conflict/i)?.[1];
  if (!valuesBlock) { console.log("  No values block found"); return; }

  // Parse each row: (uuid_generate_v4(), 'name', 'brand', year|NULL, desc|NULL, top, heart, base, family, gender|NULL, image|NULL, now())
  const rowRe = /\(\s*uuid_generate_v4\(\)\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*(NULL|\d+)\s*,\s*(NULL|'(?:[^']|'')*')\s*,\s*'(\{[^}]*\})'\s*,\s*'(\{[^}]*\})'\s*,\s*'(\{[^}]*\})'\s*,\s*'(\{[^}]*\})'\s*,\s*(NULL|'(?:[^']|'')*')\s*,\s*(NULL|'(?:[^']|'')*')\s*,\s*now\(\)\s*\)/gi;

  const rows = [];
  let m;
  while ((m = rowRe.exec(valuesBlock)) !== null) {
    rows.push({
      name: unesc(m[1]),
      brand: unesc(m[2]),
      year: m[3] === "NULL" ? null : parseInt(m[3]),
      description: m[4] === "NULL" ? null : unesc(m[4].slice(1, -1)),
      top_notes: parsePgArray(m[5]),
      heart_notes: parsePgArray(m[6]),
      base_notes: parsePgArray(m[7]),
      fragrance_family: parsePgArray(m[8]),
      gender: m[9] === "NULL" ? null : unesc(m[9].slice(1, -1)),
      image_url: m[10] === "NULL" ? null : unesc(m[10].slice(1, -1)),
    });
  }

  console.log(`  Parsed ${rows.length} new perfumes`);

  let ok = 0, fail = 0;
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await db
      .from("perfumes")
      .insert(batch, { onConflict: "name,brand", ignoreDuplicates: true });
    if (error) { console.error(`  FAIL batch ${i}–${i + BATCH}: ${error.message}`); fail += batch.length; }
    else ok += batch.length;
    process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log(`\n  Done: ${ok} inserted, ${fail} failed`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const migrationsDir = path.join(__dirname, "../supabase/migrations");

  const backfillPath = path.join(migrationsDir, "003_backfill_images.sql");
  const scrapedPath = path.join(migrationsDir, "004_scraped_brands.sql");

  if (fs.existsSync(backfillPath)) {
    await applyBackfill(backfillPath);
  } else {
    console.log("003_backfill_images.sql not found — skipping");
  }

  if (fs.existsSync(scrapedPath)) {
    await applyScraped(scrapedPath);
  } else {
    console.log("004_scraped_brands.sql not found — run scrape-brands.mjs first");
  }

  console.log("\nAll done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
