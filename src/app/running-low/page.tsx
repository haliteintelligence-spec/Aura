"use client";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { levelToFraction, proxyImageUrl, SEASONS, FRAGRANCE_FAMILIES } from "@/lib/utils";
import type { CollectionItem } from "@/lib/types";
import { AlertTriangle, Droplets, SlidersHorizontal, ArrowUpDown, Loader2 } from "lucide-react";
import Image from "next/image";

type SortOption = "level_asc" | "brand_asc";

export default function RunningLowPage() {
  const { user } = useUser();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterBrands, setFilterBrands] = useState<string[]>([]);
  const [filterSeasons, setFilterSeasons] = useState<string[]>([]);
  const [filterFamilies, setFilterFamilies] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("level_asc");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("collection_items")
      .select("*, perfume:perfumes(*), user_perfume:user_perfumes(*)")
      .eq("user_id", user.id)
      .eq("collection_type", "closet");
    const all = (data as CollectionItem[]) ?? [];
    setItems(all.filter((i) => levelToFraction(i.estimated_level) <= 0.25));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const allBrands = [...new Set(items.map((i) => (i.perfume ?? i.user_perfume)?.brand).filter(Boolean) as string[])].sort();

  const filtered = items
    .filter((item) => {
      const p = item.perfume ?? item.user_perfume;
      if (filterBrands.length > 0 && !filterBrands.includes(p?.brand ?? "")) return false;
      if (filterSeasons.length > 0 && !filterSeasons.some((s) => item.seasons?.includes(s))) return false;
      if (filterFamilies.length > 0 && !filterFamilies.some((f) => p?.fragrance_family?.includes(f))) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "level_asc") {
        const diff = levelToFraction(a.estimated_level) - levelToFraction(b.estimated_level);
        if (diff !== 0) return diff;
        const nameA = (a.perfume ?? a.user_perfume)?.name ?? "";
        const nameB = (b.perfume ?? b.user_perfume)?.name ?? "";
        return nameA.localeCompare(nameB);
      }
      // brand_asc
      const brandA = (a.perfume ?? a.user_perfume)?.brand ?? "";
      const brandB = (b.perfume ?? b.user_perfume)?.brand ?? "";
      const brandCmp = brandA.localeCompare(brandB);
      if (brandCmp !== 0) return brandCmp;
      return ((a.perfume ?? a.user_perfume)?.name ?? "").localeCompare((b.perfume ?? b.user_perfume)?.name ?? "");
    });

  const activeFilters = filterBrands.length + filterSeasons.length + filterFamilies.length;

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h1 className="font-display text-2xl">Running Low</h1>
          </div>
          <div className="flex gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="h-8 text-xs flex-1 gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="level_asc">Level (lowest first)</SelectItem>
                <SelectItem value="brand_asc">Brand A–Z</SelectItem>
              </SelectContent>
            </Select>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 relative">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
                  {activeFilters > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] rounded-full flex items-center justify-center">
                      {activeFilters}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle className="font-display">Filter</SheetTitle>
                </SheetHeader>
                <div className="space-y-5 pb-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brand</label>
                    <MultiSelect options={allBrands} value={filterBrands} onChange={setFilterBrands} placeholder="All brands…" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Season</label>
                    <MultiSelect options={SEASONS} value={filterSeasons} onChange={setFilterSeasons} placeholder="Any season…" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fragrance Family</label>
                    <MultiSelect options={FRAGRANCE_FAMILIES} value={filterFamilies} onChange={setFilterFamilies} placeholder="Any family…" />
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => { setFilterBrands([]); setFilterSeasons([]); setFilterFamilies([]); }}>
                    Clear All Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {activeFilters > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {filterBrands.map((b) => <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>)}
              {filterSeasons.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
              {filterFamilies.map((f) => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
            </div>
          )}
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center pt-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center pt-16 space-y-2">
              <p className="text-muted-foreground text-sm">
                {items.length === 0 ? "All your bottles are well-stocked" : "No items match your filters"}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">{filtered.length} bottle{filtered.length !== 1 ? "s" : ""} at ¼ or less</p>
              <div className="space-y-3">
                {filtered.map((item) => {
                  const p = item.perfume ?? item.user_perfume;
                  const pct = Math.round(levelToFraction(item.estimated_level) * 100);
                  return (
                    <div key={item.id} className="bg-card border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-plum-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {proxyImageUrl(p?.image_url) ? (
                          <Image src={proxyImageUrl(p!.image_url)!} alt="" width={48} height={48} className="object-contain" unoptimized />
                        ) : (
                          <Droplets className="w-6 h-6 text-plum-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{p?.brand}</p>
                        <p className="text-sm font-medium truncate">{p?.name}</p>
                        <div className="mt-1.5 space-y-0.5">
                          <Progress value={pct} className="h-1.5" />
                          <p className="text-[10px] text-muted-foreground">{item.estimated_level} remaining ({pct}%)</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
