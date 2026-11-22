import { parseJsonObjectSafe } from "@/lib/safe-json";

export { parseJsonObjectSafe };

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
      role?: string;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
    code?: number;
    status?: string;
  };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: unknown;
  images?: Array<{ mimeType: string; data: string }>;
};

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiStudyModel(): string {
  const envModel =
    process.env.GEMINI_STUDY_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim();

  // If env has deprecated or removed models, sanitize to supported production models
  if (
    !envModel ||
    envModel.includes("gemini-1.5") ||
    envModel.includes("gemini-1.0") ||
    envModel.includes("gemini-2.0-flash-lite")
  ) {
    return "gemini-2.5-flash";
  }

  return envModel;
}

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-2.0-flash",
];

function isHighDemandOrTemporaryError(status: number, message: string): boolean {
  if (status === 503 || status === 429 || status === 404 || status === 400 || status === 410 || status === 500) {
    if (status === 400 || status === 410) {
      const lower = message.toLowerCase();
      return (
        lower.includes("not found") ||
        lower.includes("not supported") ||
        lower.includes("no longer available") ||
        lower.includes("not available") ||
        lower.includes("deprecated") ||
        lower.includes("invalid model") ||
        lower.includes("unknown model")
      );
    }
    return true;
  }
  const lower = message.toLowerCase();
  return (
    lower.includes("high demand") ||
    lower.includes("spikes in demand") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("resource has been exhausted") ||
    lower.includes("overloaded") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("not found for api version") ||
    lower.includes("not supported for generatecontent") ||
    lower.includes("no longer available") ||
    lower.includes("not available") ||
    lower.includes("deprecated") ||
    lower.includes("is not found") ||
    lower.includes("model not found") ||
    lower.includes("capacity")
  );
}

/**
 * Universal chat completion using Google Gemini API with automatic high-demand failover.
 * Supports system instructions, multi-turn messages, custom token limits, and JSON mode.
 */
export async function geminiChat(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    triedModels?: string[];
    onModelUsed?: (model: string) => void;
  }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server");

  let model = options?.model ?? getGeminiStudyModel();
  if (
    model.includes("gemini-1.5") ||
    model.includes("gemini-1.0") ||
    model.includes("gemini-2.0-flash-lite")
  ) {
    model = "gemini-2.5-flash";
  }

  const triedModels = new Set(options?.triedModels ?? []);
  triedModels.add(model);

  // Extract system messages and conversation messages
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const systemText = systemMessages
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .filter(Boolean)
    .join("\n\n");

  const contents = conversationMessages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    const parts: Array<Record<string, unknown>> = [{ text }];

    if (m.images && Array.isArray(m.images)) {
      for (const img of m.images) {
        if (img?.data && img?.mimeType) {
          // Remove potential data url prefix like "data:image/jpeg;base64," if present
          const cleanData = img.data.includes(",") ? img.data.split(",")[1] : img.data;
          parts.push({
            inline_data: {
              mime_type: img.mimeType,
              data: cleanData,
            },
          });
        }
      }
    }

    return {
      role,
      parts,
    };
  });

  if (contents.length === 0 && systemText) {
    contents.push({
      role: "user",
      parts: [{ text: systemText }],
    });
  }

  // thinkingConfig is only valid on models supporting reasoning (e.g. gemini-2.5+, gemini-3+)
  const supportsThinking = model.startsWith("gemini-2.5") || model.startsWith("gemini-3");
  const generationConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.25,
    maxOutputTokens: options?.maxOutputTokens ?? 4096,
    ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
  };
  if (supportsThinking) {
    generationConfig.thinkingConfig = {
      thinkingLevel: model.includes("flash-lite") ? "minimal" : "low",
    };
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig,
  };

  if (systemText && contents.length > 0 && contents[0].parts[0].text !== systemText) {
    payload.systemInstruction = {
      parts: [{ text: systemText }],
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (fetchErr) {
    // If network/timeout fails, check if another fallback model can be tried
    const nextModel = FALLBACK_MODELS.find((m) => !triedModels.has(m));
    if (nextModel) {
      console.warn(`[Gemini] Network error on ${model}, falling back to ${nextModel}...`);
      return geminiChat(messages, {
        ...options,
        model: nextModel,
        triedModels: Array.from(triedModels),
      });
    }
    throw fetchErr;
  }

  const data = (await response.json().catch(() => null)) as GeminiResponse | null;
  const errorMessage = data?.error?.message ?? `HTTP ${response.status}`;

  if (!response.ok || !data) {
    // If the model is experiencing high demand (503), quota (429), or 404, fallback to next healthy model
    if (isHighDemandOrTemporaryError(response.status, errorMessage)) {
      const nextModel = FALLBACK_MODELS.find((m) => !triedModels.has(m));
      if (nextModel) {
        console.warn(`[Gemini] Model ${model} is experiencing high demand (${errorMessage}). Falling back to ${nextModel}...`);
        // Brief 800ms backoff before switching
        await new Promise((resolve) => setTimeout(resolve, 800));
        return geminiChat(messages, {
          ...options,
          model: nextModel,
          triedModels: Array.from(triedModels),
        });
      }
    }
    throw new Error(errorMessage);
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) {
    // Empty output or filtered; try next model
    const nextModel = FALLBACK_MODELS.find((m) => !triedModels.has(m));
    if (nextModel) {
      return geminiChat(messages, {
        ...options,
        model: nextModel,
        triedModels: Array.from(triedModels),
      });
    }
    throw new Error(`Gemini returned an empty response${candidate?.finishReason ? ` (${candidate.finishReason})` : ""}`);
  }

  options?.onModelUsed?.(model);
  return text;
}

/**
 * Structured JSON generator using Google Gemini with model resilience.
 */
export async function geminiGenerateJson(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    triedModels?: string[];
  }
) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const requestedModel = options?.model ?? getGeminiStudyModel();
  let usedModel = requestedModel;

  const text = await geminiChat(
    [{ role: "user", content: prompt }],
    {
      model: requestedModel,
      temperature: options?.temperature ?? 0.2,
      maxOutputTokens: options?.maxOutputTokens ?? 8192,
      responseMimeType: "application/json",
      triedModels: options?.triedModels,
      onModelUsed: (m) => {
        usedModel = m;
      },
    }
  );

  return { text, model: usedModel };
}

/**
 * Robust JSON object parser that safely extracts JSON from AI responses,
 * repairing LaTeX unescaped backslashes and truncated structures.
 */
export function parseJsonObject<T>(value: string): T {
  return parseJsonObjectSafe<T>(value);
}
