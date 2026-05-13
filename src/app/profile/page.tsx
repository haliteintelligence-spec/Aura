"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { levelToFraction, formatPrice, COLLECTION_TYPES, FRAGRANCE_FAMILIES, proxyImageUrl } from "@/lib/utils";
import type { CollectionItem, LayerCombo } from "@/lib/types";
import { toast } from "sonner";
import {
  User, Edit2, Check, X, Loader2, AlertTriangle,
  TrendingUp, LogOut, Droplets, ChevronRight, Layers
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [savedCombos, setSavedCombos] = useState<LayerCombo[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.user_metadata?.display_name ?? "");
    const supabase = createClient();
    Promise.all([
      supabase.from("collection_items").select("*, perfume:perfumes(*)").eq("user_id", user.id),
      supabase.from("layer_combos").select("*").eq("user_id", user.id).eq("saved", true).order("created_at", { ascending: false }),
    ]).then(([{ data: itemData }, { data: comboData }]) => {
      setItems((itemData as CollectionItem[]) ?? []);
      setSavedCombos((comboData as LayerCombo[]) ?? []);
      setDataLoading(false);
    });
  }, [user]);

  async function saveName() {
    setSavingName(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
    if (!error) {
      await supabase.from("profiles").update({ display_name: displayName }).eq("id", user!.id);
      toast.success("Name updated");
      setEditingName(false);
    } else {
      toast.error("Failed to update name");
    }
    setSavingName(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return <AppShell><div className="flex justify-center pt-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AppShell>;
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
          <p className="text-muted-foreground">Sign in to view your profile</p>
          <Link href="/sign-in"><Button>Sign in</Button></Link>
        </div>
      </AppShell>
    );
  }

  // Collection value by type
  const valueByType = COLLECTION_TYPES.map(({ value, label }) => {
    const typeItems = items.filter((i) => i.collection_type === value);
    const total = typeItems.reduce((sum, item) => {
      const maxPrice = Math.max(...(item.size_prices?.map((p) => p.price_max ?? 0) ?? [0]));
      return sum + maxPrice;
    }, 0);
    return { value, label, total, count: typeItems.length };
  });

  // Low level items (≤3/8)
  const lowItems = items.filter((i) => i.collection_type === "closet" && levelToFraction(i.estimated_level) <= 0.375);

  // Scent map data
  const familyCounts: Record<string, number> = {};
  for (const item of items) {
    for (const f of item.perfume?.fragrance_family ?? []) {
      familyCounts[f] = (familyCounts[f] ?? 0) + 1;
    }
  }
  const scentMap = FRAGRANCE_FAMILIES.map((f) => ({ family: f, count: familyCounts[f] ?? 0 }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <AppShell>
      <div className="px-4 pt-8 pb-8 space-y-6">

        {/* Profile card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-plum-100 flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <button onClick={saveName} disabled={savingName} className="text-primary">
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setEditingName(false)} className="text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-display text-lg truncate">{displayName || "Add your name"}</p>
                  <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2 text-muted-foreground" onClick={signOut}>
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </Button>
        </div>

        {/* Collection value */}
        <section className="space-y-3">
          <h2 className="font-display text-lg">Collection Value</h2>
          <div className="space-y-2">
            {valueByType.map(({ value, label, total, count }) => (
              <Link key={value} href={`/${value === "owned_before" ? "owned-before" : value}`}>
                <div className="bg-card border border-border rounded-xl p-3.5 flex items-center justify-between hover:border-primary/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{count} fragrance{count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-lg text-primary">{formatPrice(total)}</p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Low level alert */}
        {lowItems.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="font-display text-base">Running Low</h2>
            </div>
            <div className="space-y-2">
              {lowItems.map((item) => (
                <div key={item.id} className="bg-card border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-plum-50 flex items-center justify-center shrink-0">
                    {item.perfume?.image_url ? (
                      <Image src={item.perfume.image_url} alt="" width={40} height={40} className="object-contain" unoptimized />
                    ) : (
                      <Droplets className="w-5 h-5 text-plum-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.perfume?.name}</p>
                    <Progress value={Math.round(levelToFraction(item.estimated_level) * 100)} className="h-1.5 mt-1" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.estimated_level} remaining</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Scent map */}
        {scentMap.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-display text-base">Scent Map</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-2.5">
              {scentMap.map(({ family, count }) => {
                const max = scentMap[0].count;
                return (
                  <button
                    key={family}
                    className="w-full space-y-1 text-left hover:opacity-80 transition-opacity"
                    onClick={() => setSelectedFamily(family)}
                  >
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{family}</span>
                      <span className="text-muted-foreground">{count} fragrance{count !== 1 ? "s" : ""} →</span>
                    </div>
                    <Progress value={(count / max) * 100} className="h-2" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Scent family detail dialog */}
        <Dialog open={!!selectedFamily} onOpenChange={(open) => { if (!open) setSelectedFamily(null); }}>
          <DialogContent className="max-w-sm mx-auto max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{selectedFamily}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              {items
                .filter((item) => item.perfume?.fragrance_family?.includes(selectedFamily ?? ""))
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/50">
                    <div className="w-10 h-10 rounded-lg bg-plum-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {proxyImageUrl(item.perfume?.image_url) ? (
                        <Image src={proxyImageUrl(item.perfume!.image_url)!} alt="" width={40} height={40} className="object-contain" unoptimized />
                      ) : (
                        <Droplets className="w-5 h-5 text-plum-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.perfume?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.perfume?.brand}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0 ml-auto capitalize">{item.collection_type.replace("_", " ")}</Badge>
                  </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Saved Combos */}
        {savedCombos.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="font-display text-base">Saved Combos</h2>
              </div>
              <Link href="/layering" className="text-xs text-primary">See all</Link>
            </div>
            <div className="space-y-2">
              {savedCombos.slice(0, 5).map((combo) => (
                <Link key={combo.id} href="/layering">
                  <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 hover:border-primary/30 transition-colors">
                    <p className="text-sm font-medium">{combo.name ?? "Unnamed combo"}</p>
                    {combo.combined_profile && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{combo.combined_profile}</p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {combo.occasion?.slice(0, 2).map((o) => (
                        <span key={o} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{o}</span>
                      ))}
                      {combo.season?.slice(0, 1).map((s) => (
                        <span key={s} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Links */}
        <section className="space-y-2">
          {[
            { href: "/insights", label: "View Insights" },
            { href: "/swap", label: "Swap Marketplace" },
          ].map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="bg-card border border-border rounded-xl p-3.5 flex items-center justify-between hover:border-primary/30 transition-colors">
                <span className="text-sm font-medium">{link.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
