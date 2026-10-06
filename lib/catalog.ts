import {
  debriefs as fixtureDebriefs,
  meetings as fixtureMeetings,
  people as fixturePeople,
  agentName,
} from "./fixtures";
import { rankDebriefs } from "./rank";
import { loadLive } from "./store";
import type { Debrief, Meeting, Person } from "./types";

export { agentName };

function liveMode(): boolean {
  return loadLive().people.some((person) => person.links);
}

export function allPeople(): Person[] {
  const live = loadLive().people.filter((person) => person.links);
  if (live.length) return live;
  return fixturePeople;
}

export function allMeetings(): Meeting[] {
  if (liveMode()) return loadLive().meetings;
  return fixtureMeetings;
}

export function getPerson(slug: string): Person | undefined {
  return allPeople().find((person) => person.slug === slug);
}

export function rankingFor(slug: string): Debrief[] {
  const rows = (liveMode() ? loadLive().debriefs : fixtureDebriefs).filter((debrief) => debrief.from === slug);
  if (!rows.length) return [];
  return rankDebriefs(rows);
}

export function debriefBetween(from: string, to: string): Debrief | undefined {
  const live = loadLive().debriefs.find((debrief) => debrief.from === from && debrief.to === to);
  if (live) return live;
  if (liveMode()) return undefined;
  return fixtureDebriefs.find((debrief) => debrief.from === from && debrief.to === to);
}

export function meetingBetween(a: string, b: string): Meeting | undefined {
  const live = loadLive().meetings.find(
    (meeting) => (meeting.a === a && meeting.b === b) || (meeting.a === b && meeting.b === a),
  );
  if (live) return live;
  if (liveMode()) return undefined;
  return fixtureMeetings.find(
    (meeting) => (meeting.a === a && meeting.b === b) || (meeting.a === b && meeting.b === a),
  );
}

export function uniqueSlug(preferred: string): string {
  const taken = new Set(allPeople().map((person) => person.slug));
  if (!taken.has(preferred)) return preferred;
  let n = 2;
  while (taken.has(`${preferred}-${n}`)) n += 1;
  return `${preferred}-${n}`;
}
