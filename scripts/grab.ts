import { loadLocalEnv } from "./env";

loadLocalEnv();

const PAIRS: [string, string][] = [
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
];

function token(): string {
  const value = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  if (!value) throw new Error("Add APIFY_TOKEN to .env.");
  return value;
}

async function items(datasetId: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token()}`);
  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
}

function slugOf(row: Record<string, unknown>): string {
  const raw = String(row.linkedinUrl || row.inputUrl || row.url || "").toLowerCase();
  const match = raw.match(/linkedin\.com\/in\/([^/?#]+)/);
  return decodeURIComponent(match?.[1] ?? "").replace(/\/$/, "");
}

async function main(): Promise<void> {
  const listed = await fetch(`https://api.apify.com/v2/actor-runs?token=${token()}&limit=8&desc=1`);
  const body = (await listed.json()) as {
    data?: { items?: { id: string; defaultDatasetId: string }[] };
  };
  const datasets = await Promise.all((body.data?.items ?? []).map((run) => items(run.defaultDatasetId)));
  const linkedinRows = datasets.find((rows) => rows.some((row) => "linkedinUrl" in row || "headline" in row)) ?? [];
  const instagramRows = datasets.find((rows) => rows.some((row) => "username" in row && "biography" in row)) ?? [];
  console.log("linkedin", linkedinRows.length, "instagram", instagramRows.length);

  const { readPerson } = await import("../lib/read");
  const { readBlock } = await import("../lib/sources");
  const { toDossier } = await import("../lib/normalize");
  const { savePortrait } = await import("../lib/photo");
  const { saveSource, loadLive } = await import("../lib/store");
  const { uniqueSlug } = await import("../lib/catalog");
  const { slugify } = await import("../lib/text");

  const bySlug = new Map(linkedinRows.map((row) => [slugOf(row), row]));
  const byHandle = new Map(instagramRows.map((row) => [String(row.username || "").toLowerCase(), row]));

  const ready: { slug: string; person: ReturnType<typeof readPerson>; linkedin: Record<string, unknown>; instagram: Record<string, unknown>; dossier: ReturnType<typeof toDossier> }[] = [];
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
    const person = readPerson(dossier, uniqueSlug(slugify(dossier.nameLinkedIn || dossier.nameInstagram)));
    ready.push({ slug, person, linkedin, instagram, dossier });
  }

  const portraits = await Promise.all(ready.map((row) => savePortrait(row.person.slug, row.linkedin, row.instagram)));
  const live = loadLive();
  for (const [index, row] of ready.entries()) {
    row.person.photo = portraits[index];
    live.people = live.people.filter((item) => item.slug !== row.person.slug);
    live.people.push(row.person);
    saveSource(row.person.slug, row.dossier, { linkedin: row.linkedin, instagram: row.instagram });
    console.log("saved", row.person.name);
  }
  const { saveLive } = await import("../lib/store");
  saveLive(live);
  console.log(`Saved ${ready.length}. On file: ${live.people.length}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
