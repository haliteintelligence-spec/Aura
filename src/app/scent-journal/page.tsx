"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MultiSelect } from "@/components/ui/multi-select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { MOODS, EVENT_TYPES, DURATION_RANGES, proxyImageUrl, cn } from "@/lib/utils";
import { PerfumeSelect } from "@/components/ui/perfume-select";
import type { ScentLog, CollectionItem } from "@/lib/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { BookOpen, Plus, Loader2, Droplets, Star, Edit2, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ScentJournalPage() {
  const { user, loading } = useUser();
  const [logs, setLogs] = useState<ScentLog[]>([]);
  const [closetItems, setClosetItems] = useState<CollectionItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editingLog, setEditingLog] = useState<ScentLog | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const supabase = createClient();
    const [{ data: logData }, { data: itemData }] = await Promise.all([
      supabase
        .from("scent_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("date", { ascending: false }),
      supabase
        .from("collection_items")
        .select("*, perfume:perfumes(*)")
        .eq("user_id", user!.id)
        .eq("collection_type", "closet"),
    ]);
    setLogs((logData as ScentLog[]) ?? []);
    setClosetItems((itemData as CollectionItem[]) ?? []);
    setDataLoading(false);
  }

  async function deleteLog(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("scent_logs").delete().eq("id", id);
    if (!error) {
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success("Log deleted");
    }
  }

  if (loading || dataLoading) {
    return <AppShell><div className="flex justify-center pt-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AppShell>;
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
          <p className="text-muted-foreground">Sign in to view your scent journal</p>
          <Link href="/sign-in"><Button>Sign in</Button></Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-8 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <div>
              <h1 className="font-display text-2xl">Scent Journal</h1>
              <p className="text-xs text-muted-foreground">{logs.length} entries</p>
            </div>
          </div>
          <Link href="/scent-log">
            <Button size="sm" className="gap-1 h-8 text-xs">
              <Plus className="w-3 h-3" /> Log today
            </Button>
          </Link>
        </div>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No scent logs yet.</p>
            <Link href="/scent-log"><Button variant="outline" size="sm">Log your first scent</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const items = closetItems.filter((ci) => log.collection_item_ids?.includes(ci.id));
              const durationLabel = DURATION_RANGES.find((d) => d.value === log.duration)?.label;
              return (
                <div key={log.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display text-base">{format(new Date(log.date), "EEEE, MMM d yyyy")}</p>
                      {log.event_type && <p className="text-xs text-muted-foreground">{log.event_type}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {log.rating && (
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                          <span className="text-xs font-medium">{log.rating}</span>
                        </div>
                      )}
                      <button onClick={() => setEditingLog(log)} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteLog(log.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Perfumes */}
                  {items.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-1.5 bg-muted rounded-full pl-1 pr-2.5 py-1">
                          <div className="w-6 h-6 rounded-full bg-plum-50 flex items-center justify-center overflow-hidden shrink-0">
                            {proxyImageUrl(item.perfume?.image_url) ? (
                              <Image src={proxyImageUrl(item.perfume!.image_url)!} alt="" width={24} height={24} className="object-contain" unoptimized />
                            ) : (
                              <Droplets className="w-3 h-3 text-plum-300" />
                            )}
                          </div>
                          <span className="text-xs font-medium truncate max-w-24">{item.perfume?.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {log.mood?.map((m) => (
                      <span key={m} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m}</span>
                    ))}
                    {durationLabel && (
                      <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{durationLabel}</span>
                    )}
                  </div>

                  {log.notes && (
                    <p className="text-xs text-muted-foreground italic leading-relaxed">"{log.notes}"</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      {editingLog && (
        <EditLogDialog
          log={editingLog}
          closetItems={closetItems}
          onClose={() => setEditingLog(null)}
          onSaved={(updated) => {
            setLogs((prev) => prev.map((l) => l.id === updated.id ? updated : l));
            setEditingLog(null);
          }}
        />
      )}
    </AppShell>
  );
}

function EditLogDialog({
  log,
  closetItems,
  onClose,
  onSaved,
}: {
  log: ScentLog;
  closetItems: CollectionItem[];
  onClose: () => void;
  onSaved: (updated: ScentLog) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(log.collection_item_ids ?? []);
  const [mood, setMood] = useState<string[]>(log.mood ?? []);
  const [eventType, setEventType] = useState(log.event_type ?? "");
  const [duration, setDuration] = useState(log.duration ?? "");
  const [rating, setRating] = useState(log.rating ?? 5);
  const [notes, setNotes] = useState(log.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("scent_logs")
      .update({
        collection_item_ids: selectedIds,
        mood,
        event_type: eventType,
        duration,
        rating,
        notes: notes || null,
      })
      .eq("id", log.id);

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Log updated");
      onSaved({ ...log, collection_item_ids: selectedIds, mood, event_type: eventType, duration, rating, notes: notes || null });
    }
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{format(new Date(log.date), "EEEE, MMM d")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Fragrance selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fragrances worn</label>
            <PerfumeSelect items={closetItems} value={selectedIds} onChange={setSelectedIds} placeholder="Search and select fragrances…" />
          </div>

          {/* Mood */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mood</label>
            <MultiSelect options={MOODS} value={mood} onChange={setMood} placeholder="How were you feeling?" />
          </div>

          {/* Occasion */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Occasion</label>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPES.map((e) => (
                <button key={e} onClick={() => setEventType(e === eventType ? "" : e)}
                  className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors",
                    eventType === e ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border")}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_RANGES.map((d) => (
                <button key={d.value} onClick={() => setDuration(d.value === duration ? "" : d.value)}
                  className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors",
                    duration === d.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border")}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rating — <span className="text-primary">{rating}/10</span>
            </label>
            <Slider min={1} max={10} step={0.5} value={[rating]} onValueChange={([v]) => setRating(v)} />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any thoughts…" rows={3} className="resize-none" />
          </div>

          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
