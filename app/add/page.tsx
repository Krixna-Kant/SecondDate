import { redirect } from "next/navigation";
import { AddForm } from "./form";

export const dynamic = "force-dynamic";
function waitingOn(): string | null {
  const apify = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  const llm = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apify) return "Add APIFY_TOKEN to .env and restart. A free Apify account is enough. The two pages are not read until then.";
  if (!llm) return "A profile can be read. Dates wait on GROQ_API_KEY or GEMINI_API_KEY in .env.";
  return null;
}

export default function AddPage() {
  const live = process.env.LIVE_SITE_URL;
  if (live) redirect(`${live.replace(/\/$/, "")}/add`);
  const waiting = waitingOn();
  return (
    <main className="wrap-narrow how">
      <p className="kicker">Two official links</p>
      <h1>Read a person.</h1>
      <p className="muted" style={{ maxWidth: "48ch" }}>
        A public LinkedIn and their public Instagram. Takes about two minutes.
      </p>
      {waiting && <p className="muted">{waiting}</p>}
      <AddForm />
    </main>
  );
}
