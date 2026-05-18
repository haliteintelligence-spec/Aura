"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { MultiSelect } from "@/components/ui/multi-select";
import { createClient } from "@/lib/supabase/client";
import { checkAndAwardBadges } from "@/lib/badges";
import { MOODS, OCCASIONS, DURATION_RANGES, cn } from "@/lib/utils";
import type { CollectionItem } from "@/lib/types";
import { PerfumeSelect } from "@/components/ui/perfume-select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, MessageCircleHeart } from "lucide-react";
import { format } from "date-fns";

interface ScentLogFormProps {
  onSaved?: () => void;
  initialItemIds?: string[];
  initialMood?: string[];
  initialOccasions?: string[];
}

export function ScentLogForm({ onSaved, initialItemIds = [], initialMood = [], initialOccasions = [] }: ScentLogFormProps) {
  const [closetItems, setClosetItems] = useState<CollectionItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialItemIds);
  const [mood, setMood] = useState<string[]>(initialMood);
  const [eventTypes, setEventTypes] = useState<string[]>(initialOccasions);
  const [rating, setRating] = useState(5);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [gotCompliment, setGotCompliment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("collection_items")
      .select("*, perfume:perfumes(*), user_perfume:user_perfumes(*)")
      .eq("collection_type", "closet")
      .then(({ data }) => setClosetItems((data as CollectionItem[]) ?? []));
  }, []);

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
        event_type: eventTypes[0] ?? "",
        event_types: eventTypes,
        rating,
        duration,
        notes: notes || null,
        got_compliment: gotCompliment,
      });

      if (error) throw error;
      toast.success(gotCompliment ? "Scent logged — compliment recorded! 💬" : "Scent logged!");
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
        <Button variant="outline" onClick={() => { setDone(false); setSelectedIds([]); setMood([]); setEventTypes([]); setRating(5); setDuration(""); setNotes(""); setGotCompliment(false); }}>
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
        <p className="text-xs text-muted-foreground">Select all that apply — you can wear more than one</p>
        {closetItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Add fragrances to your closet first</p>
        ) : (
          <PerfumeSelect items={closetItems} value={selectedIds} onChange={setSelectedIds} placeholder="Search and select fragrances…" />
        )}
      </div>

      {/* Mood */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Mood</label>
        <MultiSelect options={MOODS} value={mood} onChange={setMood} placeholder="How are you feeling?" />
      </div>

      {/* Event */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Occasion</label>
        <MultiSelect options={OCCASIONS} value={eventTypes} onChange={setEventTypes} placeholder="Select occasions…" />
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

      {/* Compliment toggle */}
      <button
        type="button"
        onClick={() => setGotCompliment((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors text-left",
          gotCompliment ? "bg-primary/10 border-primary/40" : "bg-card border-border"
        )}
      >
        <MessageCircleHeart className={cn("w-5 h-5 shrink-0", gotCompliment ? "text-primary" : "text-muted-foreground")} />
        <div className="flex-1">
          <p className={cn("text-sm font-medium", gotCompliment && "text-primary")}>Got a compliment today?</p>
          <p className="text-xs text-muted-foreground">Tap to record — tracked in your Compliment Tracker</p>
        </div>
        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          gotCompliment ? "bg-primary border-primary" : "border-muted-foreground/40")}>
          {gotCompliment && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
        </div>
      </button>

      <Button className="w-full h-12 text-base" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log Today's Scent"}
      </Button>
    </div>
  );
}
