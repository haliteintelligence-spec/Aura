"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, proxyImageUrl } from "@/lib/utils";
import { ChevronDown, X, Droplets, Search } from "lucide-react";
import Image from "next/image";
import type { CollectionItem } from "@/lib/types";

interface PerfumeSelectProps {
  items: CollectionItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export function PerfumeSelect({ items, value, onChange, placeholder = "Search fragrances…" }: PerfumeSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? items.filter((item) => {
        const p = item.perfume ?? item.user_perfume;
        const q = search.toLowerCase();
        return p?.name?.toLowerCase().includes(q) || p?.brand?.toLowerCase().includes(q);
      })
    : items;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const selectedItems = items.filter((i) => value.includes(i.id));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full min-h-10 px-3 py-2 text-sm border border-input rounded-lg bg-background text-left",
            "flex flex-wrap gap-1 items-center hover:border-primary/50 transition-colors"
          )}
        >
          {selectedItems.length === 0 ? (
            <span className="text-muted-foreground flex-1">{placeholder}</span>
          ) : (
            selectedItems.map((item) => (
              <Badge
                key={item.id}
                variant="secondary"
                className="text-xs px-1.5 py-0 gap-0.5 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); toggle(item.id); }}
              >
                {(item.perfume ?? item.user_perfume)?.name}
                <X className="w-2.5 h-2.5" />
              </Badge>
            ))
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or brand…"
            className="h-8 text-sm pl-7"
          />
        </div>
        <ScrollArea className="max-h-56">
          <div className="space-y-0.5 pr-2">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No fragrances found</p>
            ) : (
              filtered.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={value.includes(item.id)}
                    onCheckedChange={() => toggle(item.id)}
                    className="shrink-0"
                  />
                  <div className="w-7 h-7 rounded-md bg-plum-50 flex items-center justify-center shrink-0 overflow-hidden">
                    {proxyImageUrl((item.perfume ?? item.user_perfume)?.image_url) ? (
                      <Image src={proxyImageUrl((item.perfume ?? item.user_perfume)!.image_url)!} alt="" width={28} height={28} className="object-contain" unoptimized />
                    ) : (
                      <Droplets className="w-3.5 h-3.5 text-plum-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{(item.perfume ?? item.user_perfume)?.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{(item.perfume ?? item.user_perfume)?.brand}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </ScrollArea>
        {value.length > 0 && (
          <div className="pt-2 border-t border-border mt-2">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onChange([])}>
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
