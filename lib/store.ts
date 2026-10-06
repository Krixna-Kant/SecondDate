import fs from "node:fs";
import path from "node:path";
import type { Dossier } from "./sources";
import type { Debrief, Meeting, Person } from "./types";

export type LiveFile = {
  people: Person[];
  meetings: Meeting[];
  debriefs: Debrief[];
};

const empty: LiveFile = { people: [], meetings: [], debriefs: [] };

function file(): string {
  return path.join(process.cwd(), "data", "live.json");
}

export function loadLive(): LiveFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(file(), "utf8")) as Partial<LiveFile>;
    return {
      people: parsed.people ?? [],
      meetings: parsed.meetings ?? [],
      debriefs: parsed.debriefs ?? [],
    };
  } catch {
    return empty;
  }
}

export function saveLive(next: LiveFile): void {
  const target = file();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(next, null, 2));
}

export function upsertPerson(person: Person): void {
  const live = loadLive();
  const people = live.people.filter((item) => item.slug !== person.slug);
  people.push(person);
  saveLive({ ...live, people });
}

export function saveSource(
  slug: string,
  dossier: Dossier,
  raw: { linkedin: unknown; instagram: unknown },
): void {
  const dir = path.join(process.cwd(), "data", "sources");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify({ dossier, raw }, null, 2));
}

export function addMeeting(meeting: Meeting, fromA: Debrief, fromB: Debrief): void {
  const live = loadLive();
  const meetings = live.meetings.filter(
    (item) =>
      !((item.a === meeting.a && item.b === meeting.b) || (item.a === meeting.b && item.b === meeting.a)),
  );
  meetings.push(meeting);
  const debriefs = live.debriefs.filter(
    (item) =>
      !((item.from === fromA.from && item.to === fromA.to) || (item.from === fromB.from && item.to === fromB.to)),
  );
  debriefs.push(fromA, fromB);
  saveLive({ ...live, meetings, debriefs });
}
