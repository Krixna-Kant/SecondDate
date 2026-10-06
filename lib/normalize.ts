import { asRecord, asText } from "./text";
import { instagramUsername } from "./sources";
import type { Dossier, EvidenceLine } from "./sources";

type Raw = Record<string, unknown>;

function linesFrom(parts: Array<EvidenceLine | null>): EvidenceLine[] {
  const seen = new Set<string>();
  const lines: EvidenceLine[] = [];
  for (const part of parts) {
    if (!part) continue;
    const text = part.text.replace(/\s+/g, " ").trim();
    if (text.length < 12) continue;
    if ((text.match(/\*/g) ?? []).length > text.length * 0.25) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ ...part, text });
  }
  return lines;
}

function experienceLines(raw: Raw): EvidenceLine[] {
  const groups = [raw.currentPositions, raw.experience, raw.positions];
  const lines: EvidenceLine[] = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      const row = asRecord(item);
      const title = asText(row.title);
      const company = asText(row.company || row.companyName);
      const text = [title, company].filter(Boolean).join(" at ");
      if (text) lines.push({ platform: "LinkedIn", detail: "Experience", text });
    }
  }
  return lines;
}

export function normalizeLinkedIn(url: string, raw: unknown): { name: string; headline: string; about: string; location: string; loginWalled: boolean; lines: EvidenceLine[] } {
  const row = asRecord(raw);
  const error = asText(row.error);
  const name = asText(row.name || row.fullName);
  const headline = asText(row.headline);
  const about = asText(row.about || row.summary);
  const location = asText(row.location);
  const loginWalled = row.success === false || (!name && !headline && !about) || /login|authwall|sign in/i.test(error);
  return {
    name,
    headline,
    about,
    location,
    loginWalled,
    lines: linesFrom([
      headline ? { platform: "LinkedIn", detail: "Headline", text: headline } : null,
      about ? { platform: "LinkedIn", detail: "About", text: about } : null,
      location ? { platform: "LinkedIn", detail: "Location", text: location } : null,
      ...experienceLines(row),
    ]),
  };
}

export function normalizeInstagram(url: string, raw: unknown): { name: string; username: string; bio: string; privateAccount: boolean; lines: EvidenceLine[] } {
  const row = asRecord(raw);
  const username = asText(row.username) || instagramUsername(url);
  const name = asText(row.fullName || row.full_name || row.name);
  const bio = asText(row.biography || row.bio);
  const privateAccount = row.private === true || row.isPrivate === true || row.is_private === true;
  const posts = Array.isArray(row.latestPosts) ? row.latestPosts : Array.isArray(row.posts) ? row.posts : [];
  const captions: EvidenceLine[] = posts.slice(0, 12).map((post, index) => {
    const item = asRecord(post);
    return {
      platform: "Instagram" as const,
      detail: `Caption · ${index + 1}`,
      text: asText(item.caption || item.text),
    };
  });
  return {
    name,
    username,
    bio,
    privateAccount,
    lines: linesFrom([
      bio ? { platform: "Instagram", detail: "Bio", text: bio } : null,
      ...captions,
    ]),
  };
}

export function toDossier(linkedinUrl: string, instagramUrl: string, linkedinRaw: unknown, instagramRaw: unknown): Dossier {
  const linkedin = normalizeLinkedIn(linkedinUrl, linkedinRaw);
  const instagram = normalizeInstagram(instagramUrl, instagramRaw);
  return {
    linkedinUrl,
    instagramUrl,
    nameLinkedIn: linkedin.name,
    nameInstagram: instagram.name,
    username: instagram.username,
    headline: linkedin.headline,
    about: linkedin.about,
    location: linkedin.location,
    bio: instagram.bio,
    privateAccount: instagram.privateAccount,
    loginWalled: linkedin.loginWalled,
    lines: [...linkedin.lines, ...instagram.lines],
  };
}
