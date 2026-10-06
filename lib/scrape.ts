import { normalizeInstagram, normalizeLinkedIn, toDossier } from "./normalize";
import { instagramUsername } from "./sources";
import type { Dossier } from "./sources";

const LINKEDIN_ACTOR = "automation-lab~linkedin-profile-scraper";
const INSTAGRAM_ACTOR = "apify~instagram-profile-scraper";

export function apifyToken(): string | null {
  return process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || null;
}

async function runActor(token: string, actor: string, input: unknown): Promise<unknown> {
  const url = new URL(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`);
  url.searchParams.set("token", token);
  url.searchParams.set("timeout", "180");
  url.searchParams.set("maxTotalChargeUsd", "0.5");
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(200_000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("The pages took too long to read. Try again in a minute.");
    }
    throw error;
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("Apify refused the token. Check APIFY_TOKEN in .env.");
  }
  if (response.status === 402) {
    throw new Error("The Apify free credit is used up for this month.");
  }
  if (!response.ok) {
    throw new Error(`The scrape failed (${response.status}).`);
  }
  const payload = (await response.json()) as unknown;
  if (Array.isArray(payload)) return payload[0] ?? {};
  return payload;
}

export async function scrapePair(
  linkedinUrl: string,
  instagramUrl: string,
): Promise<{ dossier: Dossier; linkedin: unknown; instagram: unknown }> {
  const token = apifyToken();
  if (!token) {
    throw new Error("Add APIFY_TOKEN to .env. A free Apify account is enough.");
  }
  const [linkedin, instagram] = await Promise.all([
    runActor(token, LINKEDIN_ACTOR, { profileUrls: [linkedinUrl], maxProfiles: 1 }),
    runActor(token, INSTAGRAM_ACTOR, {
      usernames: [instagramUsername(instagramUrl)],
      includeAboutSection: false,
    }),
  ]);
  return {
    dossier: toDossier(linkedinUrl, instagramUrl, linkedin, instagram),
    linkedin,
    instagram,
  };
}

export { normalizeInstagram, normalizeLinkedIn };
