"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { MultiSelect } from "@/components/ui/multi-select";
import { createClient } from "@/lib/supabase/client";
import { checkAndAwardBadges } from "@/lib/badges";
import { MOODS, OCCASIONS, DURATION_RANGES, BOTTLE_SIZES, fractionToLevel, levelToFraction, cn } from "@/lib/utils";
import type { CollectionItem } from "@/lib/types";
import { PerfumeSelect } from "@/components/ui/perfume-select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, MessageCircleHeart, Droplets } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

const SPRAY_INTENSITIES = [
  { value: "gentle",       label: "Gentle",       sub: "2–5 sprays",   sprays: 5  },
  { value: "average",      label: "Average",      sub: "6–15 sprays",  sprays: 15 },
  { value: "heavy",        label: "Heavy",        sub: "16–30 sprays", sprays: 30 },
  { value: "over_the_top", label: "Over the top", sub: "31+ sprays",   sprays: 50 },
] as const;

type SprayIntensity = typeof SPRAY_INTENSITIES[number]["value"];

const ML_PER_SPRAY = 0.1;

function largestBottleMl(bottleSizes: string[]): number {
  let best = 0;
  for (const sizeVal of bottleSizes) {
    const known = BOTTLE_SIZES.find((b) => b.value === sizeVal);
    if (known && known.ml > best) { best = known.ml; continue; }
    // Try parsing custom sizes like "35ml"
    const match = sizeVal.match(/^(\d+(?:\.\d+)?)ml$/i);
    if (match) {
      const ml = parseFloat(match[1]);
      if (ml > best) best = ml;
    }
  }
  return best;
}

interface ScentLogFormProps {
  onSaved?: () => void;
  initialItemIds?: string[];
  initialMood?: string[];
  initialOccasions?: string[];
}

export function ScentLogForm({ onSaved, initialItemIds = [], initialMood = [], initialOccasions = [] }: ScentLogFormProps) {
  const router = useRouter();
  const [closetItems, setClosetItems] = useState<CollectionItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialItemIds);
  // Per-perfume spray intensity: itemId → intensity value
  const [sprayIntensities, setSprayIntensities] = useState<Record<string, SprayIntensity>>({});
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

  // Remove intensity entries for deselected items
  useEffect(() => {
    setSprayIntensities((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!selectedIds.includes(id)) delete next[id];
      }
      return next;
    });
  }, [selectedIds]);

  async function updateLevelsAndNotify(userId: string) {
    const supabase = createClient();
    const emptied: string[] = [];

    for (const id of selectedIds) {
      const item = closetItems.find((c) => c.id === id);
      if (!item) continue;

      const totalMl = largestBottleMl(item.bottle_sizes ?? []);
      if (totalMl === 0) continue; // unknown size, skip

      const intensity = SPRAY_INTENSITIES.find((s) => s.value === sprayIntensities[id]);
      if (!intensity) continue; // user didn't select — skip

      const usedMl = intensity.sprays * ML_PER_SPRAY;
      const currentFraction = levelToFraction(item.estimated_level ?? "full");
      const newFraction = Math.max(0, currentFraction - usedMl / totalMl);
      const newLevel = fractionToLevel(newFraction);

      await supabase
        .from("collection_items")
        .update({ estimated_level: newLevel })
        .eq("id", id);

      if (newLevel === "empty") {
        const perfumeName = (item.perfume ?? item.user_perfume)?.name ?? "A perfume";
        emptied.push(perfumeName);
      }
    }

    if (emptied.length === 0) return;

    // In-app toast prompt
    for (const name of emptied) {
      toast(`${name} is empty`, {
        description: "Move it to Owned Before?",
        action: { label: "Go to Closet", onClick: () => router.push("/closet") },
        duration: 8000,
      });
    }

    // Push notification
    try {
      await fetch("/api/push/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Bottle emptied",
          body: emptied.length === 1
            ? `${emptied[0]} is empty — move it to Owned Before?`
            : `${emptied.join(", ")} are empty — move them to Owned Before?`,
          url: "/closet",
        }),
      });
    } catch { /* non-critical */ }

    void userId; // used via supabase auth above
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
        event_type: eventTypes[0] ?? "",
        event_types: eventTypes,
        rating,
        duration,
        notes: notes || null,
        got_compliment: gotCompliment,
      });

      if (error) throw error;
      toast.success(gotCompliment ? "Scent logged — compliment recorded!" : "Scent logged!");
      checkAndAwardBadges(user.id);

      // Update bottle levels (non-blocking)
      updateLevelsAndNotify(user.id);

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
        <Button variant="outline" onClick={() => {
          setDone(false);
          setSelectedIds([]);
          setSprayIntensities({});
          setMood([]);
          setEventTypes([]);
          setRating(5);
          setDuration("");
          setNotes("");
          setGotCompliment(false);
        }}>
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

      {/* Per-perfume spray intensity */}
      {selectedIds.length > 0 && (
        <div className="space-y-4">
          <label className="text-sm font-semibold">How did you spray each fragrance?</label>
          {selectedIds.map((id) => {
            const item = closetItems.find((c) => c.id === id);
            const perfumeName = (item?.perfume ?? item?.user_perfume)?.name ?? "Unknown";
            const selected = sprayIntensities[id];
            return (
              <div key={id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Droplets className="w-3.5 h-3.5 text-primary shrink-0" />
                  <p className="text-xs font-medium truncate">{perfumeName}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SPRAY_INTENSITIES.map((intensity) => (
                    <button
                      key={intensity.value}
                      type="button"
                      onClick={() => setSprayIntensities((prev) => ({ ...prev, [id]: intensity.value }))}
                      className={cn(
                        "px-3 py-2 rounded-xl text-left border transition-colors",
                        selected === intensity.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      )}
                    >
                      <p className="text-xs font-medium">{intensity.label}</p>
                      <p className={cn("text-[10px]", selected === intensity.value ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {intensity.sub}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mood */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Mood</label>
        <MultiSelect chips options={MOODS} value={mood} onChange={setMood} placeholder="How are you feeling?" />
      </div>

      {/* Event */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Occasion</label>
        <MultiSelect chips options={OCCASIONS} value={eventTypes} onChange={setEventTypes} placeholder="Select occasions…" />
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
