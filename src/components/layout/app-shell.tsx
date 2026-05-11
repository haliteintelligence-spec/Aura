"use client";
import { NavBar } from "./nav-bar";
import { OlfaChat } from "@/components/olfa/olfa-chat";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto relative">
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      <NavBar />
      <OlfaChat />
    </div>
  );
}
