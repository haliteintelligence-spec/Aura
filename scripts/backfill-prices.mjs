/**
 * Backfill prices for all perfumes in the database that don't have prices yet.
 * Calls the local /api/perfume/price endpoint (which scrapes brand pages + GPT fallback).
 *
 * Run: node scripts/backfill-prices.mjs
 * Requires: npm run dev running on localhost:3000
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
const PRICE_API = "http://localhost:3000/api/perfume/price";
const CONCURRENCY = 3;
const DELAY_MS = 600;

// Standard sizes to request for each perfume
const SIZES = ["30ml", "50ml", "75ml", "100ml", "200ml", "sample"];

async function fetchPrices(name, brand) {
  try {
    const res = await fetch(PRICE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brand, sizes: SIZES }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const { prices } = await res.json();
    return Array.isArray(prices) && prices.length > 0 ? prices : null;
  } catch {
    return null;
  }
}

async function main() {
  // Fetch all perfumes without prices (or empty prices)
  const { data: perfumes, error } = await db
    .from("perfumes")
    .select("id, name, brand, prices")
    .or("prices.is.null,prices.eq.[]");

  if (error) { console.error("DB error:", error.message); process.exit(1); }

  console.log(`Found ${perfumes.length} perfumes needing prices\n`);

  let done = 0, success = 0, failed = 0;

  for (let i = 0; i < perfumes.length; i += CONCURRENCY) {
    const batch = perfumes.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (p) => {
      const prices = await fetchPrices(p.name, p.brand);
      done++;
      const pct = Math.round((done / perfumes.length) * 100);

      if (prices && prices.length > 0) {
        const { error: upErr } = await db
          .from("perfumes")
          .update({ prices })
          .eq("id", p.id);

        if (upErr) {
          process.stdout.write(`[${pct}%] ERR ${p.brand} – ${p.name}: ${upErr.message}\n`);
          failed++;
        } else {
          const summary = prices.map((pr) => `${pr.size} $${pr.price_min}`).join(" | ");
          process.stdout.write(`[${pct}%] ✓ ${p.brand} – ${p.name}: ${summary}\n`);
          success++;
        }
      } else {
        process.stdout.write(`[${pct}%] · ${p.brand} – ${p.name} (no prices found)\n`);
        failed++;
      }
    }));

    if (i + CONCURRENCY < perfumes.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n── Results ──────────────────────────────`);
  console.log(`Prices found: ${success} / ${perfumes.length}`);
  console.log(`No prices:    ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
