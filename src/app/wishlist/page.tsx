import { AppShell } from "@/components/layout/app-shell";
import { CollectionGrid } from "@/components/collection/collection-grid";

export default function WishlistPage() {
  return (
    <AppShell>
      <CollectionGrid collectionType="wishlist" title="Wishlist" />
    </AppShell>
  );
}
