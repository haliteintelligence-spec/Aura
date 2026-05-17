"use client";
import { useState, useEffect, useCallback } from "react";
import { PerfumeCard } from "@/components/perfume/perfume-card";
import { EditItemDialog } from "./edit-item-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { SEASONS, FRAGRANCE_FAMILIES } from "@/lib/utils";
import type { CollectionItem } from "@/lib/types";
import { SlidersHorizontal, Plus, ArrowUpDown, Loader2 } from "lucide-react";
import Link from "next/link";
import type { CollectionType } from "@/lib/utils";

interface CollectionGridProps {
  collectionType: CollectionType;
  title: string;
}

type SortOption = "brand_asc" | "brand_desc" | "rating_desc" | "rating_asc" | "date_desc" | "price_asc" | "price_desc";

export function CollectionGrid({ collectionType, title }: CollectionGridProps) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CollectionItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Filters
  const [filterBrands, setFilterBrands] = useState<string[]>([]);
  const [filterNotes, setFilterNotes] = useState<string[]>([]);
  const [filterSeasons, setFilterSeasons] = useState<string[]>([]);
  const [filterFamilies, setFilterFamilies] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("brand_asc");

  const backfillMissing = useCallback(async (loaded: CollectionItem[]) => {
    const toFill = loaded.filter((i) => {
      const p = i.perfume ?? i.user_perfume;
      return p && (!p.image_url || !p.top_notes?.length);
    });
    if (toFill.length === 0) return;

    const supabase = createClient();
    for (const item of toFill) {
      const p = item.perfume ?? item.user_perfume;
      if (!p) continue;
      try {
        const res = await fetch("/api/perfume/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: p.name, brand: p.brand }),
        });
        if (!res.ok) continue;
        const details = await res.json();

        const updates: Record<string, unknown> = {};
        if (details.image_url && !p.image_url) updates.image_url = details.image_url;
        if (details.top_notes?.length && !p.top_notes?.length) updates.top_notes = details.top_notes;
        if (details.heart_notes?.length && !p.heart_notes?.length) updates.heart_notes = details.heart_notes;
        if (details.base_notes?.length && !p.base_notes?.length) updates.base_notes = details.base_notes;
        if (details.description && !p.description) updates.description = details.description;

        if (Object.keys(updates).length === 0) continue;

        const table = item.user_perfume ? "user_perfumes" : "perfumes";
        await supabase.from(table).update(updates).eq("id", p.id);
        setItems((prev) =>
          prev.map((i) => {
            if (item.user_perfume && i.user_perfume?.id === p.id)
              return { ...i, user_perfume: { ...i.user_perfume!, ...updates } };
            if (item.perfume && i.perfume?.id === p.id)
              return { ...i, perfume: { ...i.perfume!, ...updates } };
            return i;
          })
        );
      } catch { /* ignore per-item errors */ }
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("collection_items")
      .select("*, perfume:perfumes(*), user_perfume:user_perfumes(*)")
      .eq("collection_type", collectionType);
    const loaded = (data as CollectionItem[]) ?? [];
    setItems(loaded);
    setLoading(false);
    backfillMissing(loaded);
  }, [collectionType, backfillMissing]);

  useEffect(() => { load(); }, [load]);

  const allBrands = [...new Set(items.map((i) => (i.perfume ?? i.user_perfume)?.brand).filter(Boolean) as string[])].sort();
  const allNotes = [...new Set(items.flatMap((i) => {
    const p = i.perfume ?? i.user_perfume;
    return [...(p?.top_notes ?? []), ...(p?.heart_notes ?? []), ...(p?.base_notes ?? [])];
  }))].sort();

  const filtered = items
    .filter((item) => {
      const p = item.perfume ?? item.user_perfume;
      if (filterBrands.length > 0 && !filterBrands.includes(p?.brand ?? "")) return false;
      if (filterSeasons.length > 0 && !filterSeasons.some((s) => item.seasons?.includes(s))) return false;
      if (filterFamilies.length > 0 && !filterFamilies.some((f) => p?.fragrance_family?.includes(f))) return false;
      if (filterNotes.length > 0) {
        const itemNotes = [...(p?.top_notes ?? []), ...(p?.heart_notes ?? []), ...(p?.base_notes ?? [])];
        if (!filterNotes.some((n) => itemNotes.includes(n))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case "brand_asc": return ((a.perfume ?? a.user_perfume)?.brand ?? "").localeCompare((b.perfume ?? b.user_perfume)?.brand ?? "");
        case "brand_desc": return ((b.perfume ?? b.user_perfume)?.brand ?? "").localeCompare((a.perfume ?? a.user_perfume)?.brand ?? "");
        case "rating_desc": return (b.rating ?? 0) - (a.rating ?? 0);
        case "rating_asc": return (a.rating ?? 0) - (b.rating ?? 0);
        case "date_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "price_desc":
        case "price_asc": {
          const getMax = (item: CollectionItem) => Math.max(...(item.size_prices?.map((p) => p.price_max ?? 0) ?? [0]));
          return sort === "price_desc" ? getMax(b) - getMax(a) : getMax(a) - getMax(b);
        }
        default: return 0;
      }
    });

  const activeFilters = filterBrands.length + filterNotes.length + filterSeasons.length + filterFamilies.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-2xl">{title}</h1>
          <Link href="/discover">
            <Button size="sm" className="gap-1.5 h-8">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </Link>
        </div>
        <div className="flex gap-2">
          {/* Sort */}
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="h-8 text-xs flex-1 gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="brand_asc">Brand A–Z</SelectItem>
              <SelectItem value="brand_desc">Brand Z–A</SelectItem>
              <SelectItem value="rating_desc">Highest Rated</SelectItem>
              <SelectItem value="rating_asc">Lowest Rated</SelectItem>
              <SelectItem value="date_desc">Recently Added</SelectItem>
              <SelectItem value="price_desc">Price (High)</SelectItem>
              <SelectItem value="price_asc">Price (Low)</SelectItem>
            </SelectContent>
          </Select>

          {/* Filters */}
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
                <SheetTitle className="font-display">Filter Collection</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 pb-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brand</label>
                  <MultiSelect options={allBrands} value={filterBrands} onChange={setFilterBrands} placeholder="All brands…" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
                  <MultiSelect options={allNotes} value={filterNotes} onChange={setFilterNotes} placeholder="Any note…" maxHeight="200px" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Season</label>
                  <MultiSelect options={SEASONS} value={filterSeasons} onChange={setFilterSeasons} placeholder="Any season…" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fragrance Family</label>
                  <MultiSelect options={FRAGRANCE_FAMILIES} value={filterFamilies} onChange={setFilterFamilies} placeholder="Any family…" />
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setFilterBrands([]); setFilterNotes([]); setFilterSeasons([]); setFilterFamilies([]); }}>
                  Clear All Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Active filter pills */}
        {activeFilters > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {filterBrands.map((b) => <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>)}
            {filterNotes.map((n) => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
            {filterSeasons.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
            {filterFamilies.map((f) => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex justify-center pt-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center pt-16 space-y-3">
            <p className="text-muted-foreground text-sm">
              {items.length === 0 ? `Your ${title} is empty` : "No items match your filters"}
            </p>
            {items.length === 0 && (
              <Link href="/discover">
                <Button variant="outline" size="sm">Add your first fragrance</Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">{filtered.length} fragrance{filtered.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((item) => (
                <PerfumeCard
                  key={item.id}
                  item={item}
                  onClick={() => { setSelected(item); setEditOpen(true); }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <EditItemDialog
        item={selected}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
