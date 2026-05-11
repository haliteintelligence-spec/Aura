"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Archive, BookOpen, User, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/discover", icon: Search, label: "Discover" },
  { href: "/closet", icon: Archive, label: "Closet" },
  { href: "/scent-log", icon: BookOpen, label: "Log" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border">
      <div className="flex items-center justify-around px-2 py-2 pb-safe max-w-md mx-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn("w-5 h-5 shrink-0", active && "stroke-[2.5]")}
              />
              <span className="text-[10px] font-medium truncate">{label}</span>
              {active && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
