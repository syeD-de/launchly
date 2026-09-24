/**
 * Shared AI engine picker for generation endpoints.
 * Priority: Claude (paid, best quality) -> Gemini (FREE tier) -> null
 * (caller falls back to its local rule-based generator).
 * Keys stay server-side; never import this file from client components.
 */

export interface AIGenerated {
  text: string;
  engine: string;
}

export async function generateWithAI(args: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<AIGenerated | null> {
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (claudeKey) {
    try {
      const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-5";
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: claudeKey });
      const msg = await client.messages.create({
        model,
        max_tokens: args.maxTokens,
        system: args.system,
        messages: [{ role: "user", content: args.user }],
      });
      const text = msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b as unknown as { text: string }).text ?? "")
        .join("\n")
        .trim();
      if (text) return { text, engine: `claude:${model}` };
    } catch (e) {
      console.error("[ai] claude failed, trying next engine:", e instanceof Error ? e.message : e);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(geminiKey);
      const genModel = genAI.getGenerativeModel({
        model,
        systemInstruction: args.system,
      });
      const result = await genModel.generateContent({
        contents: [{ role: "user", parts: [{ text: args.user }] }],
        generationConfig: { maxOutputTokens: args.maxTokens },
      });
      const text = result.response.text().trim();
      if (text) return { text, engine: `gemini:${model}` };
    } catch (e) {
      console.error("[ai] gemini failed:", e instanceof Error ? e.message : e);
      return null;
    }
  }

  return null;
}
