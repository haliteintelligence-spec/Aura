import { NextRequest } from "next/server";
import { openai, MODEL } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

async function buildUserContext(userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const [
    { data: closet },
    { data: wishlist },
    { data: ownedBefore },
    { data: recentLogs },
    { data: combos },
    { data: badges },
  ] = await Promise.all([
    supabase
      .from("collection_items")
      .select("*, perfume:perfumes(name, brand, fragrance_family, top_notes, heart_notes, base_notes, gender), user_perfume:user_perfumes(name, brand, fragrance_family, top_notes, heart_notes, base_notes, gender)")
      .eq("user_id", userId)
      .eq("collection_type", "closet")
      .order("created_at", { ascending: false }),
    supabase
      .from("collection_items")
      .select("*, perfume:perfumes(name, brand, fragrance_family), user_perfume:user_perfumes(name, brand, fragrance_family)")
      .eq("user_id", userId)
      .eq("collection_type", "wishlist"),
    supabase
      .from("collection_items")
      .select("*, perfume:perfumes(name, brand, fragrance_family), user_perfume:user_perfumes(name, brand, fragrance_family)")
      .eq("user_id", userId)
      .eq("collection_type", "owned_before"),
    supabase
      .from("scent_logs")
      .select("*, items:collection_items(perfume:perfumes(name, brand), user_perfume:user_perfumes(name, brand))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("layer_combos")
      .select("name, combined_profile, occasion, season, mood")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("user_badges")
      .select("badge:badges(name)")
      .eq("user_id", userId),
  ]);

  const lines: string[] = ["## User's Sally Collection Data\n"];

  if (closet && closet.length > 0) {
    lines.push(`### Perfume Closet (${closet.length} fragrances)`);
    for (const item of closet) {
      const p = (item.perfume ?? item.user_perfume) as { name: string; brand: string; fragrance_family?: string[]; top_notes?: string[]; heart_notes?: string[]; base_notes?: string[] } | null;
      if (!p) continue;
      const notes = [
        p.top_notes?.length ? `top: ${p.top_notes.slice(0, 3).join(", ")}` : null,
        p.heart_notes?.length ? `heart: ${p.heart_notes.slice(0, 3).join(", ")}` : null,
        p.base_notes?.length ? `base: ${p.base_notes.slice(0, 3).join(", ")}` : null,
      ].filter(Boolean).join(" | ");
      lines.push(`- ${p.brand} ${p.name} [${p.fragrance_family?.join(", ") ?? ""}] ${notes ? `(${notes})` : ""} — level: ${item.estimated_level ?? "unknown"}, rating: ${item.rating ?? "unrated"}/10`);
    }
    lines.push("");
  } else {
    lines.push("### Perfume Closet\nEmpty.\n");
  }

  if (wishlist && wishlist.length > 0) {
    lines.push(`### Wishlist (${wishlist.length} fragrances)`);
    for (const item of wishlist) {
      const p = (item.perfume ?? item.user_perfume) as { name: string; brand: string; fragrance_family?: string[] } | null;
      if (p) lines.push(`- ${p.brand} ${p.name} [${p.fragrance_family?.join(", ") ?? ""}]`);
    }
    lines.push("");
  }

  if (ownedBefore && ownedBefore.length > 0) {
    lines.push(`### Previously Owned (${ownedBefore.length} fragrances)`);
    for (const item of ownedBefore) {
      const p = (item.perfume ?? item.user_perfume) as { name: string; brand: string } | null;
      if (p) lines.push(`- ${p.brand} ${p.name}`);
    }
    lines.push("");
  }

  if (recentLogs && recentLogs.length > 0) {
    lines.push(`### Recent Scent Logs (last ${recentLogs.length})`);
    for (const log of recentLogs.slice(0, 10)) {
      const perfumeNames = (log.items as { perfume: { name: string; brand: string } | null; user_perfume: { name: string; brand: string } | null }[] | null)
        ?.map((i) => { const p = i.perfume ?? i.user_perfume; return p ? `${p.brand} ${p.name}` : null; })
        .filter(Boolean)
        .join(", ") ?? "unknown";
      lines.push(`- ${log.date}: wore ${perfumeNames} | occasion: ${log.event_type ?? "?"}, mood: ${Array.isArray(log.mood) ? log.mood.join(", ") : (log.mood ?? "?")}, rating: ${log.rating ?? "?"}/10`);
    }
    lines.push("");
  }

  if (combos && combos.length > 0) {
    lines.push(`### Saved Layering Combos`);
    for (const c of combos) {
      lines.push(`- "${c.name}" — ${c.combined_profile ?? ""} (${c.occasion ?? ""}, ${c.season ?? ""})`);
    }
    lines.push("");
  }

  if (badges && badges.length > 0) {
    const badgeNames = badges.map((b) => (b.badge as unknown as { name: string } | null)?.name).filter(Boolean);
    lines.push(`### Achievements Earned\n${badgeNames.join(", ")}\n`);
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  const { messages } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let systemPrompt = `You are Olfa, an elegant and knowledgeable perfume AI assistant for the Sally app.
You have deep expertise in fragrances, perfumery, and olfactory science.
You help users with their personal fragrance collection, recommend perfumes, explain notes and families,
and answer any fragrance-related questions with warmth and passion.
Keep responses concise but insightful. Use sensory language that evokes the perfumes.`;

  if (user) {
    const context = await buildUserContext(user.id, supabase);
    systemPrompt += `\n\nYou have access to this user's personal fragrance data. Use it to give personalised, specific answers. When they ask about their collection, logs, wishlist, or combos, refer to the actual data below.\n\n${context}`;
  }

  const stream = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1000,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
