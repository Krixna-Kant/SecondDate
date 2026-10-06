import type { Person } from "./types";

const STOP = new Set(
  (
    "a an the and or of to for in on with from at by their they them this that is are was be it as " +
    "about after again also around been before being both could each even every from have here into just " +
    "know like made make many more most much need never next only other over really same should some still " +
    "such than then there these thing things think thinking those through time very want were what when where " +
    "which while will would year years your yours today united states kingdom california francisco york city"
  ).split(" "),
);

function tokens(person: Person): Set<string> {
  const blob = [person.role, person.city, person.line, person.necessity.text, ...person.prompts.map((prompt) => prompt.body)].join(" ");
  return new Set(
    blob
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((part) => part.length >= 4 && !STOP.has(part)),
  );
}

export function sharedWords(a: Person, b: Person, limit = 3): string[] {
  const right = tokens(b);
  return [...tokens(a)].filter((token) => right.has(token) && !/^\d+$/.test(token)).slice(0, limit);
}

/** Tie-break only. Higher means more shared public language. */
export function priorBetween(a: Person, b: Person): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : Math.round((shared / union) * 1000) / 1000;
}
