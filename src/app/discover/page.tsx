import { AppShell } from "@/components/layout/app-shell";
import { CollectionEntryWizard } from "@/components/perfume/collection-entry-wizard";

export default function DiscoverPage() {
  return (
    <AppShell>
      <div className="px-0 pt-4 pb-6">
        <div className="px-4 mb-2">
          <h1 className="font-display text-2xl">Discover</h1>
          <p className="text-sm text-muted-foreground">Search or photograph a bottle to add it</p>
        </div>
        <CollectionEntryWizard />
      </div>
    </AppShell>
  );
}
