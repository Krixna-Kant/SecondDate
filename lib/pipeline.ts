import { allPeople, uniqueSlug } from "./catalog";
import { model } from "./llm";
import { extendToNight, runShortMeeting } from "./meeting";
import { priorBetween } from "./prior";
import { readPerson } from "./read";
import { scrapePair } from "./scrape";
import { parseInstagram, parseLinkedIn, readBlock } from "./sources";
import { slugify } from "./text";
import { savePortrait } from "./photo";
import { addMeeting, saveSource, upsertPerson } from "./store";

export async function ingestPair(
  linkedinInput: string,
  instagramInput: string,
  options?: { dates?: boolean },
): Promise<{ slug: string; dated: boolean; notice: string | null }> {
  const linkedin = parseLinkedIn(linkedinInput);
  const instagram = parseInstagram(instagramInput);
  if (!linkedin) throw new Error("Paste an official LinkedIn profile: linkedin.com/in/…");
  if (!instagram) throw new Error("Paste an official public Instagram profile.");

  const scraped = await scrapePair(linkedin, instagram);
  const dossier = scraped.dossier;
  const block = readBlock(dossier);
  if (block) throw new Error(block);

  const person = readPerson(dossier, uniqueSlug(slugify(dossier.nameLinkedIn || dossier.nameInstagram)));
  person.photo = await savePortrait(person.slug, scraped.linkedin, scraped.instagram);
  upsertPerson(person);
  saveSource(person.slug, dossier, { linkedin: scraped.linkedin, instagram: scraped.instagram });

  const dates = options?.dates !== false;
  const llm = model();
  if (!dates || !llm) {
    return {
      slug: person.slug,
      dated: false,
      notice: llm
        ? "The profile is saved. Dates run with the rest of the list."
        : "The profile is saved. Add GROQ_API_KEY or GEMINI_API_KEY in .env to send the agent on dates.",
    };
  }

  await sendOnDates(person.slug);
  return { slug: person.slug, dated: true, notice: null };
}

/** Dates the closest people on paper. Anyone who does not want a second date goes on to the next. */
export async function sendOnDates(slug: string, limit = Number(process.env.ADD_DATES || 3)): Promise<number> {
  const llm = model();
  const person = allPeople().find((item) => item.slug === slug);
  if (!llm || !person) return 0;
  const others = allPeople()
    .filter((other) => other.slug !== person.slug && Boolean(other.links))
    .map((other) => ({ other, prior: priorBetween(person, other) }))
    .sort((a, b) => b.prior - a.prior)
    .slice(0, limit);

  let ran = 0;
  for (const { other } of others) {
    try {
      const short = await runShortMeeting(person, other, llm);
      const wantsMore = short.fromA.decision === "yes" || short.fromB.decision === "yes";
      if (wantsMore) {
        const night = await extendToNight(person, other, llm, short.meeting);
        addMeeting(night.meeting, night.fromA, night.fromB);
      } else {
        addMeeting(short.meeting, short.fromA, short.fromB);
      }
      ran += 1;
      if (short.fromA.decision === "yes") break;
    } catch (error) {
      console.error(`date ${person.slug} × ${other.slug}:`, error instanceof Error ? error.message : error);
    }
  }
  return ran;
}
