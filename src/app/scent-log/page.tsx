import { AppShell } from "@/components/layout/app-shell";
import { ScentLogForm } from "@/components/log/scent-log-form";

export default function ScentLogPage() {
  return (
    <AppShell>
      <div className="px-4 pt-6 pb-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl">Scent Log</h1>
          <p className="text-sm text-muted-foreground">What are you wearing today?</p>
        </div>
        <ScentLogForm />
      </div>
    </AppShell>
  );
}
