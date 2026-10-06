import { model } from "../lib/llm";
import { extendToNight, runShortMeeting } from "../lib/meeting";
import { priorBetween } from "../lib/prior";
import { addMeeting, loadLive, saveLive } from "../lib/store";
import type { Person } from "../lib/types";
import { loadLocalEnv } from "./env";

loadLocalEnv();
const llm = model();
if (!llm) {
  console.error("Add GROQ_API_KEY or GEMINI_API_KEY to .env.");
  process.exit(1);
}
const client = llm;
const ROUNDS = Number(process.env.ROUNDS || 3);
const PARALLEL = Number(process.env.PARALLEL || 4);
const MAX_NIGHTS = Number(process.env.MAX_NIGHTS || 10);

function key(a: string, b: string): string {
  return [a, b].sort().join("|");
}

async function main(): Promise<void> {
  if (process.argv.includes("--fresh")) {
    const live = loadLive();
    saveLive({ ...live, meetings: [], debriefs: [] });
    console.log("Cleared old dates.");
  }
  const people = loadLive().people.filter((person) => person.links);
  const met = new Set(loadLive().meetings.map((meeting) => key(meeting.a, meeting.b)));
  const queue = new Map<string, Person[]>(
    people.map((person) => [
      person.slug,
      people.filter((other) => other.slug !== person.slug).sort((x, y) => priorBetween(person, y) - priorBetween(person, x)),
    ]),
  );
  let nights = loadLive().meetings.filter((meeting) => meeting.kind === "night").length;

  for (let round = 1; round <= ROUNDS; round += 1) {
    const live = loadLive();
    const saidYes = new Set(live.debriefs.filter((note) => note.decision === "yes").map((note) => note.from));
    const dates = new Map<string, number>();
    for (const meeting of live.meetings) {
      dates.set(meeting.a, (dates.get(meeting.a) ?? 0) + 1);
      dates.set(meeting.b, (dates.get(meeting.b) ?? 0) + 1);
    }
    const looking = people
      .filter((person) => !saidYes.has(person.slug))
      .sort((x, y) => (dates.get(x.slug) ?? 0) - (dates.get(y.slug) ?? 0));
    const busy = new Set<string>();
    const pairs: [Person, Person][] = [];
    for (const person of looking) {
      if (busy.has(person.slug)) continue;
      const pick =
        queue.get(person.slug)!.find((other) => !busy.has(other.slug) && !met.has(key(person.slug, other.slug)) && !saidYes.has(other.slug)) ??
        queue.get(person.slug)!.find((other) => !busy.has(other.slug) && !met.has(key(person.slug, other.slug)));
      if (!pick) continue;
      busy.add(person.slug);
      busy.add(pick.slug);
      met.add(key(person.slug, pick.slug));
      pairs.push([person, pick]);
    }
    console.log(`Round ${round}: ${pairs.length} dates, ${looking.length} still looking.`);
    if (!pairs.length) break;

    let cursor = 0;
    async function worker(): Promise<void> {
      while (cursor < pairs.length) {
        const [a, b] = pairs[cursor];
        cursor += 1;
        try {
          const short = await runShortMeeting(a, b, client);
          const wantsMore = short.fromA.decision === "yes" || short.fromB.decision === "yes";
          if (wantsMore && nights < MAX_NIGHTS) {
            nights += 1;
            const night = await extendToNight(a, b, client, short.meeting);
            addMeeting(night.meeting, night.fromA, night.fromB);
            console.log(`  ${a.slug} × ${b.slug}: night · ${night.fromA.decision} / ${night.fromB.decision}`);
          } else {
            addMeeting(short.meeting, short.fromA, short.fromB);
            console.log(`  ${a.slug} × ${b.slug}: ${short.fromA.decision} / ${short.fromB.decision}`);
          }
        } catch (error) {
          met.delete(key(a.slug, b.slug));
          console.log(`  ${a.slug} × ${b.slug}: skipped (${error instanceof Error ? error.message : error})`);
        }
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker));
  }
  const final = loadLive();
  console.log(`Dates on file: ${final.meetings.length}. Nights: ${final.meetings.filter((meeting) => meeting.kind === "night").length}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
