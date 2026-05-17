/**
 * Scrape beauty products (fragrances + skincare/bodycare/haircare) from:
 *  - houseofbo.co       (House of Bō — Shopify, notes in page HTML prose)
 *  - snif.co            (Snif — Shopify, SMELLS LIKE: in body_html)
 *  - matiere-premiere.us (Matière Première — Shopify, prose body_html)
 *  - borntostandout.com (Born to Stand Out — Shopify, notes in product page HTML)
 *  - skylar.com         (Skylar — custom site, notes in product page HTML)
 *  - twistedlily.com    (Twisted Lily — Shopify retailer, notes in body_html, image fallback logic)
 *
 * Fragrances → public.perfumes
 * Skincare / body care / hair care / candles → public.beauty_products
 *
 * Run: node scripts/scrape-misc-brands.mjs [all|houseofbo|snif|matiere|btso|skylar|twistedlily]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OPENAI_KEY = env.OPENAI_API_KEY;
if (!OPENAI_KEY) { console.error("OPENAI_API_KEY not in .env.local"); process.exit(1); }

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/\s+/g, " ").trim();
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function gptExtractNotes(title, prose) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Extract fragrance notes from a perfume description. Return JSON with top_notes, heart_notes, base_notes arrays. Only actual scent ingredients — no adjectives, no brand names. Use common perfumery note names. If top/heart/base groups are unclear, distribute by typical volatility order." },
        { role: "user", content: `Perfume: "${title}"\n\nText:\n${prose.slice(0, 1200)}` },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json();
  const p = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  return {
    top_notes: Array.isArray(p.top_notes) ? p.top_notes : [],
    heart_notes: Array.isArray(p.heart_notes) ? p.heart_notes : [],
    base_notes: Array.isArray(p.base_notes) ? p.base_notes : [],
  };
}

/** Parse structured NOTES block: "NOTESTop: X, YHeart: A, BBase: C, D" or "NOTES\nX, Y, Z" */
function parseTLNotes(html) {
  const txt = stripHtml(html);
  const notesIdx = txt.indexOf("NOTES");
  if (notesIdx < 0) return null;
  const notesSection = txt.slice(notesIdx);

  const top = notesSection.match(/Top\s*:\s*([^\n]+?)(?=Heart\s*:|Base\s*:|$)/i);
  const heart = notesSection.match(/Heart\s*:\s*([^\n]+?)(?=Base\s*:|Top\s*:|$)/i);
  const base = notesSection.match(/Base\s*:\s*([^\n]+?)(?=Heart\s*:|Top\s*:|$)/i);

  if (top || heart || base) {
    return {
      top_notes: top ? top[1].split(/[,•]+/).map((s) => s.trim()).filter(Boolean) : [],
      heart_notes: heart ? heart[1].split(/[,•]+/).map((s) => s.trim()).filter(Boolean) : [],
      base_notes: base ? base[1].split(/[,•]+/).map((s) => s.trim()).filter(Boolean) : [],
    };
  }

  // Flat list after NOTES keyword
  const flat = notesSection.replace(/^NOTES\s*/i, "").split(/[,•]+/).map((s) => s.trim()).filter((s) => s && s.length < 40 && !/THE FRAGRANCE|NOTES|http/i.test(s));
  if (flat.length > 0) return { top_notes: flat, heart_notes: [], base_notes: [] };
  return null;
}

/** Parse Snif "SMELLS LIKE: x • y • z" */
function parseSnifNotes(html) {
  const txt = stripHtml(html);
  const m = txt.match(/SMELLS\s+LIKE[:\s]+([^\n]+)/i);
  if (!m) return null;
  const notes = m[1].split(/[•,]+/).map((s) => s.trim()).filter(Boolean);
  return { top_notes: notes, heart_notes: [], base_notes: [] };
}

/** Parse "Head/Top Notes: X, Y\nHeart Notes: A, B\nBase Notes: C, D" from product page HTML */
function parseBTSOPageNotes(html) {
  const top = html.match(/(?:Head|Top)\s*Notes?\s*(?:<[^>]+>)*\s*([^<]{5,200})/i);
  const heart = html.match(/Heart\s*Notes?\s*(?:<[^>]+>)*\s*([^<]{5,200})/i);
  const base = html.match(/Base\s*Notes?\s*(?:<[^>]+>)*\s*([^<]{5,200})/i);
  if (!top && !heart && !base) return null;
  const clean = (m) => m ? stripHtml(m[1]).split(/[,]+/).map((s) => s.trim()).filter(Boolean) : [];
  return { top_notes: clean(top), heart_notes: clean(heart), base_notes: clean(base) };
}

/** Parse Skylar "Top notes: X, Y\nMiddle notes: A, B\nBase notes: C, D" from page HTML */
function parseSkylarPageNotes(html) {
  const top = html.match(/Top\s*notes?\s*[:\s]+([^\n<]+)/i);
  const middle = html.match(/Middle\s*notes?\s*[:\s]+([^\n<]+)/i);
  const base = html.match(/Base\s*notes?\s*[:\s]+([^\n<]+)/i);
  if (!top && !middle && !base) return null;
  const clean = (m) => m ? m[1].split(/,/).map((s) => s.trim()).filter(Boolean) : [];
  return { top_notes: clean(top), heart_notes: clean(middle), base_notes: clean(base) };
}

function buildPrices(variants) {
  return variants
    .filter((v) => v.price && parseFloat(v.price) > 0)
    .map((v) => ({ size: v.title.trim(), price_min: parseFloat(v.price), price_max: parseFloat(v.price), currency: "USD" }))
    .filter((x) => !/^(default title|free |sample|byob)/i.test(x.size));
}

async function fetchPage(url) {
  try {
    const r = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

async function upsert(brand, name, notes, image_url, prices, description) {
  const row = { name, brand, top_notes: notes.top_notes, heart_notes: notes.heart_notes, base_notes: notes.base_notes, fragrance_family: [], image_url: image_url || null, prices: prices || [], description: description?.slice(0, 500) || null };
  const { data: ex } = await db.from("perfumes").select("id").ilike("brand", brand).ilike("name", name).limit(1).single();
  if (ex?.id) {
    const { error } = await db.from("perfumes").update(row).eq("id", ex.id);
    if (error) console.error(`  ERR update ${name}: ${error.message}`);
    else process.stdout.write(`  ↑ ${name}\n`);
  } else {
    const { error } = await db.from("perfumes").insert(row);
    if (error) console.error(`  ERR insert ${name}: ${error.message}`);
    else process.stdout.write(`  + ${name}\n`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Product classification ────────────────────────────────────────────────────

const CATEGORY_RULES = [
  { category: "candle",         re: /\b(candle|bougie|vela)\b/i },
  { category: "home_fragrance", re: /\b(diffuser|room spray|reed diffuser|home fragrance|incense|air freshener)\b/i },
  { category: "haircare",       re: /\b(shampoo|conditioner|hair mask|hair oil|hair serum|hair mist|hair spray|hair treatment|hair care|hair perfume|scalp)\b/i },
  { category: "bodycare",       re: /\b(body lotion|body butter|body cream|body wash|body scrub|body oil|body mist|body spray|shower gel|hand cream|hand lotion|hand wash|bath oil|bath salt|bath bomb|body gloss|body bar|massage oil|lip balm|lip care|deodorant|antiperspirant)\b/i },
  { category: "skincare",       re: /\b(serum|moisturizer|moisturiser|face cream|face oil|face wash|cleanser|toner|essence|eye cream|eye gel|sunscreen|spf|retinol|vitamin c|hyaluronic|niacinamide|exfoliant|exfoliator|peel|mask|face mask|sheet mask|mist|facial|primer|foundation|skincare)\b/i },
];

/**
 * Classify a product into a beauty category.
 * Returns { category, subcategory } or null if it's a fragrance.
 */
function classifyProduct(title, productType, bodyHtml) {
  const hay = `${title} ${productType} ${stripHtml(bodyHtml || "").slice(0, 400)}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    const m = hay.match(rule.re);
    if (m) return { category: rule.category, subcategory: m[0].trim().toLowerCase() };
  }
  return null; // treat as fragrance
}

// ── Beauty product upsert ─────────────────────────────────────────────────────

async function upsertBeauty(brand, name, category, subcategory, description, key_ingredients, scent_notes, image_url, prices, source_url) {
  const row = {
    name, brand, category, subcategory: subcategory || null,
    description: description?.slice(0, 500) || null,
    key_ingredients: key_ingredients || [],
    scent_notes: scent_notes || [],
    image_url: image_url || null,
    prices: prices || [],
    source_url: source_url || null,
  };
  const { data: ex } = await db.from("beauty_products").select("id").ilike("brand", brand).ilike("name", name).limit(1).single();
  if (ex?.id) {
    const { error } = await db.from("beauty_products").update(row).eq("id", ex.id);
    if (error) console.error(`  ERR beauty update ${name}: ${error.message}`);
    else process.stdout.write(`  ↑ [beauty:${category}] ${name}\n`);
  } else {
    const { error } = await db.from("beauty_products").insert(row);
    if (error) console.error(`  ERR beauty insert ${name}: ${error.message}`);
    else process.stdout.write(`  + [beauty:${category}] ${name}\n`);
  }
}

// ── Fetch all Shopify products ─────────────────────────────────────────────────

async function fetchShopifyAll(domain) {
  const all = [];
  for (let page = 1; ; page++) {
    try {
      const r = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10000) });
      if (!r.ok) break;
      const { products } = await r.json();
      if (!products || products.length === 0) break;
      all.push(...products);
      if (products.length < 250) break;
    } catch { break; }
  }
  return all;
}

// ══════════════════════════════════════════════════════════════════════════════
//  1. HOUSE OF BŌ
// ══════════════════════════════════════════════════════════════════════════════

async function scrapeHouseOfBo() {
  console.log("\n═══ House of Bō ═══");
  const products = await fetchShopifyAll("houseofbo.co");
  const frags = products.filter((p) => p.product_type === "PARFUM");
  console.log(`${frags.length} PARFUM products`);

  // Deduplicate by name (keep first — prefer 75ml over 40ml for prices)
  const seen = new Set();
  const unique = frags.filter((p) => {
    const key = p.title.replace(/\s+\d+ml$/i, "").trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const p of unique) {
    const name = decodeEntities(p.title.replace(/\s+\d+ml$/i, "").trim());
    const image_url = p.images?.[0]?.src ?? null;
    const prices = buildPrices(p.variants ?? []);

    // Fetch product page HTML for notes (body_html is empty in products.json)
    const html = await fetchPage(`https://houseofbo.co/products/${p.handle}`);
    let notes = { top_notes: [], heart_notes: [], base_notes: [] };
    let description = null;

    if (html) {
      // Collect prose paragraphs that look like scent descriptions
      const ps = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gis)].map((m) => stripHtml(m[1])).filter((t) => t.length > 30 && !/shipping|privacy|cookie|free|cart|subscribe|©/i.test(t));
      const prose = ps.slice(0, 8).join(" ");
      description = ps[0] || null;
      if (prose.length > 40) {
        notes = await gptExtractNotes(name, prose);
      }
    }

    process.stdout.write(`  ${name}`);
    await upsert("House of Bō", name, notes, image_url, prices, description);
    await sleep(300);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  2. SNIF (including Slice Society)
// ══════════════════════════════════════════════════════════════════════════════

async function scrapeSnif() {
  console.log("\n═══ Snif ═══");
  const products = await fetchShopifyAll("snif.co");

  // Skip non-fragrance / non-beauty products
  const SKIP_TITLE = /\b(bundle|gift card|discovery set|laundry|detergent|scent booster|everything wash|votive set|starter pack|tote bag|tote|sweatshirt|mini case|reusable|sample set|travel set|clothing|apparel)\b/i;
  const relevant = products.filter((p) =>
    !SKIP_TITLE.test(p.title) &&
    p.variants?.some((v) => parseFloat(v.price) > 5)
  );

  // Deduplicate by normalized name
  const seen = new Set();
  const unique = relevant.filter((p) => {
    const key = p.title.replace(/\s*[-–]\s*.*(?:fragrance|cologne)$/i, "").trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`${unique.length} products to classify`);

  for (const p of unique) {
    const rawName = decodeEntities(p.title.replace(/\s*[-–]\s*[A-Z\s]+(?:FRAGRANCE|COLOGNE)$/i, "").trim());
    const image_url = p.images?.[0]?.src ?? null;
    const prices = buildPrices(p.variants ?? []);
    const html = p.body_html ?? "";
    const prose = stripHtml(html);

    // Classify: fragrance or beauty product?
    const beauty = classifyProduct(rawName, p.product_type, html);
    if (beauty) {
      // Scented body products still get scent_notes extracted
      const scent_notes = prose.length > 20 ? (parseSnifNotes(html)?.top_notes ?? []) : [];
      await upsertBeauty("Snif", rawName, beauty.category, beauty.subcategory, prose.slice(0, 400) || null, [], scent_notes, image_url, prices, `https://snif.co/products/${p.handle}`);
      await sleep(150);
      continue;
    }

    // Fragrance path
    let notes = parseSnifNotes(html);
    if (!notes || notes.top_notes.length === 0) {
      notes = prose.length > 30 ? await gptExtractNotes(rawName, prose) : { top_notes: [], heart_notes: [], base_notes: [] };
    } else {
      // Structure the flat SMELLS LIKE list with GPT
      notes = await gptExtractNotes(rawName, `Notes: ${notes.top_notes.join(", ")}. ${prose.slice(0, 400)}`);
    }

    const description = prose.split(/SMELLS LIKE/i)[0].trim().slice(0, 500) || null;
    await upsert("Snif", rawName, notes, image_url, prices, description);
    await sleep(200);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  3. MATIÈRE PREMIÈRE
// ══════════════════════════════════════════════════════════════════════════════

async function scrapeMatierePremiereUS() {
  console.log("\n═══ Matière Première ═══");
  const products = await fetchShopifyAll("matiere-premiere.us");
  const frags = products.filter((p) => p.product_type === "Perfume");
  console.log(`${frags.length} Perfume products`);

  for (const p of frags) {
    const name = decodeEntities(p.title.trim());
    const image_url = p.images?.[0]?.src ?? null;
    const prices = buildPrices(p.variants ?? []);
    const prose = stripHtml(p.body_html ?? "");
    const description = prose.slice(0, 400) || null;

    let notes = { top_notes: [], heart_notes: [], base_notes: [] };
    if (prose.length > 30) {
      notes = await gptExtractNotes(name, prose);
    }

    await upsert("Matière Première", name, notes, image_url, prices, description);
    await sleep(200);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  4. BORN TO STAND OUT
// ══════════════════════════════════════════════════════════════════════════════

async function scrapeBornToStandOut() {
  console.log("\n═══ Born to Stand Out ═══");
  const products = await fetchShopifyAll("borntostandout.com");

  // Keep products with ML variants (actual fragrances, not coffee/gift cards)
  const frags = products.filter((p) =>
    p.product_type !== "LDT Gift Option" &&
    p.variants?.some((v) => /\d+\s*(?:ML|ml)/.test(v.title)) &&
    !/discovery set|gift/i.test(p.title)
  );

  // Deduplicate by base name (strip size suffix like "350ML", "50ML" from title if it's just a size variant)
  const seen = new Set();
  const unique = frags.filter((p) => {
    const key = p.title.replace(/\s+\d+ML$/i, "").trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`${unique.length} fragrance products`);

  for (const p of unique) {
    const name = decodeEntities(p.title.replace(/\s+\d+ML$/i, "").trim());
    const image_url = p.images?.[0]?.src ?? null;
    const prices = buildPrices(p.variants ?? []);

    // Classify before fetching page
    const bodyHtmlFromList = p.body_html ?? "";
    const beauty = classifyProduct(name, p.product_type, bodyHtmlFromList);
    if (beauty) {
      // Route to beauty_products without page fetch
      const prose = stripHtml(bodyHtmlFromList);
      await upsertBeauty("Born to Stand Out", name, beauty.category, beauty.subcategory, prose.slice(0, 400) || null, [], [], image_url, prices, `https://borntostandout.com/products/${p.handle}`);
      await sleep(200);
      continue;
    }

    // Fetch product page for structured notes
    const html = await fetchPage(`https://borntostandout.com/products/${p.handle}`);
    let notes = { top_notes: [], heart_notes: [], base_notes: [] };
    let description = null;

    if (html) {
      const pageNotes = parseBTSOPageNotes(html);
      if (pageNotes && (pageNotes.top_notes.length + pageNotes.heart_notes.length + pageNotes.base_notes.length) > 0) {
        notes = pageNotes;
      }
      const ps = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gis)].map((m) => stripHtml(m[1])).filter((t) => t.length > 20 && !/shipping|cart|privacy/i.test(t));
      description = ps[0] || null;
      if (notes.top_notes.length === 0) {
        const prose = ps.join(" ");
        if (prose.length > 30) notes = await gptExtractNotes(name, prose);
      }
    }

    await upsert("Born to Stand Out", name, notes, image_url, prices, description);
    await sleep(500);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  5. SKYLAR
// ══════════════════════════════════════════════════════════════════════════════

async function scrapeSkylar() {
  console.log("\n═══ Skylar ═══");

  const sitemapXml = await fetchPage("https://skylar.com/sitemap/products/1.xml");
  if (!sitemapXml) { console.error("  Could not fetch Skylar sitemap"); return; }

  const allUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const fragUrls = allUrls.filter((u) => !/(rollerball|mist|sample|scent-club|duo|discovery|travel|gift|dummy|double-dates|keychain|travel-spray)/i.test(u));
  console.log(`${fragUrls.length} fragrance URLs`);

  for (const url of fragUrls) {
    const html = await fetchPage(url);
    if (!html) continue;

    // Extract product name from title tag or og:title
    const titleM = html.match(/<title[^>]*>([^<|–-]+)/i);
    const ogTitleM = html.match(/og:title[^>]+content="([^"]+)"/i);
    const rawName = (ogTitleM?.[1] || titleM?.[1] || url.split("/").pop().replace(/-/g, " ")).trim();
    // Strip site suffix, subtitle like ": X Scent", " Rollerball", size+type like "50ml Perfume"
    const name = decodeEntities(
      rawName
        .replace(/\s*[|\-–].*$/, "")
        .replace(/:\s+.*(?:scent|fragrance|perfume)\s*$/i, "")
        .replace(/\s+rollerball\b/i, "")
        .replace(/\s+\d+\s*ml\s+(?:perfume|fragrance|edp|eau de parfum)\b/i, "")
        .trim()
    );

    // Extract image from og:image or JSON-LD
    const imgM = html.match(/og:image[^>]+content="([^"]+)"/i) || html.match(/"image"\s*:\s*\["([^"]+)"\]/);
    const image_url = imgM?.[1] ?? null;

    // Parse notes
    let notes = parseSkylarPageNotes(html);
    if (!notes) {
      const ps = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gis)].map((m) => stripHtml(m[1])).filter((t) => t.length > 20);
      const prose = ps.join(" ");
      if (prose.length > 30) notes = await gptExtractNotes(name, prose);
      else notes = { top_notes: [], heart_notes: [], base_notes: [] };
    }

    // Extract prices from Shopify JSON-LD
    const priceM = html.match(/"price"\s*:\s*"([\d.]+)"/g);
    const prices = priceM ? [{ size: "50ml", price_min: parseFloat(priceM[0].match(/([\d.]+)/)[1]), price_max: parseFloat(priceM[0].match(/([\d.]+)/)[1]), currency: "USD" }] : [];

    const descM = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gis)].map((m) => stripHtml(m[1])).find((t) => t.length > 40 && !/shipping|cart|sign/i.test(t));

    await upsert("Skylar", name, notes, image_url, prices, descM || null);
    await sleep(500);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  6. TWISTED LILY (multi-brand retailer — image update logic)
// ══════════════════════════════════════════════════════════════════════════════

async function scrapeTwistedLily() {
  console.log("\n═══ Twisted Lily ═══");

  const products = await fetchShopifyAll("twistedlily.com");
  const frags = products.filter((p) => p.product_type === "Fragrance" && p.vendor && !/gift|bogos|dummy/i.test(p.title));
  console.log(`${frags.length} Fragrance products`);

  for (const p of frags) {
    const brand = decodeEntities(p.vendor.trim());
    const name = decodeEntities(p.title.trim());
    const tlImage = p.images?.[0]?.src ?? null;
    const prices = buildPrices(p.variants ?? []);
    const html = p.body_html ?? "";
    const prose = stripHtml(html);

    // Parse notes from NOTES section first
    let notes = parseTLNotes(html);
    // Supplement with description — extract all mentioned notes from prose description
    const descSection = prose.replace(/NOTES.*$/is, "").trim();
    if (descSection.length > 40) {
      // Merge: use GPT on the full text to supplement missing tiers
      if (!notes || (notes.top_notes.length === 0 && notes.heart_notes.length === 0 && notes.base_notes.length === 0)) {
        notes = await gptExtractNotes(name, prose);
      } else {
        // Enrich: GPT on full text but keep existing structured notes as base
        const enriched = await gptExtractNotes(name, `${prose}`);
        const merge = (a, b) => [...new Set([...a, ...b.filter((n) => !a.some((x) => x.toLowerCase() === n.toLowerCase()))])];
        notes = {
          top_notes: merge(notes.top_notes, enriched.top_notes),
          heart_notes: merge(notes.heart_notes, enriched.heart_notes),
          base_notes: merge(notes.base_notes, enriched.base_notes),
        };
      }
    }
    if (!notes) notes = { top_notes: [], heart_notes: [], base_notes: [] };

    const description = prose.replace(/^THE FRAGRANCE\s*/i, "").split(/\n?NOTES\b/i)[0].trim().slice(0, 500) || null;

    // Check if this perfume already exists in DB
    const { data: existing } = await db.from("perfumes")
      .select("id,image_url")
      .ilike("brand", brand)
      .ilike("name", name)
      .limit(1)
      .single();

    if (existing?.id) {
      // Decide on image update: update if null, or if URL is not from the brand's own domain
      const currentImg = existing.image_url || null;
      const isBrandDirect = currentImg && isBrandDirectImage(currentImg, brand);
      const updateImage = !currentImg || !isBrandDirect;

      const patch = {
        top_notes: notes.top_notes,
        heart_notes: notes.heart_notes,
        base_notes: notes.base_notes,
        ...(updateImage && tlImage ? { image_url: tlImage } : {}),
        ...(prices.length > 0 ? { prices } : {}),
        ...(description ? { description } : {}),
      };
      const { error } = await db.from("perfumes").update(patch).eq("id", existing.id);
      if (error) console.error(`  ERR update ${brand} - ${name}: ${error.message}`);
      else process.stdout.write(`  ↑ ${brand} - ${name}${updateImage && tlImage ? " [img updated]" : ""}\n`);
    } else {
      // New entry
      const row = { name, brand, top_notes: notes.top_notes, heart_notes: notes.heart_notes, base_notes: notes.base_notes, fragrance_family: [], image_url: tlImage, prices, description };
      const { error } = await db.from("perfumes").insert(row);
      if (error) console.error(`  ERR insert ${brand} - ${name}: ${error.message}`);
      else process.stdout.write(`  + ${brand} - ${name}\n`);
    }

    await sleep(150);
  }
}

/** Returns true if the image URL appears to come from the brand's own domain */
function isBrandDirectImage(imageUrl, brand) {
  if (!imageUrl) return false;
  try {
    const url = new URL(imageUrl.startsWith("//") ? `https:${imageUrl}` : imageUrl);
    const host = url.hostname.toLowerCase();
    // If it's a Shopify CDN, check if the path suggests a brand Shopify store (not TL's store 0259/2797/4970)
    if (host.includes("cdn.shopify.com")) {
      // TL's own CDN uses path /s/files/1/0259/2797/4970/
      return !host.includes("0259/2797/4970") && !imageUrl.includes("/0259/2797/4970/");
    }
    // Non-Shopify — check if brand name words appear in hostname
    const brandWords = brand.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return brandWords.some((w) => host.includes(w));
  } catch { return false; }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const target = process.argv[2] || "all";

  if (target === "all" || target === "houseofbo") await scrapeHouseOfBo();
  if (target === "all" || target === "snif") await scrapeSnif();
  if (target === "all" || target === "matiere") await scrapeMatierePremiereUS();
  if (target === "all" || target === "btso") await scrapeBornToStandOut();
  if (target === "all" || target === "skylar") await scrapeSkylar();
  if (target === "all" || target === "twistedlily") await scrapeTwistedLily();

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
