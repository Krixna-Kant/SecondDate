import { loadLocalEnv } from "./env";

loadLocalEnv();

const PAIRS: [string, string][] = [
  ["alexhormozi", "hormozi"],
  ["leilahormozi", "leilahormozi"],
  ["melrobbins", "melrobbins"],
  ["jamesclear", "jamesclear"],
  ["ryanholiday", "ryanholiday"],
  ["marieforleo", "marieforleo"],
  ["sahilbloom", "sahilbloom"],
  ["codiesanchez", "codiesanchez"],
  ["justinwelsh", "justinwelsh"],
  ["melanieperkins", "melaniecanva"],
  ["andrewyng", "andrewng"],
  ["yann-lecun", "yannlecun"],
  ["marcbenioff", "benioff"],
  ["timferriss", "timferriss"],
  ["markmanson", "markmanson"],
  ["shettyjay", "jayshetty"],
  ["noahkagan", "noahkagan"],
  ["tombilyeu", "tombilyeu"],
  ["grantcardone", "grantcardone"],
  ["navalravikant", "naval"],
  ["lexfridman", "lexfridman"],
  ["angeladuckworth", "angeladuckworth"],
  ["dharmesh", "dharmesh"],
  ["patrickbetdavid", "patrickbetdavid"],
];

function token(): string {
  const value = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  if (!value) throw new Error("Add APIFY_TOKEN to .env.");
  return value;
}

async function startRun(actor: string, input: unknown): Promise<string> {
  const url = new URL(`https://api.apify.com/v2/acts/${actor}/runs`);
  url.searchParams.set("token", token());
  url.searchParams.set("timeout", "600");
  url.searchParams.set("maxTotalChargeUsd", "2");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { data?: { id?: string }; error?: { message?: string } };
  if (!response.ok || !body.data?.id) throw new Error(body.error?.message || `Could not start ${actor}.`);
  console.log("started", actor, body.data.id.slice(0, 8));
  return body.data.id;
}

async function waitRun(id: string): Promise<string> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const response = await fetch(`https://api.apify.com/v2/actor-runs/${id}?token=${token()}`);
    const body = (await response.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    const status = body.data?.status ?? "UNKNOWN";
    if (attempt % 2 === 0) console.log(id.slice(0, 6), status);
    if (status === "SUCCEEDED" && body.data?.defaultDatasetId) return body.data.defaultDatasetId;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") throw new Error(`Apify run ${status}.`);
    await new Promise((resolve) => setTimeout(resolve, 8000));
  }
  throw new Error("The scrape is still running.");
}

async function items(datasetId: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token()}`);
  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
}

function slugOf(row: Record<string, unknown>): string {
  const raw = String(row.linkedinUrl || row.inputUrl || row.url || row.profileUrl || "").toLowerCase();
  const match = raw.match(/linkedin\.com\/in\/([^/?#]+)/);
  return decodeURIComponent(match?.[1] ?? "").replace(/\/$/, "");
}

async function main(): Promise<void> {
  const [linkedinId, instagramId] = await Promise.all([
    startRun("automation-lab~linkedin-profile-scraper", {
      profileUrls: PAIRS.map(([slug]) => `https://www.linkedin.com/in/${slug}`),
      maxProfiles: PAIRS.length,
    }),
    startRun("apify~instagram-profile-scraper", {
      usernames: PAIRS.map((pair) => pair[1]),
      includeAboutSection: false,
    }),
  ]);
  const [linkedinRows, instagramRows] = await Promise.all([
    waitRun(linkedinId).then(items),
    waitRun(instagramId).then(items),
  ]);
  console.log("rows", linkedinRows.length, instagramRows.length);

  const { readPerson } = await import("../lib/read");
  const { readBlock } = await import("../lib/sources");
  const { toDossier } = await import("../lib/normalize");
  const { savePortrait } = await import("../lib/photo");
  const { saveSource, loadLive } = await import("../lib/store");
  const { uniqueSlug } = await import("../lib/catalog");
  const { slugify } = await import("../lib/text");

  const bySlug = new Map(linkedinRows.map((row) => [slugOf(row), row]));
  const byHandle = new Map(instagramRows.map((row) => [String(row.username || "").toLowerCase(), row]));
  const ready: {
    person: ReturnType<typeof readPerson>;
    linkedin: Record<string, unknown>;
    instagram: Record<string, unknown>;
    dossier: ReturnType<typeof toDossier>;
  }[] = [];

  for (const [slug, handle] of PAIRS) {
    const linkedin = bySlug.get(slug);
    const instagram = byHandle.get(handle);
    if (!linkedin || !instagram) {
      console.log("missing", slug);
      continue;
    }
    const dossier = toDossier(`https://www.linkedin.com/in/${slug}`, `https://www.instagram.com/${handle}/`, linkedin, instagram);
    const block = readBlock(dossier);
    if (block) {
      console.log("stop", slug, block);
      continue;
    }
    try {
      const person = readPerson(dossier, uniqueSlug(slugify(dossier.nameLinkedIn || dossier.nameInstagram)));
      ready.push({ person, linkedin, instagram, dossier });
    } catch (error) {
      console.log("stop", slug, error instanceof Error ? error.message : error);
    }
  }

  const portraits = await Promise.all(ready.map((row) => savePortrait(row.person.slug, row.linkedin, row.instagram)));
  const live = loadLive();
  for (const [index, row] of ready.entries()) {
    row.person.photo = portraits[index];
    live.people = live.people.filter((item) => item.links?.linkedin !== row.person.links?.linkedin);
    live.people.push(row.person);
    saveSource(row.person.slug, row.dossier, { linkedin: row.linkedin, instagram: row.instagram });
    console.log("saved", row.person.name, row.person.role);
  }
  const { saveLive } = await import("../lib/store");
  saveLive(live);
  console.log(`Saved ${ready.length}. On file: ${live.people.length}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
