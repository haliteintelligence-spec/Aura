import { NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { messages, collectionContext } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let systemPrompt = `You are Olfa, an elegant and knowledgeable perfume AI assistant for the Aura app.
You have deep expertise in fragrances, perfumery, and olfactory science.
You help users with their personal fragrance collection, recommend perfumes, explain notes and families,
and answer any fragrance-related questions with warmth and passion.
Keep responses concise but insightful. Use sensory language that evokes the perfumes.`;

  if (user && collectionContext) {
    systemPrompt += `\n\nThe user's collection context:\n${collectionContext}`;
  }

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1000,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
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
