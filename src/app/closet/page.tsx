import { AppShell } from "@/components/layout/app-shell";
import { CollectionGrid } from "@/components/collection/collection-grid";

export default function ClosetPage() {
  return (
    <AppShell>
      <CollectionGrid collectionType="closet" title="Perfume Closet" />
    </AppShell>
  );
}
