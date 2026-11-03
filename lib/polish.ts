import Anthropic from "@anthropic-ai/sdk";

// Rewrites a submitted announcement for the newsletter: fixes spelling and
// grammar, tightens wording, keeps every fact. The admin sees the result side
// by side with the original and decides.

const SYSTEM = `You edit announcements for the weekly email of Beulah Baptist Church, a Southern Baptist church in Dadeville, Alabama. Rewrite the announcement so it reads cleanly and professionally in a warm, plain church-family voice.

Rules:
- Keep every fact: names, dates, times, places, amounts, contacts. Never invent details.
- Fix spelling, grammar and punctuation. Tighten rambling sentences. Keep it short.
- Keep the writer's warmth. Do not make it stiff or corporate.
- Use plain hyphens; never use em dashes or en dashes.
- Return only the rewritten announcement text, no preamble, no quotes, no title.`;

export async function polishAnnouncement(title: string, body: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Polish is not set up yet (ANTHROPIC_API_KEY is missing).");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: `Title: ${title}\n\nAnnouncement:\n${body}` }],
  });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!text) throw new Error("No rewrite came back. Try again.");
  return text;
}
