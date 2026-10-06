import { allPeople, meetingBetween } from "../lib/catalog";
import { model } from "../lib/llm";
import { extendToNight, runShortMeeting } from "../lib/meeting";
import { addMeeting } from "../lib/store";
import { loadLocalEnv } from "./env";

loadLocalEnv();

const llm = model();
if (!llm) {
  console.error("Add GROQ_API_KEY or GEMINI_API_KEY to .env.");
  process.exit(1);
}
const client = llm;

const people = allPeople().filter((person) => person.links);
if (people.length < 2) {
  console.error("Season needs at least two people read from public pages.");
  process.exit(1);
}

let ran = 0;
async function main(): Promise<void> {
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const a = people[i];
      const b = people[j];
      if (!a || !b || meetingBetween(a.slug, b.slug)) continue;
      const short = await runShortMeeting(a, b, client);
      const wantsNight = short.fromA.decision === "yes" || short.fromB.decision === "yes";
      if (wantsNight) {
        const night = await extendToNight(a, b, client, short.meeting);
        addMeeting(night.meeting, night.fromA, night.fromB);
      } else {
        addMeeting(short.meeting, short.fromA, short.fromB);
      }
      ran += 1;
      console.log(`${a.slug} · ${b.slug}`);
    }
  }
  console.log(ran === 0 ? "Every saved pair already has a meeting." : `Saved ${ran} meetings.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
