"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/hooks/use-user";
import { getUserProgress } from "@/lib/badges";
import { Loader2, Trophy, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Badge, UserBadge } from "@/lib/types";

const LABEL: Record<string, (v: number, t: number) => string> = {
  collection_count: (v, t) => `${v} / ${t} fragrances added`,
  log_count: (v, t) => `${v} / ${t} scent logs`,
  streak_days: (v, t) => `${v} / ${t} day streak`,
  families_explored: (v, t) => `${v} / ${t} fragrance families`,
  combo_count: (v, t) => `${v} / ${t} layering combos`,
  swap_count: (v, t) => `${v} / ${t} swap listings`,
  niche_count: (v, t) => `${v} / ${t} niche brands`,
};

export default function MilestonesPage() {
  const { user, loading } = useUser();
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserProgress(user.id).then(({ allBadges, earnedBadges, counts }) => {
      setAllBadges(allBadges);
      setEarnedBadges(earnedBadges);
      setCounts(counts);
      setDataLoading(false);
    });
  }, [user]);

  if (loading || dataLoading) {
    return <AppShell><div className="flex justify-center pt-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AppShell>;
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
          <p className="text-muted-foreground">Sign in to track your milestones</p>
          <Link href="/sign-in"><Button>Sign in</Button></Link>
        </div>
      </AppShell>
    );
  }

  const earnedMap = new Map(earnedBadges.map((ub) => [ub.badge_id, ub]));
  const earnedCount = earnedBadges.length;
  const totalCount = allBadges.length;

  const earned = allBadges.filter((b) => earnedMap.has(b.id));
  const locked = allBadges.filter((b) => !earnedMap.has(b.id));

  return (
    <AppShell>
      <div className="px-4 pt-8 pb-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl">Milestones</h1>
            <p className="text-xs text-muted-foreground">{earnedCount} of {totalCount} achievements unlocked</p>
          </div>
        </div>

        {/* Overall progress */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{Math.round((earnedCount / totalCount) * 100)}%</span>
          </div>
          <Progress value={(earnedCount / totalCount) * 100} className="h-2.5" />
        </div>

        {/* Earned badges */}
        {earned.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base text-primary">Unlocked</h2>
            <div className="space-y-2">
              {earned.map((b) => {
                const ub = earnedMap.get(b.id)!;
                return (
                  <div key={b.id} className="bg-card border border-primary/20 rounded-2xl p-4 flex items-center gap-4">
                    <span className="text-3xl">{b.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.description}</p>
                      <p className="text-[10px] text-primary mt-0.5">Earned {format(new Date(ub.earned_at), "MMM d, yyyy")}</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary text-xs">✓</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Locked badges */}
        {locked.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base text-muted-foreground">Locked</h2>
            <div className="space-y-2">
              {locked.map((b) => {
                const current = counts[b.threshold_type] ?? 0;
                const pct = Math.min((current / b.threshold_value) * 100, 100);
                const label = LABEL[b.threshold_type]?.(current, b.threshold_value) ?? `${current} / ${b.threshold_value}`;
                return (
                  <div key={b.id} className={cn("bg-card border border-border rounded-2xl p-4 flex items-start gap-4", pct === 0 && "opacity-60")}>
                    <span className="text-3xl grayscale">{b.icon}</span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{b.name}</p>
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground">{b.description}</p>
                      <div className="space-y-1">
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </AppShell>
  );
}
