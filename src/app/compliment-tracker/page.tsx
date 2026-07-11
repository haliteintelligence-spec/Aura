"use client";
import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PerfumeSelect } from "@/components/ui/perfume-select";
import { useUser } from "@/hooks/use-user";
import { cn, proxyImageUrl } from "@/lib/utils";
import type { CollectionItem, ComplimentEntry } from "@/lib/types";
import { MessageCircleHeart, Plus, Minus, Loader2, Droplets, Trash2, Pencil, BookOpen } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface ComplimentGroup {
  key: string;
  names: string[];
  imageUrl?: string;
  brand?: string;
  count: number;
  isCombo: boolean;
}

interface JournalEntry {
  id: string;
  collection_item_ids: string[];
  date: string;
  names: string[];
}

export default function ComplimentTrackerPage() {
  const { user } = useUser();
  const [groups, setGroups] = useState<ComplimentGroup[]>([]);
  const [manualEntries, setManualEntries] = useState<ComplimentEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [closetItems, setClosetItems] = useState<CollectionItem[]>([]);

  // Sheet state — null = add mode, ComplimentEntry = edit mode
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ComplimentEntry | null>(null);
  const [sheetIds, setSheetIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [closetRes, logsRes, complimentsRes] = await Promise.all([
        fetch("/api/collection?type=closet").then((r) => r.json()),
        fetch("/api/logs").then((r) => r.json()),
        fetch("/api/compliments").then((r) => r.json()),
      ]);
      const closet = (closetRes.data as CollectionItem[]) ?? [];
      setClosetItems(closet);

      const idToItem = Object.fromEntries(closet.map((i: CollectionItem) => [i.id, i]));

      const logs = ((logsRes.data ?? []) as Array<{ id: string; collection_item_ids: string[]; date: string; got_compliment: boolean }>).filter((l) => l.got_compliment);
      const manual = (complimentsRes.data as ComplimentEntry[]) ?? [];

      const rawManual = manual;
      setManualEntries(rawManual);

      const rawJournal: JournalEntry[] = logs.map((log) => {
        const ids = (log.collection_item_ids as string[]) ?? [];
        const names = ids.map((id) => { const it = idToItem[id]; return (it?.perfume ?? it?.user_perfume)?.name; }).filter(Boolean) as string[];
        return { id: log.id as string, collection_item_ids: ids, date: log.date as string, names };
      });
      setJournalEntries(rawJournal);

      const countMap = new Map<string, ComplimentGroup>();

      function upsertGroup(names: string[], itemIds: string[], weight = 1) {
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        const key = sorted.join(" + ");
        const existing = countMap.get(key);
        if (existing) {
          existing.count += weight;
        } else {
          const firstId = itemIds[0];
          const firstItem = firstId ? idToItem[firstId] : undefined;
          countMap.set(key, {
            key,
            names: sorted,
            imageUrl: (firstItem?.perfume ?? firstItem?.user_perfume)?.image_url ?? undefined,
            brand: (firstItem?.perfume ?? firstItem?.user_perfume)?.brand,
            count: weight,
            isCombo: sorted.length > 1,
          });
        }
      }

      for (const j of rawJournal) {
        if (j.names.length > 0) upsertGroup(j.names, j.collection_item_ids);
      }
      for (const entry of rawManual) {
        if (entry.perfume_names?.length > 0) upsertGroup(entry.perfume_names, entry.collection_item_ids, entry.compliment_count ?? 1);
      }

      const sorted = [...countMap.values()].sort((a, b) => b.count - a.count);
      setGroups(sorted);
      setTotalCount(sorted.reduce((s, g) => s + g.count, 0));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingEntry(null);
    setSheetIds([]);
    setSheetOpen(true);
  }

  function openEdit(entry: ComplimentEntry) {
    setEditingEntry(entry);
    setSheetIds(entry.collection_item_ids ?? []);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditingEntry(null);
    setSheetIds([]);
  }

  async function saveSheet() {
    if (!user || sheetIds.length === 0) { toast.error("Select at least one fragrance"); return; }
    setSaving(true);
    try {
      const names = sheetIds
        .map((id) => closetItems.find((i) => i.id === id)?.perfume?.name)
        .filter(Boolean) as string[];

      if (editingEntry) {
        const res = await fetch(`/api/compliments/${editingEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection_item_ids: sheetIds, perfume_names: names }),
        });
        if (!res.ok) throw new Error("Update failed");
        toast.success("Entry updated");
      } else {
        const res = await fetch("/api/compliments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection_item_ids: sheetIds, perfume_names: names }),
        });
        if (!res.ok) throw new Error("Insert failed");
        toast.success("Compliment recorded!");
      }
      closeSheet();
      await load();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteManual(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/compliments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Entry deleted");
      await load();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  async function updateComplimentCount(id: string, nextCount: number) {
    if (nextCount < 1) return;
    setManualEntries((prev) => prev.map((e) => (e.id === id ? { ...e, compliment_count: nextCount } : e)));
    try {
      const res = await fetch(`/api/compliments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compliment_count: nextCount }),
      });
      if (!res.ok) throw new Error("Update failed");
      await load();
    } catch {
      toast.error("Failed to update compliment count");
      await load();
    }
  }

  async function removeJournalCompliment(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/logs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ got_compliment: false }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success("Compliment removed from log");
      await load();
    } catch {
      toast.error("Failed to update");
    } finally {
      setDeleting(null);
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

  const hasEntries = manualEntries.length > 0 || journalEntries.length > 0;

  return (
    <AppShell>
      <div className="px-4 pt-8 pb-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl">Compliment Tracker</h1>
            <p className="text-sm text-muted-foreground">Scents that turn heads</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openAdd}>
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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : !hasEntries ? (
          <div className="text-center py-16 space-y-3">
            <MessageCircleHeart className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">No compliments recorded yet.</p>
            <p className="text-xs text-muted-foreground">Tick &ldquo;Got a compliment&rdquo; in your scent log, or add one manually.</p>
            <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={openAdd}>
              <Plus className="w-3.5 h-3.5" /> Add manually
            </Button>
          </div>
        ) : (
          <>
            {/* Ranked leaderboard */}
            {groups.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Most complimented</p>
                {groups.map((g, i) => (
                  <div
                    key={g.key}
                    className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3"
                  >
                    <span className="text-xs font-bold text-muted-foreground w-6 shrink-0 text-center">#{i + 1}</span>
                    <div className="w-11 h-11 rounded-xl bg-plum-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {proxyImageUrl(g.imageUrl) ? (
                        <Image src={proxyImageUrl(g.imageUrl)!} alt={g.names[0]} width={44} height={44} className="object-contain" unoptimized />
                      ) : (
                        <Droplets className="w-5 h-5 text-plum-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {g.isCombo && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium mr-1">combo</span>
                      )}
                      <p className="text-sm font-medium leading-tight truncate">{g.names.join(" + ")}</p>
                      {g.brand && !g.isCombo && (
                        <p className="text-xs text-muted-foreground truncate">{g.brand}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <MessageCircleHeart className="w-4 h-4 text-primary" />
                      <span className={cn("font-display text-lg text-primary")}>{g.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual entries — editable */}
            {manualEntries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manual entries</p>
                {manualEntries.map((entry) => (
                  <div key={entry.id} className="bg-card border border-border rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug break-words">{entry.perfume_names?.join(" + ") ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{entry.date ? format(parseISO(entry.date), "MMM d, yyyy") : ""}</p>
                      </div>
                      <button
                        onClick={() => openEdit(entry)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteManual(entry.id)}
                        disabled={deleting === entry.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0"
                      >
                        {deleting === entry.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">Compliments received</span>
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => updateComplimentCount(entry.id, (entry.compliment_count ?? 1) - 1)}
                          disabled={(entry.compliment_count ?? 1) <= 1}
                          className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-display text-base text-primary w-5 text-center">{entry.compliment_count ?? 1}</span>
                        <button
                          onClick={() => updateComplimentCount(entry.id, (entry.compliment_count ?? 1) + 1)}
                          className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Journal-derived entries — removable */}
            {journalEntries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> From scent journal
                </p>
                {journalEntries.map((entry) => (
                  <div key={entry.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">
                        {entry.names.length > 0 ? entry.names.join(" + ") : <span className="text-muted-foreground italic">Unknown fragrance</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{entry.date ? format(parseISO(entry.date), "MMM d, yyyy") : ""}</p>
                    </div>
                    <button
                      onClick={() => removeJournalCompliment(entry.id)}
                      disabled={deleting === entry.id}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      title="Remove compliment from this log"
                    >
                      {deleting === entry.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="mb-4 pt-2">
            <SheetTitle className="font-display text-left">
              {editingEntry ? "Edit Entry" : "Record a Compliment"}
            </SheetTitle>
            <p className="text-sm text-muted-foreground text-left">Which fragrance(s) were you wearing?</p>
          </SheetHeader>

          <div className="space-y-4">
            {closetItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Add fragrances to your closet first</p>
            ) : (
              <PerfumeSelect
                items={closetItems}
                value={sheetIds}
                onChange={setSheetIds}
                placeholder="Search your closet…"
              />
            )}

            {sheetIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sheetIds.map((id) => {
                  const item = closetItems.find((i) => i.id === id);
                  return item ? (
                    <span key={id} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      {item.perfume?.name}
                      <button onClick={() => setSheetIds((prev) => prev.filter((x) => x !== id))}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <Button className="w-full h-11" onClick={saveSheet} disabled={saving || sheetIds.length === 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingEntry ? "Save Changes" : "Save Compliment"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
