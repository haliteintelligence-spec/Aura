"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MostWornChart, OccasionPieChart, MoodBarChart, BrandRatingChart } from "@/components/insights/charts";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ScentLog } from "@/lib/types";

export default function InsightsPage() {
  const { user } = useUser();
  const [logs, setLogs] = useState<ScentLog[]>([]);
  const [items, setItems] = useState<{ id: string; perfume: { name: string; brand: string } | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const supabase = createClient();
    Promise.all([
      supabase.from("scent_logs").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("collection_items").select("id, perfume:perfumes(name, brand)").eq("user_id", user.id),
    ]).then(([{ data: logData }, { data: itemData }]) => {
      setLogs((logData as ScentLog[]) ?? []);
      setItems((itemData as any[]) ?? []);
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
          <p className="text-muted-foreground">Sign in to see your insights</p>
          <Link href="/sign-in"><Button>Sign in</Button></Link>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center pt-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </AppShell>
    );
  }

  if (logs.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
          <p className="text-muted-foreground">No logs yet — start logging your daily scents!</p>
          <Link href="/scent-log"><Button>Log today&apos;s scent</Button></Link>
        </div>
      </AppShell>
    );
  }

  const itemMap = Object.fromEntries(items.map((i) => [i.id, i.perfume]));

  // Most worn
  const wornCount: Record<string, number> = {};
  for (const log of logs) {
    for (const id of log.collection_item_ids ?? []) {
      const name = itemMap[id]?.name;
      if (name) wornCount[name] = (wornCount[name] ?? 0) + 1;
    }
  }
  const mostWorn = Object.entries(wornCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.length > 14 ? name.slice(0, 12) + "…" : name, value }));

  // Occasion breakdown
  const occasionCount: Record<string, number> = {};
  for (const log of logs) {
    if (log.event_type) occasionCount[log.event_type] = (occasionCount[log.event_type] ?? 0) + 1;
  }
  const occasions = Object.entries(occasionCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([name, value]) => ({ name, value }));

  // Mood distribution
  const moodCount: Record<string, number> = {};
  for (const log of logs) {
    for (const m of log.mood ?? []) {
      moodCount[m] = (moodCount[m] ?? 0) + 1;
    }
  }
  const moods = Object.entries(moodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.length > 8 ? name.slice(0, 7) + "…" : name, value }));

  // Brand avg rating
  const brandRatings: Record<string, number[]> = {};
  for (const log of logs) {
    if (!log.rating) continue;
    for (const id of log.collection_item_ids ?? []) {
      const brand = itemMap[id]?.brand;
      if (brand) {
        if (!brandRatings[brand]) brandRatings[brand] = [];
        brandRatings[brand].push(log.rating);
      }
    }
  }
  const brandAvg = Object.entries(brandRatings)
    .map(([name, ratings]) => ({ name, value: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-8 space-y-8">
        <div>
          <h1 className="font-display text-2xl">Insights</h1>
          <p className="text-sm text-muted-foreground">{logs.length} log entries analysed</p>
        </div>

        {mostWorn.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base">Most Worn Fragrances</h2>
            <div className="bg-card border border-border rounded-2xl p-3">
              <MostWornChart data={mostWorn} />
            </div>
          </section>
        )}

        {occasions.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base">Occasion Breakdown</h2>
            <div className="bg-card border border-border rounded-2xl p-3">
              <OccasionPieChart data={occasions} />
            </div>
          </section>
        )}

        {moods.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base">Mood Distribution</h2>
            <div className="bg-card border border-border rounded-2xl p-3">
              <MoodBarChart data={moods} />
            </div>
          </section>
        )}

        {brandAvg.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base">Average Rating by Brand</h2>
            <div className="bg-card border border-border rounded-2xl p-3">
              <BrandRatingChart data={brandAvg} />
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
