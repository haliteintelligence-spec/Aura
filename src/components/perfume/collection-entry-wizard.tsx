"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { PhotoCapture } from "./photo-capture";
import { cn, BOTTLE_SIZES, SEASONS, OCCASIONS, PRODUCT_LEVELS, COLLECTION_TYPES, proxyImageUrl } from "@/lib/utils";
import type { PerfumeSearchResult } from "@/lib/types";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, RefreshCw, Droplets } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { checkAndAwardBadges } from "@/lib/badges";
import { useRouter } from "next/navigation";

type Step = "find" | "confirm" | "details" | "done";

interface WizardProps {
  initialCollection?: "closet" | "wishlist" | "owned_before";
}

export function CollectionEntryWizard({ initialCollection = "closet" }: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("find");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PerfumeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<PerfumeSearchResult[]>([]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());
  // Catalog for client-side filtering (brand or name mode)
  const [catalog, setCatalog] = useState<PerfumeSearchResult[]>([]);
  const [catalogMode, setCatalogMode] = useState<"brand" | "name" | null>(null);
  const [catalogBrand, setCatalogBrand] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Details state
  const [collection, setCollection] = useState<"closet" | "wishlist" | "owned_before">(initialCollection);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [level, setLevel] = useState("full");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [prices, setPrices] = useState<Record<string, { min: number; max: number }>>({});
  const [userPhotoFile, setUserPhotoFile] = useState<File | null>(null);

  const selected = candidates[candidateIdx];

  // Returns true if any word in `name` starts with `filter`
  function wordStartsWithFilter(name: string, filter: string): boolean {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return name.toLowerCase().split(/\s+/).some((w) => w.startsWith(f));
  }

  async function doSearch(q: string) {
    setSearching(true);
    try {
      const res = await fetch("/api/perfume/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      const mode: "brand" | "name" = data.mode ?? "name";
      const brand: string = data.brand ?? "";
      const results: PerfumeSearchResult[] = data.results ?? [];

      setCatalogMode(mode);
      setCatalogBrand(brand);
      setCatalog(results);

      // Apply any trailing filter text that's already been typed
      let display = results;
      if (mode === "brand" && brand) {
        const filterText = q.slice(brand.length).trim();
        display = results.filter((p) => wordStartsWithFilter(p.name, filterText));
      }
      setSuggestions(display.slice(0, 30));
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }

  function handleInput(q: string) {
    setQuery(q);

    if (q.length < 2) {
      setSuggestions([]);
      setCatalog([]);
      setCatalogMode(null);
      setCatalogBrand("");
      if (searchTimer.current) clearTimeout(searchTimer.current);
      return;
    }

    // ── Brand mode: user is still within the detected brand context ──
    if (catalogMode === "brand" && catalogBrand && q.toLowerCase().startsWith(catalogBrand.toLowerCase())) {
      const filterText = q.slice(catalogBrand.length).trim();
      const filtered = catalog.filter((p) => wordStartsWithFilter(p.name, filterText));
      setSuggestions(filtered.slice(0, 30));
      return;
    }

    // ── Name mode: refine within cached name results ──
    if (catalogMode === "name" && catalog.length > 0) {
      const filtered = catalog.filter((p) => p.name.toLowerCase().startsWith(q.toLowerCase()));
      if (filtered.length > 0) {
        setSuggestions(filtered.slice(0, 20));
        return;
      }
      // Fell through — query diverged; fetch fresh
    }

    // ── Debounce new API call ──
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(q), 380);
  }

  async function selectSuggestion(p: PerfumeSearchResult) {
    const rest = suggestions.filter((s) => !(s.name === p.name && s.brand === p.brand));
    const allCandidates = [p, ...rest];
    const initialSeen = new Set(allCandidates.map((c) => `${c.brand}||${c.name}`));
    setCandidates(allCandidates);
    setSeenKeys(initialSeen);
    setCandidateIdx(0);
    setSuggestions([]);
    setQuery(`${p.brand} ${p.name}`);
    setStep("confirm");
    // Enrich selected perfume with Fragrantica photo + notes in background
    try {
      const res = await fetch("/api/perfume/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name, brand: p.brand }),
      });
      const data = await res.json();
      const enriched = { ...p };
      if (data.image_url) enriched.image_url = data.image_url;
      if (data.top_notes?.length) enriched.top_notes = data.top_notes;
      if (data.heart_notes?.length) enriched.heart_notes = data.heart_notes;
      if (data.base_notes?.length) enriched.base_notes = data.base_notes;
      if (data.description) enriched.description = data.description;
      setCandidates((prev) => [enriched, ...prev.slice(1)]);
    } catch {}
  }

  async function suggestMore() {
    setLoadingMore(true);
    try {
      let fresh: PerfumeSearchResult[] = [];
      if (userPhotoFile) {
        const formData = new FormData();
        formData.append("image", userPhotoFile);
        const res = await fetch("/api/perfume/identify", { method: "POST", body: formData });
        const data = await res.json();
        fresh = data.results || data || [];
      } else {
        const res = await fetch("/api/perfume/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        fresh = data.results || [];
      }
      const novel = fresh.filter((r) => !seenKeys.has(`${r.brand}||${r.name}`));
      if (novel.length === 0) {
        toast.error("No more suggestions found. Try searching by name.");
        return;
      }
      setSeenKeys((prev) => {
        const next = new Set(prev);
        novel.forEach((r) => next.add(`${r.brand}||${r.name}`));
        return next;
      });
      setCandidates((prev) => [...prev, ...novel]);
      setCandidateIdx((i) => i + 1);
    } catch {
      toast.error("Couldn't fetch more suggestions");
    } finally {
      setLoadingMore(false);
    }
  }

  function handlePhotoResult(result: PerfumeSearchResult[]) {
    if (result.length > 0) {
      setCandidates(result);
      setSeenKeys(new Set(result.map((r) => `${r.brand}||${r.name}`)));
      setCandidateIdx(0);
      setStep("confirm");
    } else {
      toast.error("Couldn't identify the perfume. Try searching by name.");
    }
  }

  async function fetchPrices(sizes: string[]) {
    if (!selected || sizes.length === 0) return;
    setLoadingPrices(true);
    try {
      const res = await fetch("/api/perfume/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected.name, brand: selected.brand, sizes }),
      });
      const data = await res.json();
      const map: Record<string, { min: number; max: number }> = {};
      for (const p of data.prices || []) {
        map[p.size] = { min: p.price_min, max: p.price_max };
      }
      setPrices(map);
    } finally {
      setLoadingPrices(false);
    }
  }

  function toggleSize(size: string) {
    const next = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(next);
    fetchPrices(next);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please sign in to save to your collection"); return; }

      // Upload user photo if present
      let imageUrl = selected.image_url ?? null;
      if (userPhotoFile) {
        const mimeType = userPhotoFile.type || "image/jpeg";
        const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("perfume-photos")
          .upload(path, userPhotoFile, { contentType: mimeType, upsert: true });
        if (uploadError) {
          toast.error(`Photo upload failed: ${uploadError.message}`);
        } else if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from("perfume-photos").getPublicUrl(uploadData.path);
          imageUrl = publicUrl;
        }
      } else if (imageUrl && !imageUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "supabase.co")) {
        // Cache external image (e.g. Fragrantica CDN) permanently in Supabase Storage
        try {
          const proxyRes = await fetch(`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`);
          if (proxyRes.ok) {
            const blob = await proxyRes.blob();
            const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
            const slug = `${selected.brand}_${selected.name}`.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 80);
            const path = `product/${slug}.${ext}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("perfume-images")
              .upload(path, blob, { contentType: blob.type, upsert: true });
            if (!uploadError && uploadData) {
              const { data: { publicUrl } } = supabase.storage.from("perfume-images").getPublicUrl(uploadData.path);
              imageUrl = publicUrl;
            }
          }
        } catch { /* non-critical — fall back to original external URL */ }
      }

      // Upsert perfume
      const { data: perfumeData, error: perfumeErr } = await supabase
        .from("perfumes")
        .upsert({
          name: selected.name,
          brand: selected.brand,
          year: selected.year,
          description: selected.description,
          top_notes: selected.top_notes || [],
          heart_notes: selected.heart_notes || [],
          base_notes: selected.base_notes || [],
          fragrance_family: selected.fragrance_family || [],
          gender: selected.gender,
          image_url: imageUrl,
        }, { onConflict: "name,brand", ignoreDuplicates: false })
        .select()
        .single();

      if (perfumeErr) throw perfumeErr;

      const sizesPrices = selectedSizes.map((s) => ({
        size: s,
        price_min: prices[s]?.min ?? null,
        price_max: prices[s]?.max ?? null,
        currency: "USD",
      }));

      const { error: itemErr } = await supabase.from("collection_items").insert({
        user_id: user.id,
        perfume_id: perfumeData.id,
        collection_type: collection,
        bottle_sizes: selectedSizes,
        size_prices: sizesPrices,
        occasions,
        seasons,
        rating: rating > 0 ? rating : null,
        initial_level: level,
        estimated_level: level,
      });

      if (itemErr) throw itemErr;

      toast.success(`Added to your ${COLLECTION_TYPES.find((c) => c.value === collection)?.label}!`);
      checkAndAwardBadges(user.id);
      setStep("done");
      setTimeout(() => router.push(`/${collection === "owned_before" ? "owned-before" : collection}`), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Step: find ──────────────────────────────────────────────────────────────
  if (step === "find") {
    return (
      <div className="space-y-6 p-4">
        <div>
          <h2 className="font-display text-xl mb-1">Find a Perfume</h2>
          <p className="text-sm text-muted-foreground">Search by name or take a photo of the bottle</p>
        </div>

        {/* Text search */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search brand or fragrance name…"
            className="w-full h-11 px-4 pr-10 border border-input rounded-xl bg-background text-sm focus:outline-none focus:border-primary"
          />
          {searching && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />}

          {suggestions.length > 0 && (
            <div className="absolute top-12 left-0 right-0 z-30 bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col">
              {catalogMode === "brand" && catalogBrand && (
                <div className="px-4 py-2 bg-muted/60 border-b border-border">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {catalogBrand} · {suggestions.length} result{suggestions.length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
              <div className="overflow-y-auto max-h-64">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors border-b border-border last:border-0"
                  >
                    <p className="text-sm font-medium leading-snug">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.brand}{s.year ? ` · ${s.year}` : ""}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        {/* Photo */}
        <PhotoCapture onResult={handlePhotoResult} onPhoto={setUserPhotoFile} />
      </div>
    );
  }

  // ── Step: confirm ───────────────────────────────────────────────────────────
  if (step === "confirm" && selected) {
    return (
      <div className="space-y-5 p-4">
        <button onClick={() => setStep("find")} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <h2 className="font-display text-xl">Is this the one?</h2>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="aspect-square max-h-56 bg-plum-50 flex items-center justify-center">
            {proxyImageUrl(selected.image_url) ? (
              <Image src={proxyImageUrl(selected.image_url)!} alt={selected.name} width={200} height={200} className="object-contain" unoptimized />
            ) : (
              <Droplets className="w-16 h-16 text-plum-300" />
            )}
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{selected.brand}</p>
              <h3 className="font-display text-lg">{selected.name}</h3>
              {selected.year && <p className="text-xs text-muted-foreground">{selected.year}</p>}
            </div>
            {selected.description && <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>}
            <div className="space-y-1.5">
              {selected.top_notes?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground w-12">Top</span>
                  {selected.top_notes.map((n) => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
                </div>
              )}
              {selected.heart_notes?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground w-12">Heart</span>
                  {selected.heart_notes.map((n) => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
                </div>
              )}
              {selected.base_notes?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground w-12">Base</span>
                  {selected.base_notes.map((n) => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            disabled={loadingMore}
            onClick={() => {
              if (candidateIdx < candidates.length - 1) {
                setCandidateIdx((i) => i + 1);
              } else {
                suggestMore();
              }
            }}
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Not this one
          </Button>
          <Button className="flex-1 gap-2" onClick={() => setStep("details")}>
            Yes, that's it <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: details ───────────────────────────────────────────────────────────
  if (step === "details") {
    return (
      <div className="space-y-6 p-4">
        <button onClick={() => setStep("confirm")} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2 className="font-display text-xl">Add to Collection</h2>
          <p className="text-sm text-muted-foreground">{selected?.brand} · {selected?.name}</p>
        </div>

        {/* Collection type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Add to</label>
          <div className="grid grid-cols-3 gap-2">
            {COLLECTION_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setCollection(ct.value as typeof collection)}
                className={cn(
                  "py-2.5 px-2 rounded-xl text-xs font-medium border transition-colors text-center",
                  collection === ct.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-foreground hover:border-primary/50"
                )}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottle sizes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Bottle size(s)</label>
          <div className="flex flex-wrap gap-2">
            {BOTTLE_SIZES.map((bs) => (
              <button
                key={bs.value}
                onClick={() => toggleSize(bs.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs border transition-colors",
                  selectedSizes.includes(bs.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary/50"
                )}
              >
                {bs.label}
              </button>
            ))}
          </div>
          {loadingPrices && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Fetching prices…</p>}
          {Object.keys(prices).length > 0 && (
            <div className="space-y-1">
              {selectedSizes.filter((s) => prices[s]).map((s) => {
                const label = BOTTLE_SIZES.find((b) => b.value === s)?.label;
                const p = prices[s];
                return (
                  <p key={s} className="text-xs text-muted-foreground">
                    {label}: <span className="font-medium text-foreground">${p.min}–${p.max}</span>
                  </p>
                );
              })}
            </div>
          )}
        </div>

        {/* Level (only for closet) */}
        {collection === "closet" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Current level</label>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs border transition-colors",
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
          <label className="text-sm font-medium">Best seasons</label>
          <MultiSelect options={SEASONS} value={seasons} onChange={setSeasons} placeholder="Select seasons…" />
        </div>

        {/* Occasions */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Occasions</label>
          <MultiSelect options={OCCASIONS} value={occasions} onChange={setOccasions} placeholder="Select occasions…" />
        </div>

        {/* Rating */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Your rating: <span className="text-primary">{rating > 0 ? `${rating}/10` : "–"}</span></label>
          <Slider
            min={0} max={10} step={0.5}
            value={[rating]}
            onValueChange={([v]) => setRating(v)}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0</span><span>5</span><span>10</span>
          </div>
        </div>

        <Button className="w-full h-12 text-base" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save to Collection"}
        </Button>
      </div>
    );
  }

  // ── Step: done ──────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 px-4">
        <CheckCircle2 className="w-16 h-16 text-primary" />
        <h2 className="font-display text-2xl">Added!</h2>
        <p className="text-muted-foreground text-center text-sm">Your fragrance has been saved to your collection.</p>
      </div>
    );
  }

  return null;
}
