import { AppShell } from "@/components/layout/app-shell";
import { ScentLogForm } from "@/components/log/scent-log-form";

export default async function ScentLogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  const initialItemIds = typeof sp.ids === "string" && sp.ids ? sp.ids.split(",") : [];
  const initialMood = typeof sp.mood === "string" && sp.mood ? sp.mood.split(",") : [];
  const initialOccasions = typeof sp.occasions === "string" && sp.occasions ? sp.occasions.split(",") : [];

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl">Scent Log</h1>
          <p className="text-sm text-muted-foreground">What are you wearing today?</p>
        </div>
        <ScentLogForm
          initialItemIds={initialItemIds}
          initialMood={initialMood}
          initialOccasions={initialOccasions}
        />
      </div>
    </AppShell>
  );
}
