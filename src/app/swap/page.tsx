"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import type { SwapListing } from "@/lib/types";
import { Loader2, ArrowLeftRight, Droplets } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SwapPage() {
  const { user } = useUser();
  const [listings, setListings] = useState<SwapListing[]>([]);
  const [myListings, setMyListings] = useState<SwapListing[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const supabase = createClient();
    const [{ data: all }, { data: mine }] = await Promise.all([
      supabase
        .from("swap_listings")
        .select("*, collection_item:collection_items(*, perfume:perfumes(*))")
        .eq("status", "available")
        .order("created_at", { ascending: false }),
      user
        ? supabase
            .from("swap_listings")
            .select("*, collection_item:collection_items(*, perfume:perfumes(*))")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    setListings((all as SwapListing[]) ?? []);
    setMyListings((mine as SwapListing[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function withdrawListing(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("swap_listings").update({ status: "completed" }).eq("id", id);
    if (!error) { toast.success("Listing withdrawn"); load(); }
  }

  const SwapCard = ({ listing }: { listing: SwapListing }) => {
    const perfume = listing.collection_item?.perfume;
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex gap-3 p-3">
          <div className="w-14 h-14 rounded-xl bg-plum-50 flex items-center justify-center shrink-0 overflow-hidden">
            {perfume?.image_url ? (
              <Image src={perfume.image_url} alt="" width={56} height={56} className="object-contain" unoptimized />
            ) : (
              <Droplets className="w-7 h-7 text-plum-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{perfume?.brand}</p>
            <p className="text-sm font-medium leading-snug line-clamp-2">{perfume?.name}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {listing.collection_item?.bottle_sizes?.map((s) => (
                <Badge key={s} variant="secondary" className="text-[9px] px-1.5 py-0">{s}</Badge>
              ))}
            </div>
          </div>
        </div>
        {listing.description && (
          <p className="px-3 pb-2 text-xs text-muted-foreground">{listing.description}</p>
        )}
        <div className="px-3 pb-3 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">Listed {format(new Date(listing.created_at), "MMM d")}</p>
          {user && listing.user_id !== user.id && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <ArrowLeftRight className="w-3 h-3" /> Interested
            </Button>
          )}
          {user && listing.user_id === user.id && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => withdrawListing(listing.id)}>
              Withdraw
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-8 space-y-5">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-display text-2xl">Swap Market</h1>
            <p className="text-xs text-muted-foreground">Trade fragrances with the community</p>
          </div>
        </div>

        {!user && (
          <div className="bg-plum-50 border border-plum-200 rounded-xl p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Sign in to list your own fragrances for swap</p>
            <Link href="/sign-in"><Button size="sm">Sign in</Button></Link>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center pt-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="browse">
            <TabsList className="w-full">
              <TabsTrigger value="browse" className="flex-1">Browse ({listings.length})</TabsTrigger>
              {user && <TabsTrigger value="mine" className="flex-1">My Listings ({myListings.length})</TabsTrigger>}
            </TabsList>

            <TabsContent value="browse" className="space-y-3 mt-4">
              {listings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-sm">No swaps available yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mark fragrances as available in your closet to list them here.
                  </p>
                </div>
              ) : (
                listings.map((l) => <SwapCard key={l.id} listing={l} />)
              )}
            </TabsContent>

            {user && (
              <TabsContent value="mine" className="space-y-3 mt-4">
                {myListings.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-muted-foreground text-sm">You haven't listed any fragrances yet.</p>
                    <Link href="/closet">
                      <Button variant="outline" size="sm">Go to Closet to mark items for swap</Button>
                    </Link>
                  </div>
                ) : (
                  myListings.map((l) => <SwapCard key={l.id} listing={l} />)
                )}
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
