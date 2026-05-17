/**
 * Scrape every fragrance from each brand's official website.
 * Tries Shopify products.json → WooCommerce REST API → sitemap.
 * Extracts notes from page HTML; GPT fallback when not found on page.
 * Skips perfumes already in 002_seed_perfumes.sql.
 * Writes new inserts to supabase/migrations/004_scraped_brands.sql
 *
 * Run: node scripts/scrape-brands.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const _env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);
const _db = createClient(_env.NEXT_PUBLIC_SUPABASE_URL, _env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const OPENAI_API_KEY = _env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error("OPENAI_API_KEY not set in .env.local"); process.exit(1); }

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Brand list ────────────────────────────────────────────────────────────────

const BRANDS = [
  "Chanel",
  "Christian Dior",
  "Yves Saint Laurent",
  "Guerlain",
  "Hermès",
  "Tom Ford",
  "Creed",
  "Maison Margiela",
  "Jo Malone London",
  "Byredo",
  "Diptyque",
  "Le Labo",
  "Maison Francis Kurkdjian",
  "Amouage",
  "Nishane",
  "Parfums de Marly",
  "Initio Parfums Privés",
  "Xerjoff",
  "Penhaligon's",
  "Kayali",
  "Giorgio Armani",
  "Versace",
  "Prada",
  "Burberry",
  "Viktor & Rolf",
  "Mugler",
  "Jean Paul Gaultier",
  "Lancôme",
  "Givenchy",
  "Bulgari",
  "Acqua di Parma",
  "Montale",
  "Memo Paris",
  "Juliette Has a Gun",
  "Serge Lutens",
  "L'Artisan Parfumeur",
  "Kilian Paris",
  "Paco Rabanne",
  "Carolina Herrera",
  "Marc Jacobs",
  "Narciso Rodriguez",
  "Valentino",
  "Dolce & Gabbana",
  "Frédéric Malle",
  "Comme des Garçons",
  "Histoires de Parfums",
  "Roja Parfums",
  "Atelier Cologne",
  "Etat Libre d'Orange",
  "Nasomatto",
  "Orto Parisi",
  "Tauer Perfumes",
  "Aesop",
  "Regime des Fleurs",
  "DS & Durga",
  "Commodity",
  "Zoologist",
  "Imaginary Authors",
  "Strangers Parfumerie",

  // Designer mainstream
  "Issey Miyake",
  "Kenzo",
  "Hugo Boss",
  "Calvin Klein",
  "Ralph Lauren",
  "DKNY",
  "Michael Kors",
  "Coach",
  "Jimmy Choo",
  "Stella McCartney",
  "Alexander McQueen",
  "Bottega Veneta",
  "Salvatore Ferragamo",
  "Montblanc",
  "Davidoff",
  "Azzaro",
  "Lalique",
  "Lacoste",
  "Diesel",
  "Escada",
  "Chloé",
  "Lolita Lempicka",
  "Nina Ricci",
  "Cacharel",
  "Lanvin",
  "Rochas",
  "Balmain",
  "Elie Saab",
  "Roberto Cavalli",
  "Moschino",
  "Trussardi",
  "Cerruti",
  "Cartier",
  "Van Cleef & Arpels",
  "Chopard",
  "Tiffany & Co",
  "Miu Miu",

  // Niche & artisan
  "Bond No. 9",
  "Clive Christian",
  "Floris London",
  "Santa Maria Novella",
  "Carthusia",
  "Profumum Roma",
  "Laboratorio Olfattivo",
  "The Different Company",
  "Goutal Paris",
  "Caron",
  "Robert Piguet",
  "Vilhelm Parfumerie",
  "Eight & Bob",
  "Molinard",
  "Fragonard",
  "Ormonde Jayne",
  "Miller Harris",
  "Papillon Artisan Perfumes",
  "4160 Tuesdays",
  "Matiere Premiere",
  "Stora Skuggan",
  "Bruno Fazzolari",
  "Heretic Parfum",
  "Ellis Brooklyn",
  "Malin + Goetz",
  "Etro",
  "Bogue Profumo",
  "Fragrance Du Bois",
  "Parfums MDCI",
  "Perris Monte Carlo",
  "Houbigant",
  "Jean Patou",

  // Middle Eastern & Oud
  "Mancera",
  "Al Haramain",
  "Rasasi",
  "Lattafa",
  "Afnan",
  "Swiss Arabian",
  "Ajmal",
  "Arabian Oud",
  "Abdul Samad Al Qurashi",
  "Ard Al Zaafaran",
  "Nabeel",
  "Fragrance World",
];

// ── Load existing perfumes from database (avoid duplicates) ───────────────────

async function loadExisting() {
  const seen = new Set();
  let from = 0;
  while (true) {
    const { data, error } = await _db.from("perfumes").select("name,brand").range(from, from + 999);
    if (error || !data || data.length === 0) break;
    for (const r of data) seen.add(`${r.brand.toLowerCase().trim()}||${r.name.toLowerCase().trim()}`);
    if (data.length < 1000) break;
    from += 1000;
  }
  return seen;
}

// ── GPT: brand domain ─────────────────────────────────────────────────────────

async function gptBrandDomain(brand) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 80,
        messages: [
          { role: "system", content: "Return up to 3 candidate official website domains for the fragrance brand, most likely first, separated by commas. No protocol, no path. Return 'unknown' if not sure." },
          { role: "user", content: `Official website domain(s) for fragrance brand: "${brand}"` },
        ],
      }),
    });
    const json = await res.json();
    const raw = (json.choices?.[0]?.message?.content ?? "").trim().toLowerCase();
    return raw
      .split(/[\s,;|]+/)
      .map((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim())
      .filter((d) => d && d !== "unknown" && d.includes(".") && !d.includes(" "));
  } catch { return []; }
}

// ── GPT: note fallback ────────────────────────────────────────────────────────

async function gptNotes(name, brand) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a fragrance expert. Return the real scent notes for this perfume. Never return empty arrays. Return valid JSON only." },
          { role: "user", content: `"${name}" by ${brand}.\nReturn: {"top_notes":["..."],"heart_notes":["..."],"base_notes":["..."]}` },
        ],
      }),
    });
    const json = await res.json();
    const parsed = JSON.parse(json.choices[0].message.content);
    return {
      top: Array.isArray(parsed.top_notes) ? parsed.top_notes : [],
      heart: Array.isArray(parsed.heart_notes) ? parsed.heart_notes : [],
      base: Array.isArray(parsed.base_notes) ? parsed.base_notes : [],
    };
  } catch { return null; }
}

// ── HTML entity decode ────────────────────────────────────────────────────────

function decodeEntities(s) {
  return (s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

// ── HTML → plain text ─────────────────────────────────────────────────────────

function htmlToText(html) {
  return (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&[a-z#\d]+;/gi, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

// ── Note extraction from text ─────────────────────────────────────────────────

const STOP_WORDS_NOTE = new Set(["and", "the", "a", "an", "of", "from", "with", "in", "notes", "note"]);

function isValidNote(s) {
  const w = s.trim().toLowerCase();
  if (!w || w.length < 2 || w.length > 45) return false;
  if (/\d{4}/.test(w)) return false;
  if (STOP_WORDS_NOTE.has(w)) return false;
  if (/^(of|from|with|in)\s/i.test(w)) return false;
  return true;
}

const NOTE_RE = {
  top: /top\s*notes?\s*[:\-]?\s*([\s\S]+?)(?=(?:heart|middle|base|bottom)\s*notes?|$)/i,
  heart: /(?:heart|middle)\s*notes?\s*[:\-]?\s*([\s\S]+?)(?=(?:top|base|bottom)\s*notes?|$)/i,
  base: /(?:base|bottom)\s*notes?\s*[:\-]?\s*([\s\S]+?)(?=(?:top|heart|middle)\s*notes?|$)/i,
};

function extractNotes(text) {
  const result = { top: [], heart: [], base: [] };
  let found = false;
  for (const [key, re] of Object.entries(NOTE_RE)) {
    const m = re.exec(text);
    if (!m) continue;
    const section = m[1].split(/\s*(?:top|heart|middle|base|bottom)\s*notes?\s*[:\-]?/i)[0];
    const notes = section
      .split(/[,;|•·\n]+|\s+-\s+/)
      .map((s) => s.trim().replace(/[.:]$/, ""))
      .filter(isValidNote);
    if (notes.length > 0) { result[key] = notes; found = true; }
  }
  return found ? result : null;
}

// ── Fragrance product filter ──────────────────────────────────────────────────

const FRAGRANCE_RE = /\b(eau\s*de|edp|edt|parfum|perfume|fragrance|cologne|scent|extrait|toilette|mist|spray)\b/i;
const NON_FRAGRANCE_RE = /\b(candles?|diffusers?|soap|lotion|body\s*wash|shampoo|conditioner|moisturizers?|creams?|lip\s+(?:balm|care|gloss)|nail|hair\s*oil|room\s*spray|incense|reed\s*diffuser|gift\s*set|travel\s*size|hand\s*wash|body\s*lotion)\b/i;

const BEAUTY_CATEGORY_RULES = [
  { category: "candle",         re: /\b(candles?|bougie|vela)\b/i },
  { category: "home_fragrance", re: /\b(diffusers?|room\s*spray|reed\s*diffuser|home\s*fragrance|incense|air\s*freshener)\b/i },
  { category: "haircare",       re: /\b(shampoo|conditioner|hair\s*mask|hair\s*oil|hair\s*serum|hair\s*mist|hair\s*spray|hair\s*care|scalp)\b/i },
  { category: "bodycare",       re: /\b(body\s*lotion|body\s*butter|body\s*cream|body\s*wash|body\s*scrub|body\s*oil|body\s*mist|body\s*spray|shower\s*gel|hand\s*cream|hand\s*lotion|hand\s*wash|bath\s*oil|bath\s*salt|bath\s*bomb|body\s*gloss|body\s*bar|lip\s+(?:balm|care|gloss)|massage\s*oil|deodorant|soap|lotion)\b/i },
  { category: "skincare",       re: /\b(serum|moisturizer|moisturiser|face\s*cream|face\s*oil|face\s*wash|cleanser|toner|essence|eye\s*cream|sunscreen|spf|retinol|hyaluronic|niacinamide|exfoliant|face\s*mask|sheet\s*mask|facial|skincare|nail)\b/i },
];

/**
 * Returns beauty category string if non-fragrance, null if it's a fragrance.
 */
function classifyBeauty(title, body) {
  const hay = `${title} ${(body ?? "").slice(0, 400)}`.toLowerCase();
  for (const rule of BEAUTY_CATEGORY_RULES) {
    const m = hay.match(rule.re);
    if (m) return { category: rule.category, subcategory: m[0].trim().toLowerCase() };
  }
  return null;
}

function isFragranceProduct(title, body) {
  if (NON_FRAGRANCE_RE.test(title)) return false;
  return FRAGRANCE_RE.test(title) || FRAGRANCE_RE.test((body ?? "").slice(0, 800));
}

// ── Shopify catalog ───────────────────────────────────────────────────────────

async function getShopifyProducts(domain) {
  const all = [];
  let page = 1;
  while (true) {
    try {
      const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
        headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) break;
      const json = await res.json();
      const products = json.products ?? [];
      if (products.length === 0) break;
      all.push(...products);
      if (products.length < 250) break;
      page++;
      await new Promise((r) => setTimeout(r, 400));
    } catch { break; }
  }
  return all;
}

// ── WooCommerce public store API ──────────────────────────────────────────────

async function getWooProducts(domain) {
  const all = [];
  let page = 1;
  while (true) {
    try {
      const res = await fetch(`https://${domain}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, {
        headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) break;
      const json = await res.json();
      if (!Array.isArray(json) || json.length === 0) break;
      all.push(...json);
      if (json.length < 100) break;
      page++;
      await new Promise((r) => setTimeout(r, 400));
    } catch { break; }
  }
  return all;
}

// ── Sitemap product URL discovery ─────────────────────────────────────────────

async function getSitemapProductUrls(domain) {
  const urls = [];
  const sitemapPaths = ["/sitemap.xml", "/sitemap_index.xml", "/product-sitemap.xml"];
  for (const sp of sitemapPaths) {
    try {
      const res = await fetch(`https://${domain}${sp}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const xml = await res.text();

      // Nested sitemap index → find product sub-sitemaps
      const subSitemaps = [...xml.matchAll(/<loc>(https?:\/\/[^<]+(?:product|catalog|fragrances?)[^<]*\.xml[^<]*)<\/loc>/gi)].map((m) => m[1]);
      for (const sub of subSitemaps.slice(0, 5)) {
        try {
          const subRes = await fetch(sub, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
          if (!subRes.ok) continue;
          const subXml = await subRes.text();
          [...subXml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/gi)]
            .map((m) => m[1])
            .filter((u) => /\/(?:product[s]?|fragrance[s]?|perfume[s]?|p)\//i.test(u))
            .forEach((u) => urls.push(u));
        } catch { continue; }
      }

      // Direct product URLs
      [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/gi)]
        .map((m) => m[1])
        .filter((u) => /\/(?:product[s]?|fragrance[s]?|perfume[s]?|p)\//i.test(u))
        .forEach((u) => urls.push(u));

      if (urls.length > 0) break;
    } catch { continue; }
  }
  return [...new Set(urls)];
}

// ── Fetch product page and extract data ───────────────────────────────────────

async function scrapeProductPage(url) {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const html = await res.text();
    const nameMatch =
      html.match(/<h1[^>]*class="[^"]*(?:product|title)[^"]*"[^>]*>([^<]+)<\/h1>/i) ??
      html.match(/<h1[^>]*>([^<]{3,80})<\/h1>/i);
    const name = nameMatch ? nameMatch[1].trim() : null;
    if (!name) return null;
    const imgMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;
    const text = htmlToText(html.slice(0, 80000));
    const notes = extractNotes(text);
    return { name, imageUrl, notes };
  } catch { return null; }
}

// ── SQL helpers ───────────────────────────────────────────────────────────────

function escSql(s) {
  if (s == null) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

function pgArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "'{}'";
  const items = arr.map((s) => `"${String(s).replace(/"/g, '\\"')}"`).join(",");
  return `'{${items}}'`;
}

// ── Process one brand ─────────────────────────────────────────────────────────

async function processBrand(brand, existing) {
  process.stdout.write(`\n── ${brand} ──\n`);

  const domains = await gptBrandDomain(brand);
  if (domains.length === 0) { console.log("  no domain"); return []; }

  let domain = null;
  let shopifyProducts = [];
  let wooProducts = [];

  for (const d of domains) {
    process.stdout.write(`  trying ${d}... `);

    // Shopify?
    const sp = await getShopifyProducts(d);
    if (sp.length > 0) {
      console.log(`Shopify ✓ (${sp.length} products)`);
      domain = d; shopifyProducts = sp; break;
    }

    // WooCommerce?
    const wp = await getWooProducts(d);
    if (wp.length > 0) {
      console.log(`WooCommerce ✓ (${wp.length} products)`);
      domain = d; wooProducts = wp; break;
    }

    console.log("not found");
  }

  const results = [];
  const beautyResults = []; // non-fragrance products → beauty_products table

  // ── Shopify path ──────────────────────────────────────────────────────────

  if (shopifyProducts.length > 0) {
    for (const p of shopifyProducts) {
      const rawName = decodeEntities(p.title?.trim());
      if (!rawName) continue;
      const key = `${brand.toLowerCase()}||${rawName.toLowerCase()}`;
      if (existing.has(key)) continue;

      if (!isFragranceProduct(rawName, p.body_html)) {
        // Check if it's a classifiable beauty product
        const bc = classifyBeauty(rawName, p.body_html);
        if (bc) {
          const imageUrl = p.images?.[0]?.src?.split("?")[0] ?? null;
          const prices = (p.variants ?? []).filter((v) => parseFloat(v.price) > 0).map((v) => ({ size: v.title, price_min: parseFloat(v.price), price_max: parseFloat(v.price), currency: "USD" }));
          beautyResults.push({ name: rawName, brand, category: bc.category, subcategory: bc.subcategory, image_url: imageUrl, prices });
        }
        continue;
      }

      const text = htmlToText(p.body_html);
      let notes = extractNotes(text);
      const source = notes ? "page" : "gpt";
      if (!notes) notes = await gptNotes(rawName, brand);

      const imageUrl = p.images?.[0]?.src?.split("?")[0] ?? null;
      console.log(`  + ${rawName} [${source}]`);
      results.push({ name: rawName, brand, image_url: imageUrl, top_notes: notes?.top ?? [], heart_notes: notes?.heart ?? [], base_notes: notes?.base ?? [] });
      existing.add(key);
    }
    return { fragrances: results, beauty: beautyResults };
  }

  // ── WooCommerce path ──────────────────────────────────────────────────────

  if (wooProducts.length > 0) {
    for (const p of wooProducts) {
      const rawName = decodeEntities((p.name ?? p.title ?? "").trim());
      if (!rawName) continue;
      const key = `${brand.toLowerCase()}||${rawName.toLowerCase()}`;
      if (existing.has(key)) continue;

      if (!isFragranceProduct(rawName, p.description ?? p.short_description ?? "")) {
        const bc = classifyBeauty(rawName, p.description ?? "");
        if (bc) {
          const imageUrl = p.images?.[0]?.src ?? null;
          beautyResults.push({ name: rawName, brand, category: bc.category, subcategory: bc.subcategory, image_url: imageUrl, prices: [] });
        }
        continue;
      }

      const text = htmlToText(p.description ?? p.short_description ?? "");
      let notes = extractNotes(text);
      const source = notes ? "page" : "gpt";
      if (!notes) notes = await gptNotes(rawName, brand);

      const imageUrl = p.images?.[0]?.src ?? null;
      console.log(`  + ${rawName} [${source}]`);
      results.push({ name: rawName, brand, image_url: imageUrl, top_notes: notes?.top ?? [], heart_notes: notes?.heart ?? [], base_notes: notes?.base ?? [] });
      existing.add(key);
    }
    return { fragrances: results, beauty: beautyResults };
  }

  // ── Sitemap fallback ──────────────────────────────────────────────────────

  if (!domain) {
    // No domain validated yet — try first candidate
    domain = domains[0] ?? null;
  }
  if (!domain) return [];

  process.stdout.write(`  → sitemap... `);
  const urls = await getSitemapProductUrls(domain);
  console.log(`${urls.length} product URLs`);

  for (const url of urls.slice(0, 150)) {
    const data = await scrapeProductPage(url);
    if (!data?.name) continue;
    const key = `${brand.toLowerCase()}||${data.name.toLowerCase()}`;
    if (existing.has(key)) continue;

    let notes = data.notes;
    const source = notes ? "page" : "gpt";
    if (!notes) notes = await gptNotes(data.name, brand);

    console.log(`  + ${data.name} [${source}]`);
    results.push({ name: data.name, brand, image_url: data.imageUrl, top_notes: notes?.top ?? [], heart_notes: notes?.heart ?? [], base_notes: notes?.base ?? [] });
    existing.add(key);
    await new Promise((r) => setTimeout(r, 250));
  }

  return { fragrances: results, beauty: beautyResults };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const existing = await loadExisting();
  console.log(`Loaded ${existing.size} existing perfumes from database\n`);

  const all = [];

  for (const brand of BRANDS) {
    try {
      const { fragrances: found, beauty: beautyFound } = await processBrand(brand, existing);
      all.push(...found);
      console.log(`  → ${found.length} new perfumes, ${beautyFound.length} beauty products for ${brand}`);

      // Insert fragrances
      if (found.length > 0) {
        const { error } = await _db.from("perfumes").insert(
          found.map((p) => ({ name: p.name, brand: p.brand, top_notes: p.top_notes, heart_notes: p.heart_notes, base_notes: p.base_notes, image_url: p.image_url, fragrance_family: [], prices: [] })),
          { onConflict: "name,brand", ignoreDuplicates: true }
        );
        if (error) console.log(`  DB insert error: ${error.message}`);
        else console.log(`  ✓ Inserted ${found.length} into database`);
      }

      // Insert beauty products
      if (beautyFound.length > 0) {
        const { error: bErr } = await _db.from("beauty_products").insert(
          beautyFound.map((p) => ({ name: p.name, brand: p.brand, category: p.category, subcategory: p.subcategory || null, image_url: p.image_url || null, prices: p.prices || [] })),
          { onConflict: "brand,name", ignoreDuplicates: true }
        );
        if (bErr) console.log(`  Beauty insert error: ${bErr.message}`);
        else console.log(`  ✓ Inserted ${beautyFound.length} beauty products`);
      }
    } catch (e) {
      console.log(`  ERROR for ${brand}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n── Final count ──────────────────────────`);
  console.log(`Total new perfumes scraped: ${all.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
