type Message = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export function hasDeepSeekKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export async function deepSeekChat(
  messages: Message[],
  options?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

  const model = options?.model ?? process.env.DEEPSEEK_MODEL?.trim() ?? "deepseek-chat";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: messages.map((message) => ({
        ...message,
        content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
      })),
      temperature: options?.temperature ?? 0.2,
      max_tokens: Math.min(options?.maxTokens ?? 8192, 8192),
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = await response.json().catch(() => null) as DeepSeekResponse | null;
  if (!data) throw new Error(`DeepSeek returned an unreadable response (${response.status})`);
  if (!response.ok) throw new Error(data.error?.message ?? `DeepSeek request failed (${response.status})`);

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("DeepSeek returned an empty response");
  }
  return content;
}
