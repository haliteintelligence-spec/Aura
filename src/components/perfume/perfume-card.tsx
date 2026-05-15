"use client";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, levelToFraction, BOTTLE_SIZES, proxyImageUrl } from "@/lib/utils";
import type { CollectionItem } from "@/lib/types";
import { Star, ArrowLeftRight, Droplets } from "lucide-react";

interface PerfumeCardProps {
  item: CollectionItem;
  onClick?: () => void;
  className?: string;
}

export function PerfumeCard({ item, onClick, className }: PerfumeCardProps) {
  const perfume = item.perfume;
  if (!perfume) return null;

  const levelFraction = levelToFraction(item.estimated_level);
  const levelPct = Math.round(levelFraction * 100);

  const primarySize = BOTTLE_SIZES.find((s) => s.value === item.bottle_sizes?.[0]);
  const priceEntry = item.size_prices?.find((p) => p.size === item.bottle_sizes?.[0]);

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl border border-border overflow-hidden cursor-pointer",
        "hover:border-primary/40 hover:shadow-md transition-all duration-200",
        "active:scale-[0.98]",
        className
      )}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-plum-50 overflow-hidden">
        {proxyImageUrl(perfume.image_url) ? (
          <Image
            src={proxyImageUrl(perfume.image_url)!}
            alt={perfume.name}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Droplets className="w-12 h-12 text-plum-300" />
          </div>
        )}

        {item.available_for_swap && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
            <ArrowLeftRight className="w-3 h-3" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">
            {perfume.brand}
          </p>
          <h3 className="font-display text-sm font-medium leading-snug line-clamp-2">
            {perfume.name}
          </h3>
        </div>

        {/* Fragrance family */}
        {perfume.fragrance_family?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {perfume.fragrance_family.slice(0, 2).map((f) => (
              <Badge key={f} variant="secondary" className="text-[9px] px-1.5 py-0">
                {f}
              </Badge>
            ))}
          </div>
        )}

        {/* Notes */}
        {(perfume.top_notes?.length > 0 || perfume.heart_notes?.length > 0 || perfume.base_notes?.length > 0) && (
          <div className="space-y-0.5">
            {perfume.top_notes?.length > 0 && (
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                <span className="font-medium">T </span>{perfume.top_notes.slice(0, 3).join(", ")}
              </p>
            )}
            {perfume.heart_notes?.length > 0 && (
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                <span className="font-medium">H </span>{perfume.heart_notes.slice(0, 3).join(", ")}
              </p>
            )}
            {perfume.base_notes?.length > 0 && (
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                <span className="font-medium">B </span>{perfume.base_notes.slice(0, 3).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Rating */}
        {item.rating && (
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
            <span className="text-xs font-medium">{item.rating}/10</span>
          </div>
        )}

        {/* Level bar */}
        {item.collection_type === "closet" && (
          <div className="space-y-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-muted-foreground">Level</span>
              <span className="text-[9px] font-medium text-muted-foreground">{item.estimated_level}</span>
            </div>
            <Progress
              value={levelPct}
              className="h-1.5"
            />
          </div>
        )}

        {/* Price */}
        {priceEntry && (
          <p className="text-xs text-muted-foreground">
            {primarySize?.label} · ${priceEntry.price_min}–${priceEntry.price_max}
          </p>
        )}
      </div>
    </div>
  );
}
