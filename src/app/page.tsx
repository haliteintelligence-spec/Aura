"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { format, subDays } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { Droplets, Sparkles, BookOpen, Plus, ChevronRight, User } from "lucide-react";
import type { ScentLog } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { user } = useUser();
  const [recentLogs, setRecentLogs] = useState<ScentLog[]>([]);
  const [recommendations, setRecommendations] = useState<{ name: string; brand: string; image_url?: string; reason?: string }[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [closetCount, setClosetCount] = useState(0);

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

  return (
    <AppShell>
      <div>
        {/* Header */}
        <div className="px-4 pt-12 pb-6 bg-gradient-to-b from-plum-50 to-background">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="font-display text-3xl text-primary">Aura</h1>
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
            <div className="px-4 pb-6 grid grid-cols-3 gap-3">
              {[
                { label: "Add fragrance", href: "/discover", icon: Plus },
                { label: "Scent log", href: "/scent-log", icon: BookOpen },
                { label: "Insights", href: "/insights", icon: Sparkles },
              ].map((a) => (
                <Link key={a.href} href={a.href}>
                  <div className="bg-card border border-border rounded-2xl p-3 flex flex-col items-center gap-2 hover:border-primary/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-plum-100 flex items-center justify-center">
                      <a.icon className="w-4 h-4 text-plum-800" />
                    </div>
                    <span className="text-[11px] font-medium text-center leading-tight">{a.label}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Recommendations */}
            {(recommendations.length > 0 || loadingRecs) && (
              <div className="px-4 pb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg">For You</h2>
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                  {recommendations.slice(0, 6).map((rec, i) => (
                    <div key={i} className="shrink-0 w-36 bg-card rounded-2xl border border-border overflow-hidden">
                      <div className="w-full h-36 bg-plum-50 flex items-center justify-center">
                        {rec.image_url ? (
                          <Image src={rec.image_url} alt={rec.name} width={120} height={120} className="object-contain" unoptimized />
                        ) : (
                          <Droplets className="w-10 h-10 text-plum-300" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] text-muted-foreground truncate">{rec.brand}</p>
                        <p className="text-xs font-medium line-clamp-2 leading-tight">{rec.name}</p>
                        {rec.reason && <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">{rec.reason}</p>}
                      </div>
                    </div>
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
                { title: "Scent Log", desc: "Track what you wear and how it performs" },
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
    </AppShell>
  );
}
