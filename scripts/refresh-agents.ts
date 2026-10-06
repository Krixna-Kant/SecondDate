import fs from "node:fs";
import path from "node:path";
import { readPerson } from "../lib/read";
import type { Dossier } from "../lib/sources";
import { loadLive, saveLive } from "../lib/store";

const live = loadLive();
let refreshed = 0;
const people = live.people.map((person) => {
  const file = path.join(process.cwd(), "data", "sources", `${person.slug}.json`);
  if (!fs.existsSync(file)) return person;
  const saved = JSON.parse(fs.readFileSync(file, "utf8")) as { dossier?: Dossier };
  if (!saved.dossier?.lines?.length) return person;
  const next = readPerson(saved.dossier, person.slug);
  next.photo = person.photo;
  refreshed += 1;
  return next;
});
saveLive({ ...live, people });
console.log(`Agents refreshed: ${refreshed} of ${people.length}.`);
