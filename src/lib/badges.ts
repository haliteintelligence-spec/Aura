import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export async function checkAndAwardBadges(userId: string): Promise<void> {
  const supabase = createClient();

  const [
    { data: allBadges },
    { data: earnedBadges },
    { count: collectionCount },
    { count: logCount },
    { count: comboCount },
    { count: swapCount },
    { data: familyItems },
    { data: recentLogs },
  ] = await Promise.all([
    supabase.from("badges").select("*"),
    supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    supabase.from("collection_items").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("scent_logs").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("layer_combos").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("swap_listings").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("collection_items").select("perfume:perfumes(fragrance_family)").eq("user_id", userId),
    supabase.from("scent_logs").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
  ]);

  if (!allBadges) return;

  const earnedIds = new Set((earnedBadges ?? []).map((b) => b.badge_id));

  // Count distinct fragrance families
  const familiesSet = new Set<string>();
  for (const item of familyItems ?? []) {
    const perfume = item.perfume as { fragrance_family?: string[] } | null;
    for (const f of perfume?.fragrance_family ?? []) familiesSet.add(f);
  }

  // Calculate streak (consecutive calendar days with at least one log)
  const logDays = new Set(
    (recentLogs ?? []).map((l) => new Date(l.created_at).toISOString().slice(0, 10))
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (logDays.has(d.toISOString().slice(0, 10))) {
      streak++;
    } else {
      break;
    }
  }

  const counts: Record<string, number> = {
    collection_count: collectionCount ?? 0,
    log_count: logCount ?? 0,
    combo_count: comboCount ?? 0,
    swap_count: swapCount ?? 0,
    families_explored: familiesSet.size,
    streak_days: streak,
  };

  const toAward = allBadges.filter(
    (b) => !earnedIds.has(b.id) && (counts[b.threshold_type] ?? 0) >= b.threshold_value
  );

  if (toAward.length === 0) return;

  await supabase.from("user_badges").insert(
    toAward.map((b) => ({ user_id: userId, badge_id: b.id }))
  );

  for (const b of toAward) {
    toast.success(`${b.icon} Achievement unlocked: ${b.name}!`, { duration: 5000 });
  }
}

export async function getUserProgress(userId: string) {
  const supabase = createClient();

  const [
    { data: allBadges },
    { data: earnedBadges },
    { count: collectionCount },
    { count: logCount },
    { count: comboCount },
    { count: swapCount },
    { data: familyItems },
    { data: recentLogs },
  ] = await Promise.all([
    supabase.from("badges").select("*"),
    supabase.from("user_badges").select("*, badge:badges(*)").eq("user_id", userId),
    supabase.from("collection_items").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("scent_logs").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("layer_combos").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("swap_listings").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("collection_items").select("perfume:perfumes(fragrance_family)").eq("user_id", userId),
    supabase.from("scent_logs").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
  ]);

  const familiesSet = new Set<string>();
  for (const item of familyItems ?? []) {
    const perfume = item.perfume as { fragrance_family?: string[] } | null;
    for (const f of perfume?.fragrance_family ?? []) familiesSet.add(f);
  }

  const logDays = new Set(
    (recentLogs ?? []).map((l) => new Date(l.created_at).toISOString().slice(0, 10))
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (logDays.has(d.toISOString().slice(0, 10))) {
      streak++;
    } else {
      break;
    }
  }

  const counts: Record<string, number> = {
    collection_count: collectionCount ?? 0,
    log_count: logCount ?? 0,
    combo_count: comboCount ?? 0,
    swap_count: swapCount ?? 0,
    families_explored: familiesSet.size,
    streak_days: streak,
  };

  return { allBadges: allBadges ?? [], earnedBadges: earnedBadges ?? [], counts };
}
