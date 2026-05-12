"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { MultiSelect } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { checkAndAwardBadges } from "@/lib/badges";
import { MOODS, EVENT_TYPES, DURATION_RANGES } from "@/lib/utils";
import type { CollectionItem } from "@/lib/types";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { format } from "date-fns";

interface ScentLogFormProps {
  onSaved?: () => void;
}

export function ScentLogForm({ onSaved }: ScentLogFormProps) {
  const [closetItems, setClosetItems] = useState<CollectionItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mood, setMood] = useState<string[]>([]);
  const [eventType, setEventType] = useState("");
  const [rating, setRating] = useState(5);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("collection_items")
      .select("*, perfume:perfumes(*)")
      .eq("collection_type", "closet")
      .then(({ data }) => setClosetItems((data as CollectionItem[]) ?? []));
  }, []);

  function toggleItem(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }

  async function save() {
    if (selectedIds.length === 0) { toast.error("Select at least one fragrance"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please sign in"); return; }

      const { error } = await supabase.from("scent_logs").insert({
        user_id: user.id,
        collection_item_ids: selectedIds,
        date: format(new Date(), "yyyy-MM-dd"),
        mood,
        event_type: eventType,
        rating,
        duration,
        notes: notes || null,
      });

      if (error) throw error;
      toast.success("Scent logged!");
      checkAndAwardBadges(user.id);
      setDone(true);
      onSaved?.();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-12 gap-4">
        <CheckCircle2 className="w-14 h-14 text-primary" />
        <p className="font-display text-xl">Logged!</p>
        <p className="text-sm text-muted-foreground">Your scent has been recorded.</p>
        <Button variant="outline" onClick={() => { setDone(false); setSelectedIds([]); setMood([]); setEventType(""); setRating(5); setDuration(""); setNotes(""); }}>
          Log another
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fragrance selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">What did you wear today?</label>
        <p className="text-xs text-muted-foreground">Select all that apply</p>
        <div className="grid grid-cols-2 gap-2">
          {closetItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all",
                  isSelected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-plum-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.perfume?.image_url ? (
                    <Image src={item.perfume.image_url} alt="" width={40} height={40} className="object-contain" unoptimized />
                  ) : (
                    <Droplets className="w-5 h-5 text-plum-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{item.perfume?.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.perfume?.brand}</p>
                </div>
              </button>
            );
          })}
          {closetItems.length === 0 && (
            <p className="col-span-2 text-sm text-muted-foreground text-center py-4">Add fragrances to your closet first</p>
          )}
        </div>
      </div>

      {/* Mood */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Mood</label>
        <MultiSelect options={MOODS} value={mood} onChange={setMood} placeholder="How are you feeling?" />
      </div>

      {/* Event */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Occasion</label>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((e) => (
            <button
              key={e}
              onClick={() => setEventType(e === eventType ? "" : e)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs border transition-colors",
                eventType === e ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">How long did it last?</label>
        <div className="flex flex-wrap gap-2">
          {DURATION_RANGES.map((d) => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value === duration ? "" : d.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs border transition-colors",
                duration === d.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">
          Rating today — <span className="text-primary">{rating}/10</span>
        </label>
        <Slider min={1} max={10} step={0.5} value={[rating]} onValueChange={([v]) => setRating(v)} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1</span><span>5</span><span>10</span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Notes (optional)</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any thoughts on how it performed today…"
          className="resize-none"
          rows={3}
        />
      </div>

      <Button className="w-full h-12 text-base" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log Today's Scent"}
      </Button>
    </div>
  );
}
