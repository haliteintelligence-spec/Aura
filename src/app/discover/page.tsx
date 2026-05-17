"use client";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CollectionEntryWizard } from "@/components/perfume/collection-entry-wizard";
import { BeautyCatalog } from "@/components/beauty/beauty-catalog";
import { cn } from "@/lib/utils";

type Tab = "fragrances" | "beauty";

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>("fragrances");

  return (
    <AppShell>
      <div className="pt-4 pb-6">
        <div className="px-4 mb-4">
          <h1 className="font-display text-2xl">Discover</h1>
        </div>

        {/* Tab switcher */}
        <div className="px-4 mb-4 flex gap-1 bg-muted rounded-xl p-1">
          {(["fragrances", "beauty"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize",
                tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              {t === "fragrances" ? "Fragrances" : "Beauty"}
            </button>
          ))}
        </div>

        {tab === "fragrances" ? (
          <CollectionEntryWizard />
        ) : (
          <BeautyCatalog />
        )}
      </div>
    </AppShell>
  );
}
