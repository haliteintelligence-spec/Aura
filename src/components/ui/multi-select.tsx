"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
  className?: string;
  maxHeight?: string;
  chips?: boolean;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className,
  maxHeight = "240px",
  chips = false,
}: MultiSelectProps) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }

  if (chips) {
    return (
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs border transition-colors",
              value.includes(opt)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-foreground hover:border-primary/50"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full min-h-10 px-3 py-2 text-sm border border-input rounded-lg bg-background text-left",
            "flex flex-wrap gap-1 items-center hover:border-primary/50 transition-colors",
            className
          )}
        >
          {value.length === 0 ? (
            <span className="text-muted-foreground flex-1">{placeholder}</span>
          ) : (
            <>
              {value.map((v) => (
                <Badge
                  key={v}
                  variant="secondary"
                  className="text-xs px-1.5 py-0 gap-0.5 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); toggle(v); }}
                >
                  {v}
                  <X className="w-2.5 h-2.5" />
                </Badge>
              ))}
            </>
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div
          className="overflow-y-auto overscroll-contain p-2"
          style={{ maxHeight: `min(${maxHeight}, calc(var(--radix-popper-available-height, 400px) - 8px))` }}
        >
          <div className="space-y-1 pr-2">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={value.includes(opt)}
                  onCheckedChange={() => toggle(opt)}
                  className="shrink-0"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        {value.length > 0 && (
          <div className="px-2 pb-2 border-t border-border pt-1">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onChange([])}>
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
