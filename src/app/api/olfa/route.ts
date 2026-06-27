import { NextRequest } from "next/server";
import { openai, MODEL } from "@/lib/openai";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

async function buildUserContext(userId: string): Promise<string> {
  const [closet, wishlist, ownedBefore, recentLogs, combos, badges] = await Promise.all([
    sql`SELECT ci.*, row_to_json(p.*) AS perfume, row_to_json(up.*) AS user_perfume
        FROM collection_items ci
        LEFT JOIN perfumes p ON p.id = ci.perfume_id
        LEFT JOIN user_perfumes up ON up.id = ci.user_perfume_id
        WHERE ci.user_id = ${userId} AND ci.collection_type = 'closet' ORDER BY ci.created_at DESC`,
    sql`SELECT ci.*, row_to_json(p.*) AS perfume, row_to_json(up.*) AS user_perfume
        FROM collection_items ci
        LEFT JOIN perfumes p ON p.id = ci.perfume_id
        LEFT JOIN user_perfumes up ON up.id = ci.user_perfume_id
        WHERE ci.user_id = ${userId} AND ci.collection_type = 'wishlist'`,
    sql`SELECT ci.*, row_to_json(p.*) AS perfume, row_to_json(up.*) AS user_perfume
        FROM collection_items ci
        LEFT JOIN perfumes p ON p.id = ci.perfume_id
        LEFT JOIN user_perfumes up ON up.id = ci.user_perfume_id
        WHERE ci.user_id = ${userId} AND ci.collection_type = 'owned_before'`,
    sql`SELECT * FROM scent_logs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20`,
    sql`SELECT name, combined_profile, occasion, season, mood FROM layer_combos WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 10`,
    sql`SELECT b.name FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = ${userId}`,
  ]);

  const lines: string[] = ["## User's Hallie Collection Data\n"];

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
      lines.push(`- ${log.date}: occasion: ${log.event_type ?? "?"}, mood: ${Array.isArray(log.mood) ? log.mood.join(", ") : (log.mood ?? "?")}, rating: ${log.rating ?? "?"}/10`);
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
    const badgeNames = badges.map((b) => b.name).filter(Boolean);
    lines.push(`### Achievements Earned\n${badgeNames.join(", ")}\n`);
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  const { messages } = await request.json();

  const session = await auth();

  let systemPrompt = `You are Hal, an elegant and knowledgeable perfume AI assistant for the Hallie app.
You have deep expertise in fragrances, perfumery, and olfactory science.
You help users with their personal fragrance collection, recommend perfumes, explain notes and families,
and answer any fragrance-related questions with warmth and passion.
Keep responses concise but insightful. Use sensory language that evokes the perfumes.`;

  if (session?.user?.id) {
    const context = await buildUserContext(session.user.id);
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
