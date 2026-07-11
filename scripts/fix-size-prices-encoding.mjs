/**
 * Fix collection_items rows where `size_prices` was double-JSON-encoded.
 *
 * Root cause: the API used to call JSON.stringify(size_prices) before handing
 * it to the `postgres` driver for a jsonb column, which stringifies it again.
 * Affected rows have a jsonb *string* (e.g. "[{\"size\":\"50ml\",...}]")
 * instead of a real jsonb *array*. This crashes any code that does
 * size_prices.find(...) / .map(...) on read.
 *
 * This script finds rows where jsonb_typeof(size_prices) = 'string',
 * JSON.parses the string back into an array, and re-saves it as real jsonb.
 *
 * Run:
 *   node scripts/fix-size-prices-encoding.mjs --dry-run   # preview only
 *   node scripts/fix-size-prices-encoding.mjs             # apply fixes
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

const envPath = path.join(__dirname, "../.env.local");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);

const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL missing from .env.local"); process.exit(1); }

const sql = postgres(DATABASE_URL, {
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function main() {
  const rows = await sql`
    SELECT id, size_prices
    FROM collection_items
    WHERE jsonb_typeof(size_prices) = 'string'
  `;

  console.log(`Found ${rows.length} row(s) with double-encoded size_prices${DRY_RUN ? " (dry run)" : ""}\n`);

  let fixed = 0, failed = 0;

  for (const row of rows) {
    let parsed;
    try {
      // row.size_prices is a JS string here (the corrupted jsonb scalar)
      parsed = JSON.parse(row.size_prices);
      if (!Array.isArray(parsed)) throw new Error("parsed value is not an array");
    } catch (e) {
      console.error(`  FAIL ${row.id}: could not parse — ${e.message}`);
      failed++;
      continue;
    }

    console.log(`  ${DRY_RUN ? "would fix" : "fixing"} ${row.id}: ${row.size_prices} -> ${JSON.stringify(parsed)}`);

    if (!DRY_RUN) {
      await sql`
        UPDATE collection_items
        SET size_prices = ${sql.json(parsed)}, updated_at = updated_at
        WHERE id = ${row.id}
      `;
    }
    fixed++;
  }

  console.log(`\n── Results ──────────────────────────────`);
  console.log(`${DRY_RUN ? "Would fix" : "Fixed"}: ${fixed} / ${rows.length}`);
  if (failed) console.log(`Failed to parse: ${failed}`);

  await sql.end();
}

main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
