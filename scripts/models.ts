import { loadLocalEnv } from "./env";

loadLocalEnv();

async function main(): Promise<void> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return console.log("no groq key");
  const list = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
  const models = ((await list.json()) as { data: { id: string }[] }).data.map((item) => item.id).sort();
  console.log(models.join("\n"));
  for (const id of ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct", "moonshotai/kimi-k2-instruct", "qwen/qwen3-32b", "llama-3.1-8b-instant"]) {
    if (!models.includes(id)) continue;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: id, messages: [{ role: "user", content: "Say ok" }], max_tokens: 5 }),
    });
    console.log(id, response.status, "tpm", response.headers.get("x-ratelimit-limit-tokens"), "rpd", response.headers.get("x-ratelimit-limit-requests"), "left", response.headers.get("x-ratelimit-remaining-requests"));
  }
  const gemini = process.env.GEMINI_API_KEY;
  if (gemini) {
    for (const id of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": gemini },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Say ok" }] }] }),
      });
      console.log(id, response.status);
    }
  }
}

main().catch((error: unknown) => console.error(error instanceof Error ? error.message : error));
