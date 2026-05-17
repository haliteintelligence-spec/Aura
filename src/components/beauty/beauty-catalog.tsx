"use client";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, proxyImageUrl } from "@/lib/utils";
import type { BeautyProduct, BeautyCategory } from "@/lib/types";
import { Search, Loader2, Sparkles, ExternalLink } from "lucide-react";
import Image from "next/image";

const CATEGORIES: Array<{ value: BeautyCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "skincare", label: "Skincare" },
  { value: "bodycare", label: "Body" },
  { value: "haircare", label: "Hair" },
  { value: "candle", label: "Candles" },
  { value: "home_fragrance", label: "Home" },
];

const CATEGORY_COLORS: Record<string, string> = {
  skincare: "bg-rose-50 text-rose-700 border-rose-200",
  bodycare: "bg-amber-50 text-amber-700 border-amber-200",
  haircare: "bg-violet-50 text-violet-700 border-violet-200",
  candle: "bg-orange-50 text-orange-700 border-orange-200",
  home_fragrance: "bg-teal-50 text-teal-700 border-teal-200",
  other: "bg-muted text-muted-foreground border-border",
};

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    skincare: "Skincare",
    bodycare: "Body Care",
    haircare: "Hair Care",
    candle: "Candle",
    home_fragrance: "Home",
    other: "Other",
  };
  return map[cat] ?? cat;
}

export function BeautyCatalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BeautyCategory | "all">("all");
  const [results, setResults] = useState<BeautyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<BeautyProduct | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function doSearch(q: string, cat: BeautyCategory | "all") {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/beauty/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), category: cat === "all" ? undefined : cat }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val, category), 500);
  }

  function handleCategoryChange(cat: BeautyCategory | "all") {
    setCategory(cat);
    doSearch(query, cat);
  }

  const priceRange = (p: BeautyProduct) => {
    if (!p.prices?.length) return null;
    const mins = p.prices.map((x) => x.price_min).filter(Boolean) as number[];
    const maxs = p.prices.map((x) => x.price_max).filter(Boolean) as number[];
    if (!mins.length) return null;
    const lo = Math.min(...mins);
    const hi = Math.max(...maxs);
    return lo === hi ? `$${lo}` : `$${lo}–$${hi}`;
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="px-4 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search skincare, candles, body care…"
          value={query}
          onChange={handleQueryChange}
          className="pl-9"
        />
      </div>

      {/* Category chips */}
      <div className="px-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => handleCategoryChange(c.value)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0",
              category === c.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12 px-4 text-muted-foreground text-sm">
          No results found for &ldquo;{query}&rdquo;
        </div>
      )}

      {!loading && !searched && (
        <div className="text-center py-16 px-4 text-muted-foreground text-sm space-y-1">
          <Sparkles className="w-6 h-6 mx-auto mb-2 text-primary/50" />
          <p>Search for skincare, candles, body care and more</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="px-4 grid grid-cols-2 gap-3">
          {results.map((product, i) => (
            <button
              key={product.id ?? `${product.brand}||${product.name}||${i}`}
              onClick={() => setSelected(product)}
              className="bg-card border border-border rounded-2xl overflow-hidden text-left hover:border-primary/30 transition-colors"
            >
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {proxyImageUrl(product.image_url) ? (
                  <Image
                    src={proxyImageUrl(product.image_url)!}
                    alt={product.name}
                    width={200}
                    height={200}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <Sparkles className="w-8 h-8 text-muted-foreground/30" />
                )}
              </div>
              <div className="p-2.5 space-y-1">
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.other)}>
                  {categoryLabel(product.category)}
                </span>
                <p className="text-xs text-muted-foreground truncate">{product.brand}</p>
                <p className="text-sm font-medium leading-tight line-clamp-2">{product.name}</p>
                {priceRange(product) && (
                  <p className="text-xs text-primary font-medium">{priceRange(product)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Product detail sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex gap-4 items-start">
                  <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {proxyImageUrl(selected.image_url) ? (
                      <Image
                        src={proxyImageUrl(selected.image_url)!}
                        alt={selected.name}
                        width={80}
                        height={80}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    ) : (
                      <Sparkles className="w-8 h-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", CATEGORY_COLORS[selected.category] ?? CATEGORY_COLORS.other)}>
                      {categoryLabel(selected.category)}{selected.subcategory ? ` · ${selected.subcategory}` : ""}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{selected.brand}</p>
                    <SheetTitle className="font-display text-lg leading-tight mt-0.5">{selected.name}</SheetTitle>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4">
                {selected.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                )}

                {selected.key_ingredients && selected.key_ingredients.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Ingredients</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.key_ingredients.map((ing) => (
                        <Badge key={ing} variant="secondary" className="text-xs">{ing}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selected.scent_notes && selected.scent_notes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scent Notes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.scent_notes.map((n) => (
                        <Badge key={n} variant="outline" className="text-xs">{n}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selected.tags && selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                )}

                {selected.prices && selected.prices.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prices</p>
                    <div className="space-y-1">
                      {selected.prices.map((p) => (
                        <div key={p.size} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{p.size}</span>
                          <span className="font-medium">
                            {p.price_min === p.price_max ? `$${p.price_min}` : `$${p.price_min}–$${p.price_max}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.source_url && (
                  <a
                    href={selected.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on brand site
                  </a>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
