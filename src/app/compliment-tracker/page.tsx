"use client";
import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PerfumeSelect } from "@/components/ui/perfume-select";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { cn, proxyImageUrl } from "@/lib/utils";
import type { CollectionItem, ComplimentEntry } from "@/lib/types";
import { MessageCircleHeart, Plus, Loader2, Droplets, Trash2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { format } from "date-fns";

interface ComplimentGroup {
  key: string;
  names: string[];
  imageUrl?: string;
  brand?: string;
  count: number;
  isCombo: boolean;
  sourceIds: string[]; // latest set of collection_item_ids for deletion ref
}

export default function ComplimentTrackerPage() {
  const { user } = useUser();
  const [groups, setGroups] = useState<ComplimentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [closetItems, setClosetItems] = useState<CollectionItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addIds, setAddIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();

      // Load closet items for id→name/image mapping and manual entry selector
      const { data: items } = await supabase
        .from("collection_items")
        .select("*, perfume:perfumes(*)")
        .eq("user_id", user.id)
        .eq("collection_type", "closet");
      const closet = (items as CollectionItem[]) ?? [];
      setClosetItems(closet);

      const idToItem = Object.fromEntries(closet.map((i) => [i.id, i]));

      // Journal-derived compliments
      const { data: logs } = await supabase
        .from("scent_logs")
        .select("id, collection_item_ids")
        .eq("user_id", user.id)
        .eq("got_compliment", true);

      // Manual compliment entries
      const { data: manual } = await supabase
        .from("compliment_entries")
        .select("*")
        .eq("user_id", user.id);

      // Build aggregation map: sorted-name-key → count
      const countMap = new Map<string, ComplimentGroup>();

      function upsertGroup(names: string[], itemIds: string[]) {
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        const key = sorted.join(" + ");
        const existing = countMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          // Get image + brand from first item that matches
          const firstId = itemIds[0];
          const firstItem = firstId ? idToItem[firstId] : undefined;
          countMap.set(key, {
            key,
            names: sorted,
            imageUrl: firstItem?.perfume?.image_url ?? undefined,
            brand: firstItem?.perfume?.brand,
            count: 1,
            isCombo: sorted.length > 1,
            sourceIds: itemIds,
          });
        }
      }

      // Process journal logs
      for (const log of logs ?? []) {
        const ids = (log.collection_item_ids as string[]) ?? [];
        const names = ids
          .map((id) => idToItem[id]?.perfume?.name)
          .filter(Boolean) as string[];
        if (names.length > 0) upsertGroup(names, ids);
      }

      // Process manual entries
      for (const entry of (manual as ComplimentEntry[]) ?? []) {
        const names = entry.perfume_names ?? [];
        if (names.length > 0) upsertGroup(names, entry.collection_item_ids);
      }

      const sorted = [...countMap.values()].sort((a, b) => b.count - a.count);
      setGroups(sorted);
      setTotalCount(sorted.reduce((s, g) => s + g.count, 0));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function saveManual() {
    if (!user || addIds.length === 0) { toast.error("Select at least one fragrance"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const names = addIds
        .map((id) => closetItems.find((i) => i.id === id)?.perfume?.name)
        .filter(Boolean) as string[];
      const { error } = await supabase.from("compliment_entries").insert({
        user_id: user.id,
        collection_item_ids: addIds,
        perfume_names: names,
        date: format(new Date(), "yyyy-MM-dd"),
      });
      if (error) throw error;
      toast.success("Compliment recorded!");
      setAddOpen(false);
      setAddIds([]);
      await load();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
          <p className="text-muted-foreground text-sm">Sign in to view your compliment tracker</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 pt-8 pb-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl">Compliment Tracker</h1>
            <p className="text-sm text-muted-foreground">Scents that turn heads</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>

        {/* Hero stat */}
        <div className="bg-gradient-to-br from-primary/10 to-plum-100 border border-primary/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <MessageCircleHeart className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-display text-4xl text-primary">{totalCount}</p>
            <p className="text-sm text-muted-foreground">total compliment{totalCount !== 1 ? "s" : ""} received</p>
          </div>
        </div>

        {/* Ranked list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <MessageCircleHeart className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">No compliments recorded yet.</p>
            <p className="text-xs text-muted-foreground">Tick &ldquo;Got a compliment&rdquo; in your scent log, or add one manually.</p>
            <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add manually
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g, i) => (
              <div
                key={g.key}
                className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3"
              >
                {/* Rank */}
                <span className="text-xs font-bold text-muted-foreground w-6 shrink-0 text-center">#{i + 1}</span>

                {/* Image */}
                <div className="w-11 h-11 rounded-xl bg-plum-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {proxyImageUrl(g.imageUrl) ? (
                    <Image src={proxyImageUrl(g.imageUrl)!} alt={g.names[0]} width={44} height={44} className="object-contain" unoptimized />
                  ) : (
                    <Droplets className="w-5 h-5 text-plum-300" />
                  )}
                </div>

                {/* Name(s) */}
                <div className="flex-1 min-w-0">
                  {g.isCombo && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium mr-1">combo</span>
                  )}
                  <p className="text-sm font-medium leading-tight truncate">{g.names.join(" + ")}</p>
                  {g.brand && !g.isCombo && (
                    <p className="text-xs text-muted-foreground truncate">{g.brand}</p>
                  )}
                </div>

                {/* Count */}
                <div className="flex items-center gap-1 shrink-0">
                  <MessageCircleHeart className="w-4 h-4 text-primary" />
                  <span className={cn("font-display text-lg text-primary")}>{g.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual entry sheet */}
      <Sheet open={addOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); setAddIds([]); } }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="mb-4 pt-2">
            <SheetTitle className="font-display text-left">Record a Compliment</SheetTitle>
            <p className="text-sm text-muted-foreground text-left">Which fragrance(s) were you wearing?</p>
          </SheetHeader>

          <div className="space-y-4">
            {closetItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Add fragrances to your closet first</p>
            ) : (
              <PerfumeSelect
                items={closetItems}
                value={addIds}
                onChange={setAddIds}
                placeholder="Search your closet…"
              />
            )}

            {addIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {addIds.map((id) => {
                  const item = closetItems.find((i) => i.id === id);
                  return item ? (
                    <span key={id} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      {item.perfume?.name}
                      <button onClick={() => setAddIds((prev) => prev.filter((x) => x !== id))}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <Button className="w-full h-11" onClick={saveManual} disabled={saving || addIds.length === 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Compliment"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
