export type Llm = {
  complete(system: string, user: string, options?: { temperature?: number }): Promise<string>;
};

export function parseJson(text: string): Record<string, unknown> {
  const thought = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const fenced = thought.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? thought).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return a note.");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

const GROQ = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct",
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-20b",
  "qwen/qwen3-32b",
];

export function model(): Llm | null {
  const groq = process.env.GROQ_API_KEY;
  const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const names = process.env.GROQ_MODEL ? [process.env.GROQ_MODEL] : GROQ_MODELS;
  const clients: Llm[] = [];
  if (groq) clients.push(...names.map((name) => chatLlm(GROQ, groq, name)));
  if (gemini) clients.push(geminiLlm(gemini));
  if (!clients.length) return null;
  return rotate(clients);
}

function busy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\((429|503|500|502|404|400|413)\)/.test(message);
}

/** Spreads calls across free models. A model that is rate limited rests for a minute. */
function rotate(clients: Llm[]): Llm {
  const restUntil = clients.map(() => 0);
  let next = 0;
  return {
    async complete(system, user, options) {
      let last: unknown = new Error("The model call failed.");
      for (let attempt = 0; attempt < clients.length * 3; attempt += 1) {
        const now = Date.now();
        const ready = clients.map((_, index) => (next + index) % clients.length).find((index) => restUntil[index] <= now);
        if (ready === undefined) {
          const wake = Math.min(...restUntil) - now;
          await new Promise((resolve) => setTimeout(resolve, Math.max(1000, wake)));
          continue;
        }
        next = (ready + 1) % clients.length;
        try {
          return await clients[ready].complete(system, user, options);
        } catch (error) {
          last = error;
          if (!busy(error)) throw error;
          restUntil[ready] = Date.now() + (/\((404|400)\)/.test(String(error)) ? 3_600_000 : 60_000);
        }
      }
      throw last instanceof Error ? last : new Error(String(last));
    },
  };
}

function chatLlm(url: string, key: string, modelName: string): Llm {
  return {
    async complete(system, user, options) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);
      try {
        const response = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            temperature: options?.temperature ?? 0.4,
            ...(modelName.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        });
        if (!response.ok) throw new Error(`The model call failed (${response.status}).`);
        const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new Error("The model returned an empty note (500).");
        return content;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error("The model call timed out (503).");
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function geminiLlm(key: string): Llm {
  return {
    async complete(system, user, options) {
      const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { temperature: options?.temperature ?? 0.4 },
        }),
      });
      if (!response.ok) throw new Error(`The model call failed (${response.status}).`);
      const payload = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
      if (!content) throw new Error("The model returned an empty note (500).");
      return content;
    },
  };
}
