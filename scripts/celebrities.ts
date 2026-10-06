import { loadLocalEnv } from "./env";

loadLocalEnv();

const PAIRS: { linkedin: string; instagram: string }[] = [
  ["williamhgates", "thisisbillgates"],
  ["satyanadella", "satyanadella"],
  ["reidhoffman", "reidhoffman"],
  ["rbranson", "richardbranson"],
  ["jeffweiner08", "jeffweiner"],
  ["ariannahuffington", "ariannahuff"],
  ["brianchesky", "bchesky"],
  ["drewhouston", "drewhouston"],
  ["markcuban", "markcuban"],
  ["garyvaynerchuk", "garyvee"],
  ["simonsinek", "simonsinek"],
  ["adamgrant", "adamgrant"],
  ["brenebrown", "brenebrown"],
  ["tonyrobbins", "tonyrobbins"],
  ["michelleobama", "michelleobama"],
  ["barackobama", "barackobama"],
  ["priyankachopra", "priyankachopra"],
  ["deepikapadukone", "deepikapadukone"],
  ["viratkohli", "virat.kohli"],
  ["rogerfederer", "rogerfederer"],
  ["serenawilliams", "serenawilliams"],
  ["kevinhart4real", "kevinhart4real"],
  ["sarablakely", "sarablakely"],
  ["sherylsandberg", "sherylsandberg"],
  ["sundarpichai", "sundarpichai"],
  ["timcook", "timcook"],
  ["cristiano", "cristiano"],
  ["leomessi", "leomessi"],
  ["melindagates", "melindafrenchgates"],
  ["oprah", "oprah"],
].map(([slug, handle]) => ({
  linkedin: `https://www.linkedin.com/in/${slug}`,
  instagram: `https://www.instagram.com/${handle}/`,
}));

function token(): string {
  const value = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  if (!value) throw new Error("Add APIFY_TOKEN to .env.");
  return value;
}

async function startRun(actor: string, input: unknown): Promise<string> {
  const url = new URL(`https://api.apify.com/v2/acts/${actor}/runs`);
  url.searchParams.set("token", token());
  url.searchParams.set("timeout", "900");
  url.searchParams.set("maxTotalChargeUsd", "3");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { data?: { id?: string }; error?: { message?: string } };
  if (!response.ok || !body.data?.id) throw new Error(body.error?.message || `Could not start ${actor}.`);
  console.log("started", actor);
  return body.data.id;
}

async function waitRun(id: string): Promise<string> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const response = await fetch(`https://api.apify.com/v2/actor-runs/${id}?token=${token()}`);
    const body = (await response.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    const status = body.data?.status ?? "UNKNOWN";
    if (attempt % 3 === 0) console.log(id.slice(0, 6), status);
    if (status === "SUCCEEDED" && body.data?.defaultDatasetId) return body.data.defaultDatasetId;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") throw new Error(`Apify run ${status}.`);
    await new Promise((resolve) => setTimeout(resolve, 8000));
  }
  throw new Error("The scrape is still running.");
}

async function datasetItems(id: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${id}/items?token=${token()}`);
  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
}

function linkedinKey(row: Record<string, unknown>): string {
  const raw = String(row.linkedinUrl || row.inputUrl || row.url || row.profileUrl || "").toLowerCase();
  const match = raw.match(/linkedin\.com\/in\/([^/?#]+)/);
  return decodeURIComponent(match?.[1] ?? raw).replace(/\/$/, "");
}

async function main(): Promise<void> {
  const { readPerson } = await import("../lib/read");
  const { readBlock } = await import("../lib/sources");
  const { toDossier } = await import("../lib/normalize");
  const { savePortrait } = await import("../lib/photo");
  const { saveSource, upsertPerson, loadLive } = await import("../lib/store");
  const { uniqueSlug } = await import("../lib/catalog");
  const { slugify } = await import("../lib/text");

  const [linkedinId, instagramId] = await Promise.all([
    startRun("automation-lab~linkedin-profile-scraper", {
      profileUrls: PAIRS.map((pair) => pair.linkedin),
      maxProfiles: PAIRS.length,
    }),
    startRun("apify~instagram-profile-scraper", {
      usernames: PAIRS.map((pair) => pair.instagram.split("/").filter(Boolean).pop()),
      includeAboutSection: false,
    }),
  ]);
  const [linkedinRows, instagramRows] = await Promise.all([
    waitRun(linkedinId).then(datasetItems),
    waitRun(instagramId).then(datasetItems),
  ]);
  console.log("rows", linkedinRows.length, instagramRows.length);
  const bySlug = new Map(linkedinRows.map((row) => [linkedinKey(row), row]));
  const byHandle = new Map(instagramRows.map((row) => [String(row.username || "").toLowerCase(), row]));

  let count = 0;
  for (const pair of PAIRS) {
    const slug = pair.linkedin.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
    const handle = pair.instagram.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
    const linkedin = bySlug.get(slug);
    const instagram = byHandle.get(handle);
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
    console.log("saved", person.name);
  }
  console.log(`Saved ${count}. On file: ${loadLive().people.length}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
