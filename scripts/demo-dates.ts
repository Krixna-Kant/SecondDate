import { allPeople, meetingBetween } from "../lib/catalog";
import { model } from "../lib/llm";
import { extendToNight, runShortMeeting } from "../lib/meeting";
import { addMeeting } from "../lib/store";
import { loadLocalEnv } from "./env";

loadLocalEnv();
process.env.GROQ_MODEL = "llama-3.1-8b-instant";
const llm = model();
if (!llm) {
  console.error("Add GROQ_API_KEY or GEMINI_API_KEY to .env.");
  process.exit(1);
}
const client = llm;

async function main(): Promise<void> {
  const people = allPeople().filter((person) => person.links);
  if (people.length < 2) {
    console.error("Need at least two saved people.");
    process.exit(1);
  }
  const pairs = people.flatMap((person, index) => {
    const other = people[(index + 1) % people.length];
    if (!other || person.slug === other.slug || meetingBetween(person.slug, other.slug)) return [];
    return [{ a: person, b: other }];
  }).slice(0, 8);

  let ran = 0;
  let nights = 0;
  for (let start = 0; start < pairs.length; start += 1) {
    const chunk = pairs.slice(start, start + 1);
    const results = await Promise.all(
      chunk.map(async ({ a, b }) => {
        try {
          const short = await runShortMeeting(a, b, client);
          return { a, b, short };
        } catch (error) {
          console.log("skip", a.slug, b.slug, error instanceof Error ? error.message : error);
          return null;
        }
      }),
    );
    for (const result of results) {
      if (!result) continue;
      const wantsNight = nights < 4 && (result.short.fromA.decision === "yes" || result.short.fromB.decision === "yes");
      if (wantsNight) {
        const night = await extendToNight(result.a, result.b, client, result.short.meeting);
        addMeeting(night.meeting, night.fromA, night.fromB);
        nights += 1;
      } else {
        addMeeting(result.short.meeting, result.short.fromA, result.short.fromB);
      }
      ran += 1;
      console.log(`${ran} ${result.a.slug} · ${result.b.slug} ${wantsNight ? "night" : "short"}`);
    }
  }
  console.log(`Meetings saved this run: ${ran}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
