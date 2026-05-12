"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { checkAndAwardBadges } from "@/lib/badges";
import { SEASONS, OCCASIONS, MOODS, cn } from "@/lib/utils";
import type { CollectionItem, LayerCombo } from "@/lib/types";
import { toast } from "sonner";
import { Loader2, Layers, Sparkles, Droplets, Save, Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface ComboResult {
  selected_perfumes?: string[];
  layering_order?: string;
  combined_profile?: string;
  dominant_notes?: string[];
  character?: string;
  estimated_longevity?: string;
  estimated_sillage?: string;
  tips?: string;
  name_suggestion?: string;
}

export default function LayeringPage() {
  const { user } = useUser();
  const [closetItems, setClosetItems] = useState<CollectionItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"manual" | "generate">("manual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComboResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedCombos, setSavedCombos] = useState<LayerCombo[]>([]);
  const [expandedCombo, setExpandedCombo] = useState<string | null>(null);

  // Generate mode params
  const [genOccasion, setGenOccasion] = useState<string[]>([]);
  const [genSeason, setGenSeason] = useState<string[]>([]);
  const [genMood, setGenMood] = useState<string[]>([]);
  const [genCount, setGenCount] = useState("2");
  const [longevity, setLongevity] = useState(5);
  const [sillage, setSillage] = useState(5);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("collection_items")
      .select("*, perfume:perfumes(*)")
      .eq("user_id", user.id)
      .eq("collection_type", "closet")
      .then(({ data }) => setClosetItems((data as CollectionItem[]) ?? []));
    loadSavedCombos();
  }, [user]);

  async function loadSavedCombos() {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("layer_combos")
      .select("*")
      .eq("user_id", user.id)
      .eq("saved", true)
      .order("created_at", { ascending: false });
    setSavedCombos((data as LayerCombo[]) ?? []);
  }

  async function deleteCombo(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("layer_combos").delete().eq("id", id);
    if (!error) {
      setSavedCombos((prev) => prev.filter((c) => c.id !== id));
      toast.success("Combo deleted");
    }
  }

  function toggleItem(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function analyse() {
    const perfumesToSend = mode === "manual"
      ? closetItems.filter((i) => selectedIds.includes(i.id)).map((i) => i.perfume)
      : closetItems.map((i) => i.perfume);

    if (mode === "manual" && selectedIds.length < 2) {
      toast.error("Select at least 2 fragrances");
      return;
    }

    setLoading(true);
    setResult(null);
    setSaved(false);

    try {
      const res = await fetch("/api/layering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perfumes: perfumesToSend,
          mode,
          occasion: genOccasion,
          season: genSeason,
          mood: genMood,
          count: parseInt(genCount),
          intensityLongevity: longevity,
          intensitySillage: sillage,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      toast.error("Failed to analyse combination");
    } finally {
      setLoading(false);
    }
  }

  async function saveCombo() {
    if (!user || !result) return;
    const supabase = createClient();

    // In generate mode, resolve AI-picked perfume names back to collection item IDs
    const itemIds = mode === "generate" && result.selected_perfumes?.length
      ? closetItems
          .filter((item) => result.selected_perfumes!.some(
            (name) => item.perfume?.name?.toLowerCase() === name.toLowerCase()
          ))
          .map((item) => item.id)
      : selectedIds;

    const { error } = await supabase.from("layer_combos").insert({
      user_id: user.id,
      name: result.name_suggestion,
      collection_item_ids: itemIds,
      occasion: genOccasion,
      season: genSeason,
      mood: genMood,
      intensity_longevity: longevity,
      intensity_sillage: sillage,
      combined_profile: result.combined_profile,
      saved: true,
    });
    if (!error) {
      setSaved(true);
      toast.success("Combo saved!");
      checkAndAwardBadges(user.id);
      loadSavedCombos();
    } else {
      toast.error("Failed to save");
    }
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
          <p className="text-muted-foreground">Sign in to use the Layering Combinator</p>
          <Link href="/sign-in"><Button>Sign in</Button></Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-primary" />
            <h1 className="font-display text-2xl">Layering</h1>
          </div>
          <p className="text-sm text-muted-foreground">Combine fragrances or let AI create the perfect mix</p>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          {(["manual", "generate"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); setSelectedIds([]); }}
              className={cn(
                "py-2.5 rounded-xl text-sm font-medium border transition-colors",
                mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
              )}
            >
              {m === "manual" ? "Manual Mix" : "✨ Generate Combo"}
            </button>
          ))}
        </div>

        {mode === "manual" ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Select fragrances to layer</label>
              <div className="space-y-2">
                {closetItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                        isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <div className="w-10 h-10 rounded-lg bg-plum-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {item.perfume?.image_url ? (
                          <Image src={item.perfume.image_url} alt="" width={40} height={40} className="object-contain" unoptimized />
                        ) : (
                          <Droplets className="w-5 h-5 text-plum-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.perfume?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.perfume?.brand}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button className="w-full h-11 gap-2" onClick={analyse} disabled={loading || selectedIds.length < 2}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Analyse Combination
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Occasion</label>
                <MultiSelect options={OCCASIONS} value={genOccasion} onChange={setGenOccasion} placeholder="Any occasion…" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Season</label>
                <MultiSelect options={SEASONS} value={genSeason} onChange={setGenSeason} placeholder="Any season…" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Mood</label>
                <MultiSelect options={MOODS} value={genMood} onChange={setGenMood} placeholder="Any mood…" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Number of fragrances</label>
                <Select value={genCount} onValueChange={setGenCount}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["2", "3", "4"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Longevity — <span className="text-primary">{longevity}/10</span></label>
                <Slider min={1} max={10} step={1} value={[longevity]} onValueChange={([v]) => setLongevity(v)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Sillage (projection) — <span className="text-primary">{sillage}/10</span></label>
                <Slider min={1} max={10} step={1} value={[sillage]} onValueChange={([v]) => setSillage(v)} />
              </div>
            </div>
            <Button className="w-full h-11 gap-2" onClick={analyse} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Combo
            </Button>
          </>
        )}

        {/* Saved combos */}
        {savedCombos.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base">Saved Combos</h2>
            <div className="space-y-2">
              {savedCombos.map((combo) => {
                const isExpanded = expandedCombo === combo.id;
                const perfumeNames = combo.collection_item_ids.length > 0
                  ? closetItems
                      .filter((i) => combo.collection_item_ids.includes(i.id))
                      .map((i) => i.perfume?.name)
                      .filter(Boolean)
                      .join(" + ")
                  : null;
                return (
                  <div key={combo.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                      onClick={() => setExpandedCombo(isExpanded ? null : combo.id)}
                    >
                      <div className="min-w-0">
                        <p className="font-display text-sm font-medium truncate">{combo.name ?? "Unnamed combo"}</p>
                        {perfumeNames && <p className="text-xs text-muted-foreground truncate">{perfumeNames}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCombo(combo.id); }}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                        {combo.combined_profile && (
                          <p className="text-sm text-muted-foreground leading-relaxed">{combo.combined_profile}</p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {combo.occasion?.map((o) => <span key={o} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{o}</span>)}
                          {combo.season?.map((s) => <span key={s} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{s}</span>)}
                          {combo.mood?.map((m) => <span key={m} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{m}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Result */}
        {result && (
          <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-4">
            {result.name_suggestion && (
              <div className="text-center">
                <p className="font-display text-xl text-primary">{result.name_suggestion}</p>
              </div>
            )}

            {result.selected_perfumes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Combo</p>
                <p className="text-sm">{result.selected_perfumes.join(" + ")}</p>
              </div>
            )}

            {result.combined_profile && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Combined Profile</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{result.combined_profile}</p>
              </div>
            )}

            {result.layering_order && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How to Layer</p>
                <p className="text-sm leading-relaxed">{result.layering_order}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {result.estimated_longevity && (
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Longevity</p>
                  <p className="text-sm font-medium mt-0.5">{result.estimated_longevity}</p>
                </div>
              )}
              {result.estimated_sillage && (
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sillage</p>
                  <p className="text-sm font-medium mt-0.5">{result.estimated_sillage}</p>
                </div>
              )}
            </div>

            {result.dominant_notes && result.dominant_notes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.dominant_notes.map((n) => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
              </div>
            )}

            {result.tips && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tips</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{result.tips}</p>
              </div>
            )}

            <Button
              variant={saved ? "secondary" : "outline"}
              className="w-full gap-2"
              onClick={saveCombo}
              disabled={saved}
            >
              {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save this combo</>}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
