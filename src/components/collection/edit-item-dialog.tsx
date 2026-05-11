"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MultiSelect } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn, BOTTLE_SIZES, SEASONS, OCCASIONS, PRODUCT_LEVELS, COLLECTION_TYPES, levelToFraction, formatPrice } from "@/lib/utils";
import type { CollectionItem } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Trash2, ArrowLeftRight, Star, Droplets } from "lucide-react";
import Image from "next/image";

interface EditItemDialogProps {
  item: CollectionItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditItemDialog({ item, open, onClose, onSaved }: EditItemDialogProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [collection, setCollection] = useState(item?.collection_type ?? "closet");
  const [sizes, setSizes] = useState<string[]>(item?.bottle_sizes ?? []);
  const [level, setLevel] = useState(item?.estimated_level ?? "full");
  const [seasons, setSeasons] = useState<string[]>(item?.seasons ?? []);
  const [occasions, setOccasions] = useState<string[]>(item?.occasions ?? []);
  const [rating, setRating] = useState(item?.rating ?? 0);
  const [swap, setSwap] = useState(item?.available_for_swap ?? false);

  // Reset when item changes
  if (item && item.collection_type !== collection && !saving) {
    setCollection(item.collection_type);
    setSizes(item.bottle_sizes ?? []);
    setLevel(item.estimated_level ?? "full");
    setSeasons(item.seasons ?? []);
    setOccasions(item.occasions ?? []);
    setRating(item.rating ?? 0);
    setSwap(item.available_for_swap ?? false);
  }

  if (!item) return null;

  // item is non-null beyond this point
  const itemId = item.id;

  const perfume = item.perfume;
  const levelFraction = levelToFraction(level);

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("collection_items")
        .update({
          collection_type: collection,
          bottle_sizes: sizes,
          estimated_level: level,
          seasons,
          occasions,
          rating: rating > 0 ? rating : null,
          available_for_swap: swap,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw error;
      toast.success("Saved!");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("collection_items").delete().eq("id", itemId);
      if (error) throw error;
      toast.success("Removed from collection");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Perfume header */}
        <div className="flex gap-3 p-4 border-b border-border bg-plum-50">
          <div className="w-16 h-16 rounded-xl bg-white border border-border flex items-center justify-center shrink-0 overflow-hidden">
            {perfume?.image_url ? (
              <Image src={perfume.image_url} alt={perfume.name} width={64} height={64} className="object-contain" unoptimized />
            ) : (
              <Droplets className="w-8 h-8 text-plum-300" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">{perfume?.brand}</p>
            <h3 className="font-display text-base leading-tight line-clamp-2">{perfume?.name}</h3>
            {perfume?.year && <p className="text-xs text-muted-foreground">{perfume.year}</p>}
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Collection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collection</label>
            <div className="grid grid-cols-3 gap-1.5">
              {COLLECTION_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => setCollection(ct.value as typeof collection)}
                  className={cn(
                    "py-2 px-1 rounded-lg text-[11px] font-medium border transition-colors text-center",
                    collection === ct.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-foreground"
                  )}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bottle sizes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sizes</label>
            <div className="flex flex-wrap gap-1.5">
              {BOTTLE_SIZES.map((bs) => (
                <button
                  key={bs.value}
                  onClick={() => setSizes((prev) => prev.includes(bs.value) ? prev.filter((s) => s !== bs.value) : [...prev, bs.value])}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs border transition-colors",
                    sizes.includes(bs.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border"
                  )}
                >
                  {bs.label}
                </button>
              ))}
            </div>

            {/* Price display */}
            {item.size_prices?.length > 0 && (
              <div className="space-y-0.5 pt-1">
                {item.size_prices.filter((p) => sizes.includes(p.size)).map((p) => {
                  const label = BOTTLE_SIZES.find((b) => b.value === p.size)?.label;
                  return p.price_min && (
                    <p key={p.size} className="text-xs text-muted-foreground">
                      {label}: <span className="font-medium text-foreground">${p.price_min}–${p.price_max}</span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>

          {/* Level (closet only) */}
          {collection === "closet" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current Level — <span className="text-primary normal-case font-medium">{level}</span>
              </label>
              <Progress value={Math.round(levelFraction * 100)} className="h-2" />
              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs border transition-colors",
                      level === l ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Seasons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seasons</label>
            <MultiSelect options={SEASONS} value={seasons} onChange={setSeasons} placeholder="Select seasons…" />
          </div>

          {/* Occasions */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Occasions</label>
            <MultiSelect options={OCCASIONS} value={occasions} onChange={setOccasions} placeholder="Select occasions…" />
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rating — <span className="text-primary normal-case font-medium">{rating > 0 ? `${rating}/10` : "–"}</span>
            </label>
            <Slider min={0} max={10} step={0.5} value={[rating]} onValueChange={([v]) => setRating(v)} />
          </div>

          {/* Swap toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Available for swap</span>
            </div>
            <button
              onClick={() => setSwap((v) => !v)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative",
                swap ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", swap ? "left-5" : "left-0.5")} />
            </button>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button variant="destructive" size="sm" className="gap-1" onClick={deleteItem} disabled={deleting}>
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Remove
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
