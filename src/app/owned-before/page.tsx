import { AppShell } from "@/components/layout/app-shell";
import { CollectionGrid } from "@/components/collection/collection-grid";

export default function OwnedBeforePage() {
  return (
    <AppShell>
      <CollectionGrid collectionType="owned_before" title="Owned Before" />
    </AppShell>
  );
}
