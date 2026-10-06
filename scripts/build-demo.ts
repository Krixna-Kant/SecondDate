import fs from "node:fs";
import { loadLocalEnv } from "./env";

loadLocalEnv();

type Pair = { linkedin: string; instagram: string };
type Row = Record<string, unknown>;

function token(): string {
  const value = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  if (!value) throw new Error("Add APIFY_TOKEN to .env.");
  return value;
}

function handleOf(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
}

function chunks<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

async function startRun(actor: string, input: unknown): Promise<string> {
  const url = new URL(`https://api.apify.com/v2/acts/${actor}/runs`);
  url.searchParams.set("token", token());
  url.searchParams.set("timeout", "600");
  url.searchParams.set("maxTotalChargeUsd", "0.8");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { data?: { id?: string }; error?: { message?: string } };
  if (!response.ok || !body.data?.id) throw new Error(body.error?.message || `Could not start ${actor}.`);
  return body.data.id;
}

async function waitRun(id: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await fetch(`https://api.apify.com/v2/actor-runs/${id}?token=${token()}`);
    const body = (await response.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    const status = body.data?.status ?? "UNKNOWN";
    if (status === "SUCCEEDED" && body.data?.defaultDatasetId) return body.data.defaultDatasetId;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") throw new Error(`Apify run ${status}.`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  throw new Error("The scrape is still running.");
}

async function datasetItems(id: string): Promise<Row[]> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${id}/items?token=${token()}`);
  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as Row[]) : [];
}

function linkedinKey(row: Row): string {
  const raw = String(row.linkedinUrl || row.inputUrl || row.url || "").toLowerCase();
  const match = raw.match(/linkedin\.com\/in\/([^/?#]+)/);
  return decodeURIComponent(match?.[1] ?? "").replace(/\/$/, "");
}

async function main(): Promise<void> {
  const { readPerson } = await import("../lib/read");
  const { readBlock } = await import("../lib/sources");
  const { toDossier } = await import("../lib/normalize");
  const { savePortrait } = await import("../lib/photo");
  const { loadLive, saveSource, upsertPerson } = await import("../lib/store");
  const { uniqueSlug } = await import("../lib/catalog");
  const { slugify } = await import("../lib/text");

  const pairs = JSON.parse(fs.readFileSync("data/roster.json", "utf8")) as Pair[];
  const sources = "data/sources";
  if (fs.existsSync(sources)) {
    for (const file of fs.readdirSync(sources)) {
      if (!file.endsWith(".json")) continue;
      const saved = JSON.parse(fs.readFileSync(`${sources}/${file}`, "utf8")) as {
        dossier?: { linkedinUrl?: string; instagramUrl?: string };
        linkedin?: unknown;
        instagram?: unknown;
      };
      const linkedinUrl = saved.dossier?.linkedinUrl;
      const instagramUrl = saved.dossier?.instagramUrl;
      if (!linkedinUrl || !instagramUrl || !saved.linkedin || !saved.instagram) continue;
      const dossier = toDossier(linkedinUrl, instagramUrl, saved.linkedin, saved.instagram);
      const block = readBlock(dossier);
      if (block) continue;
      const existing = loadLive().people.find((person) => person.links?.linkedin === linkedinUrl);
      const person = readPerson(dossier, existing?.slug ?? uniqueSlug(slugify(dossier.nameLinkedIn)));
      person.photo = existing?.photo ?? (await savePortrait(person.slug, saved.linkedin, saved.instagram));
      upsertPerson(person);
      console.log("refreshed", person.slug);
    }
  }

  const saved = new Set(loadLive().people.map((person) => person.links?.linkedin));
  const pending = pairs.filter((pair) => !saved.has(pair.linkedin));
  console.log(`Roster ${pairs.length}. New ${pending.length}.`);

  let count = 0;
  for (const group of chunks(pending, 4)) {
    try {
      const linkedinId = await startRun("automation-lab~linkedin-profile-scraper", {
        profileUrls: group.map((pair) => pair.linkedin),
        maxProfiles: group.length,
      });
      const linkedinRows = await datasetItems(await waitRun(linkedinId));
      const instagramId = await startRun("apify~instagram-profile-scraper", {
        usernames: group.map((pair) => handleOf(pair.instagram)),
        includeAboutSection: false,
      });
      const instagramRows = await datasetItems(await waitRun(instagramId));
      const byHandle = new Map(instagramRows.map((row) => [String(row.username || "").toLowerCase(), row]));
      const bySlug = new Map(linkedinRows.map((row) => [linkedinKey(row), row]));

      for (const pair of group) {
        const slug = decodeURIComponent(new URL(pair.linkedin).pathname.split("/").filter(Boolean)[1] ?? "").toLowerCase();
        const linkedin = bySlug.get(slug);
        const instagram = byHandle.get(handleOf(pair.instagram));
        if (!linkedin || !instagram) {
          console.log("missing", slug);
          continue;
        }
        const dossier = toDossier(pair.linkedin, pair.instagram, linkedin, instagram);
        const block = readBlock(dossier);
        if (block) {
          console.log("stop", slug, block);
          continue;
        }
        const person = readPerson(dossier, uniqueSlug(slugify(dossier.nameLinkedIn || dossier.nameInstagram)));
        person.photo = await savePortrait(person.slug, linkedin, instagram);
        upsertPerson(person);
        saveSource(person.slug, dossier, { linkedin, instagram });
        count += 1;
        console.log("saved", person.slug, person.name);
      }
    } catch (error) {
      console.log("batch failed", error instanceof Error ? error.message : error);
    }
  }
  console.log(`Saved ${count}. On file: ${loadLive().people.length}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
