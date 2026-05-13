"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MultiSelect } from "@/components/ui/multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { format, subDays } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { Droplets, Sparkles, BookOpen, Plus, ChevronRight, User, Layers, Loader2 } from "lucide-react";
import type { ScentLog } from "@/lib/types";
import { cn, BOTTLE_SIZES, SEASONS, OCCASIONS, PRODUCT_LEVELS, COLLECTION_TYPES, proxyImageUrl } from "@/lib/utils";
import { toast } from "sonner";
import { checkAndAwardBadges } from "@/lib/badges";
import { useRouter } from "next/navigation";

interface Rec {
  name: string;
  brand: string;
  image_url?: string;
  reason?: string;
}

export default function HomePage() {
  const { user } = useUser();
  const router = useRouter();
  const [recentLogs, setRecentLogs] = useState<ScentLog[]>([]);
  const [recommendations, setRecommendations] = useState<Rec[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [closetCount, setClosetCount] = useState(0);
  const [seasonalData, setSeasonalData] = useState<Record<string, { name: string; count: number }[]>>({});

  // Add-to-collection sheet state
  const [selectedRec, setSelectedRec] = useState<Rec | null>(null);
  const [addCollection, setAddCollection] = useState<"closet" | "wishlist" | "owned_before">("closet");
  const [addSizes, setAddSizes] = useState<string[]>([]);
  const [addLevel, setAddLevel] = useState("full");
  const [addSeasons, setAddSeasons] = useState<string[]>([]);
  const [addOccasions, setAddOccasions] = useState<string[]>([]);
  const [addRating, setAddRating] = useState(0);
  const [addPrices, setAddPrices] = useState<Record<string, { min: number; max: number }>>({});
  const [addingPrices, setAddingPrices] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  const last7 = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("scent_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(14)
      .then(({ data }) => setRecentLogs((data as ScentLog[]) ?? []));

    supabase
      .from("collection_items")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("collection_type", "closet")
      .then(({ count }) => setClosetCount(count ?? 0));

    // Seasonal usage patterns
    supabase
      .from("scent_logs")
      .select("date, collection_item_ids")
      .eq("user_id", user.id)
      .then(async ({ data: logs }) => {
        if (!logs?.length) return;
        const allIds = [...new Set(logs.flatMap((l) => l.collection_item_ids as string[]))];
        if (!allIds.length) return;
        const { data: collItems } = await supabase
          .from("collection_items")
          .select("id, perfume:perfumes(name)")
          .in("id", allIds);
        const idToName = Object.fromEntries(
          (collItems ?? []).map((i) => [i.id, (i.perfume as unknown as { name: string } | null)?.name ?? ""])
        );
        const getSeason = (d: string) => {
          const m = new Date(d).getMonth() + 1;
          if (m >= 3 && m <= 5) return "Spring";
          if (m >= 6 && m <= 8) return "Summer";
          if (m >= 9 && m <= 11) return "Autumn";
          return "Winter";
        };
        const counts: Record<string, Record<string, number>> = { Spring: {}, Summer: {}, Autumn: {}, Winter: {} };
        for (const log of logs) {
          const season = getSeason(log.date as string);
          for (const id of (log.collection_item_ids as string[])) {
            const name = idToName[id];
            if (name) counts[season][name] = (counts[season][name] ?? 0) + 1;
          }
        }
        const result: Record<string, { name: string; count: number }[]> = {};
        for (const [season, perfumeCounts] of Object.entries(counts)) {
          const sorted = Object.entries(perfumeCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([name, count]) => ({ name, count }));
          if (sorted.length) result[season] = sorted;
        }
        setSeasonalData(result);
      });
  }, [user]);

  useEffect(() => {
    if (!user || closetCount === 0) return;
    const supabase = createClient();
    setLoadingRecs(true);
    supabase
      .from("scent_logs")
      .select("collection_item_ids")
      .eq("user_id", user.id)
      .limit(50)
      .then(async ({ data: logs }) => {
        const ids = [...new Set(logs?.flatMap((l) => l.collection_item_ids) ?? [])];
        if (ids.length === 0) { setLoadingRecs(false); return; }
        const { data: items } = await supabase
          .from("collection_items")
          .select("perfume:perfumes(name, brand)")
          .in("id", ids.slice(0, 10));
        const topPerfumes = (items?.map((i: { perfume: { name: string; brand: string }[] }) => i.perfume?.[0]?.name).filter(Boolean) as string[]).slice(0, 5);
        const topBrands = [...new Set(items?.map((i: { perfume: { name: string; brand: string }[] }) => i.perfume?.[0]?.brand).filter(Boolean) as string[])].slice(0, 5);
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topPerfumes, topBrands, topNotes: [], topFamilies: [] }),
        });
        const { recommendations: recs } = await res.json();
        setRecommendations(recs ?? []);
        setLoadingRecs(false);
      });
  }, [user, closetCount]);

  const logsByDate = recentLogs.reduce<Record<string, ScentLog>>((acc, log) => {
    acc[log.date] = log;
    return acc;
  }, {});

  function openRec(rec: Rec) {
    setSelectedRec(rec);
    setAddCollection("closet");
    setAddSizes([]);
    setAddLevel("full");
    setAddSeasons([]);
    setAddOccasions([]);
    setAddRating(0);
    setAddPrices({});
  }

  async function fetchAddPrices(sizes: string[], rec: Rec) {
    if (sizes.length === 0) return;
    setAddingPrices(true);
    try {
      const res = await fetch("/api/perfume/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: rec.name, brand: rec.brand, sizes }),
      });
      const data = await res.json();
      const map: Record<string, { min: number; max: number }> = {};
      for (const p of data.prices ?? []) map[p.size] = { min: p.price_min, max: p.price_max };
      setAddPrices(map);
    } finally {
      setAddingPrices(false);
    }
  }

  function toggleAddSize(size: string) {
    const next = addSizes.includes(size) ? addSizes.filter((s) => s !== size) : [...addSizes, size];
    setAddSizes(next);
    if (selectedRec) fetchAddPrices(next, selectedRec);
  }

  async function saveRec() {
    if (!selectedRec || !user) return;
    setAddSaving(true);
    try {
      const supabase = createClient();

      // Fetch image from Fragrantica if none
      let imageUrl = selectedRec.image_url ?? null;
      if (!imageUrl) {
        const res = await fetch("/api/perfume/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: selectedRec.name, brand: selectedRec.brand }),
        });
        const data = await res.json();
        imageUrl = data.image_url ?? null;
      }

      const { data: perfumeData, error: perfumeErr } = await supabase
        .from("perfumes")
        .upsert({
          name: selectedRec.name,
          brand: selectedRec.brand,
          image_url: imageUrl,
          top_notes: [],
          heart_notes: [],
          base_notes: [],
          fragrance_family: [],
        }, { onConflict: "name,brand", ignoreDuplicates: false })
        .select()
        .single();

      if (perfumeErr) throw perfumeErr;

      const sizesPrices = addSizes.map((s) => ({
        size: s,
        price_min: addPrices[s]?.min ?? null,
        price_max: addPrices[s]?.max ?? null,
        currency: "USD",
      }));

      const { error: itemErr } = await supabase.from("collection_items").insert({
        user_id: user.id,
        perfume_id: perfumeData.id,
        collection_type: addCollection,
        bottle_sizes: addSizes,
        size_prices: sizesPrices,
        occasions: addOccasions,
        seasons: addSeasons,
        rating: addRating > 0 ? addRating : null,
        initial_level: addLevel,
        estimated_level: addLevel,
      });

      if (itemErr) throw itemErr;

      toast.success(`Added to your ${COLLECTION_TYPES.find((c) => c.value === addCollection)?.label}!`);
      checkAndAwardBadges(user.id);
      setSelectedRec(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <AppShell>
      <div>
        {/* Header */}
        <div className="px-4 pt-12 pb-6 bg-gradient-to-b from-plum-50 to-background">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="font-display text-3xl text-primary">Sally</h1>
              <p className="text-sm text-muted-foreground">
                {user
                  ? `Welcome back, ${user.user_metadata?.display_name ?? user.email?.split("@")[0]}`
                  : "Your fragrance universe"}
              </p>
            </div>
            {user ? (
              <Link href="/profile">
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
              </Link>
            ) : (
              <Link href="/sign-in">
                <Button size="sm" variant="outline" className="h-8 text-xs">Sign in</Button>
              </Link>
            )}
          </div>
        </div>

        {user ? (
          <>
            {/* Scent calendar */}
            <div className="px-4 pb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg">This Week</h2>
                <Link href="/scent-log">
                  <Button size="sm" className="h-7 gap-1 text-xs">
                    <Plus className="w-3 h-3" /> Log today
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {last7.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const log = logsByDate[key];
                  const isToday = key === format(new Date(), "yyyy-MM-dd");
                  return (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{format(day, "EEE")}</span>
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center border transition-colors",
                        log ? "bg-primary border-primary" : "bg-muted/50 border-border",
                        isToday && !log && "border-primary/50"
                      )}>
                        {log ? (
                          <Droplets className="w-4 h-4 text-primary-foreground" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{format(day, "d")}</span>
                        )}
                      </div>
                      {log?.rating && (
                        <span className="text-[9px] text-muted-foreground">{log.rating}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick actions */}
            <div className="px-4 pb-6 grid grid-cols-2 gap-3">
              {[
                { label: "Add fragrance", href: "/discover", icon: Plus },
                { label: "Scent Journal", href: "/scent-journal", icon: BookOpen },
                { label: "Layering", href: "/layering", icon: Layers },
                { label: "Insights", href: "/insights", icon: Sparkles },
              ].map((a) => (
                <Link key={a.href} href={a.href}>
                  <div className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:border-primary/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-plum-100 flex items-center justify-center shrink-0">
                      <a.icon className="w-4 h-4 text-plum-800" />
                    </div>
                    <span className="text-sm font-medium leading-tight">{a.label}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Seasonal patterns */}
            {Object.keys(seasonalData).length > 0 && (
              <div className="px-4 pb-6">
                <h2 className="font-display text-lg mb-3">By Season</h2>
                <div className="grid grid-cols-2 gap-2">
                  {(["Spring", "Summer", "Autumn", "Winter"] as const).filter((s) => seasonalData[s]).map((season) => {
                    const emoji = { Spring: "🌸", Summer: "☀️", Autumn: "🍂", Winter: "❄️" }[season];
                    return (
                      <div key={season} className="bg-card border border-border rounded-2xl p-3 space-y-2">
                        <p className="text-xs font-semibold">{emoji} {season}</p>
                        <div className="space-y-1">
                          {seasonalData[season].map(({ name, count }) => (
                            <div key={name} className="flex items-center justify-between gap-1">
                              <p className="text-[11px] text-muted-foreground truncate flex-1">{name}</p>
                              <span className="text-[10px] text-primary font-medium shrink-0">{count}×</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {(recommendations.length > 0 || loadingRecs) && (
              <div className="px-4 pb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg">For You</h2>
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                  {recommendations.slice(0, 6).map((rec, i) => (
                    <button
                      key={i}
                      onClick={() => openRec(rec)}
                      className="shrink-0 w-36 bg-card rounded-2xl border border-border overflow-hidden text-left hover:border-primary/40 active:scale-[0.97] transition-all"
                    >
                      <div className="w-full h-36 bg-plum-50 flex items-center justify-center">
                        {proxyImageUrl(rec.image_url) ? (
                          <Image src={proxyImageUrl(rec.image_url)!} alt={rec.name} width={120} height={120} className="object-contain" unoptimized />
                        ) : (
                          <Droplets className="w-10 h-10 text-plum-300" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] text-muted-foreground truncate">{rec.brand}</p>
                        <p className="text-xs font-medium line-clamp-2 leading-tight">{rec.name}</p>
                        {rec.reason && <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">{rec.reason}</p>}
                        <p className="text-[9px] text-primary mt-1.5 font-medium">+ Add to collection</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Guest landing */
          <div className="px-4 py-8 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-plum-100 flex items-center justify-center mx-auto">
                <Droplets className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl mb-2">Track Your Collection</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Discover, organise and explore your personal fragrance universe. Log daily scents, find your next obsession.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Link href="/sign-up" className="w-full">
                  <Button className="w-full h-11">Get started — it&apos;s free</Button>
                </Link>
                <Link href="/sign-in" className="w-full">
                  <Button variant="ghost" className="w-full h-11">Sign in</Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { title: "Smart Search", desc: "Find any perfume by name or photo" },
                { title: "Olfa AI", desc: "Your personal fragrance advisor" },
                { title: "Scent Journal", desc: "Track what you wear and how it performs" },
                { title: "Layering", desc: "Discover perfect fragrance combinations" },
              ].map((f) => (
                <div key={f.title} className="bg-card border border-border rounded-xl p-3">
                  <p className="text-sm font-semibold font-display mb-0.5">{f.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">Want to identify a perfume first?</p>
              <Link href="/discover">
                <Button variant="outline" className="gap-2">
                  Try photo search <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Add recommendation to collection sheet */}
      <Sheet open={!!selectedRec} onOpenChange={(open) => { if (!open) setSelectedRec(null); }}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          {selectedRec && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-14 h-14 rounded-xl bg-plum-50 flex items-center justify-center shrink-0 overflow-hidden">
                    {proxyImageUrl(selectedRec.image_url) ? (
                      <Image src={proxyImageUrl(selectedRec.image_url)!} alt={selectedRec.name} width={56} height={56} className="object-contain" unoptimized />
                    ) : (
                      <Droplets className="w-7 h-7 text-plum-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{selectedRec.brand}</p>
                    <SheetTitle className="font-display text-lg text-left">{selectedRec.name}</SheetTitle>
                    {selectedRec.reason && <p className="text-xs text-muted-foreground mt-0.5">{selectedRec.reason}</p>}
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5">
                {/* Collection type */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add to</label>
                  <div className="grid grid-cols-3 gap-2">
                    {COLLECTION_TYPES.map((ct) => (
                      <button key={ct.value} onClick={() => setAddCollection(ct.value as typeof addCollection)}
                        className={cn("py-2 px-1 rounded-xl text-[11px] font-medium border transition-colors text-center",
                          addCollection === ct.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border")}>
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bottle sizes */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bottle size(s)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {BOTTLE_SIZES.map((bs) => (
                      <button key={bs.value} onClick={() => toggleAddSize(bs.value)}
                        className={cn("px-2.5 py-1 rounded-lg text-xs border transition-colors",
                          addSizes.includes(bs.value) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border")}>
                        {bs.label}
                      </button>
                    ))}
                  </div>
                  {addingPrices && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Fetching prices…</p>}
                  {Object.keys(addPrices).length > 0 && (
                    <div className="space-y-0.5">
                      {addSizes.filter((s) => addPrices[s]).map((s) => (
                        <p key={s} className="text-xs text-muted-foreground">
                          {BOTTLE_SIZES.find((b) => b.value === s)?.label}: <span className="font-medium text-foreground">${addPrices[s].min}–${addPrices[s].max}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Level (closet only) */}
                {addCollection === "closet" && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current level</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRODUCT_LEVELS.map((l) => (
                        <button key={l} onClick={() => setAddLevel(l)}
                          className={cn("px-2.5 py-1 rounded-lg text-xs border transition-colors",
                            addLevel === l ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border")}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seasons */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seasons</label>
                  <MultiSelect options={SEASONS} value={addSeasons} onChange={setAddSeasons} placeholder="Select seasons…" />
                </div>

                {/* Occasions */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Occasions</label>
                  <MultiSelect options={OCCASIONS} value={addOccasions} onChange={setAddOccasions} placeholder="Select occasions…" />
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rating — <span className="text-primary">{addRating > 0 ? `${addRating}/10` : "–"}</span>
                  </label>
                  <Slider min={0} max={10} step={0.5} value={[addRating]} onValueChange={([v]) => setAddRating(v)} />
                </div>

                <Button className="w-full h-11" onClick={saveRec} disabled={addSaving}>
                  {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Add to ${COLLECTION_TYPES.find((c) => c.value === addCollection)?.label}`}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
