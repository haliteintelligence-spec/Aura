import { toast } from "sonner";

export async function checkAndAwardBadges(_userId: string): Promise<void> {
  const res = await fetch("/api/badges");
  if (!res.ok) return;
  const { allBadges, earnedBadges, counts } = await res.json();
  if (!allBadges) return;

  const earnedIds = new Set((earnedBadges ?? []).map((b: { badge_id: string }) => b.badge_id));
  const toAward = (allBadges as { id: string; threshold_type: string; threshold_value: number; icon: string; name: string }[]).filter(
    (b) => !earnedIds.has(b.id) && (counts[b.threshold_type] ?? 0) >= b.threshold_value
  );

  if (toAward.length === 0) return;

  await fetch("/api/badges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ badge_ids: toAward.map((b) => b.id) }),
  });

  for (const b of toAward) {
    toast.success(`${b.icon} Achievement unlocked: ${b.name}!`, { duration: 5000 });
  }
}

export async function getUserProgress(_userId: string) {
  const res = await fetch("/api/badges");
  if (!res.ok) return { allBadges: [], earnedBadges: [], counts: {} };
  return res.json();
}
