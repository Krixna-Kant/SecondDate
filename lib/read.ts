import { findLine, monogram, slugify, tintFor } from "./text";
import type { Dossier } from "./sources";
import type { Person, Prompt } from "./types";

function distinct(lines: Dossier["lines"]): Dossier["lines"] {
  return lines.filter((line) => line.text.trim().length >= 12);
}

function clean(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\*+/g, " ").replace(/\s+/g, " ").trim();
}

function usable(line: Dossier["lines"][number]): boolean {
  const stars = (line.text.match(/\*/g) ?? []).length;
  return line.detail !== "Location" && stars / line.text.length <= 0.25;
}

export function readPerson(dossier: Dossier, slug = slugify(dossier.nameLinkedIn || dossier.nameInstagram)): Person {
  const lines = distinct(dossier.lines);
  const pool = lines.filter(usable);
  const source = pool.length >= 2 ? pool : lines;
  const headline = source.find((item) => item.detail === "Headline");
  const about = source.find((item) => item.detail === "About");
  const bio = source.find((item) => item.detail === "Bio");
  const captions = source.filter((item) => item.detail.startsWith("Caption"));
  const stories = captions.filter((item) => item.text.length >= 40);
  const life = stories.length ? stories : captions;
  const line =
    (about && about.text.length >= 40 ? about : undefined) ??
    (headline && headline.text.length >= 24 ? headline : undefined) ??
    about ??
    bio ??
    source[0];
  if (!line) throw new Error("A profile line was not found on either page.");
  const used = new Set<string>([line.text]);
  const take = (...candidates: Array<Dossier["lines"][number] | undefined>) => {
    for (const item of candidates) {
      if (item && !used.has(item.text)) {
        used.add(item.text);
        return item;
      }
    }
    const next = source.find((item) => !used.has(item.text));
    if (next) used.add(next.text);
    return next ?? line;
  };
  const need = take(bio, about, life[0], headline);
  const sunday = take(life[0], about, life[1], headline);
  const interest = take(life[1], life[2], about, bio);
  const roleLine = lines.find((item) => item.detail === "Experience" && usable(item)) ?? headline;
  const prompts: Prompt[] = [
    { label: "A need", body: need.text, source: { platform: need.platform, detail: need.detail } },
    { label: "A Sunday", body: sunday.text, source: { platform: sunday.platform, detail: sunday.detail } },
    { label: "Into", body: interest.text, source: { platform: interest.platform, detail: interest.detail } },
    {
      label: "How the agent dates",
      body: `Starts from their own line: “${line.text}”`,
      source: { platform: line.platform, detail: line.detail },
    },
  ];
  for (const prompt of prompts) {
    const evidence = prompt.label === "How the agent dates" ? line.text : prompt.body;
    if (!findLine(evidence, lines)) {
      throw new Error("A profile line was not found on either page.");
    }
  }
  const name = dossier.nameLinkedIn || dossier.nameInstagram;
  const world = source
    .map((item) => clean(item.text))
    .filter((text, index, all) => text.length >= 20 && all.indexOf(text) === index)
    .slice(0, 12)
    .map((text) => (text.length > 240 ? `${text.slice(0, 237)}…` : text));
  return {
    slug,
    name,
    monogram: monogram(name),
    tint: tintFor(name),
    role: roleLine?.text ?? dossier.headline ?? "Public profile",
    city: dossier.location || "Public profile",
    line: line.text,
    lineSource: { platform: line.platform, detail: line.detail },
    necessity: {
      text: need.text,
      evidence: need.text,
      source: { platform: need.platform, detail: need.detail },
    },
    prompts,
    world,
    links: { linkedin: dossier.linkedinUrl, instagram: dossier.instagramUrl },
  };
}
