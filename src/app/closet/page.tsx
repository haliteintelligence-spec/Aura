"use client";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CollectionGrid } from "@/components/collection/collection-grid";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "closet", label: "Closet", title: "Perfume Closet" },
  { value: "wishlist", label: "Wishlist", title: "Wishlist" },
  { value: "owned_before", label: "Owned Before", title: "Owned Before" },
] as const;

type Tab = typeof TABS[number]["value"];

export default function ClosetPage() {
  const [activeTab, setActiveTab] = useState<Tab>("closet");

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Tab bar */}
        <div className="flex border-b border-border bg-background sticky top-0 z-20">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex-1 py-3 text-sm font-medium transition-colors",
                activeTab === tab.value
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {TABS.map((tab) => (
          <div key={tab.value} className={activeTab === tab.value ? "flex flex-col flex-1" : "hidden"}>
            <CollectionGrid collectionType={tab.value} title={tab.title} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
