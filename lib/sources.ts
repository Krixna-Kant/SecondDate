export type Platform = "LinkedIn" | "Instagram";

export type EvidenceLine = {
  platform: Platform;
  detail: string;
  text: string;
};

export type Dossier = {
  linkedinUrl: string;
  instagramUrl: string;
  nameLinkedIn: string;
  nameInstagram: string;
  username: string;
  headline: string;
  about: string;
  location: string;
  bio: string;
  privateAccount: boolean;
  loginWalled: boolean;
  lines: EvidenceLine[];
};

const STOP = new Set(["the", "and", "for", "with", "from", "that", "this", "official"]);

export function parseLinkedIn(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "linkedin.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "in" || !parts[1]) return null;
  const slug = decodeURIComponent(parts[1]).replace(/\/$/, "");
  if (!/^[A-Za-z0-9\-_%]+$/.test(slug)) return null;
  return `https://www.linkedin.com/in/${slug}`;
}

export function parseInstagram(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "instagram.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const blocked = new Set(["p", "reel", "reels", "stories", "explore", "accounts"]);
  if (!parts[0] || blocked.has(parts[0].toLowerCase())) return null;
  const user = parts[0].replace(/^@/, "");
  if (!/^[A-Za-z0-9._]+$/.test(user)) return null;
  return `https://www.instagram.com/${user}/`;
}

export function instagramUsername(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
}

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 3 && !STOP.has(part));
}

export function namesAlign(linkedinName: string, instagramName: string, username: string, linkedinText: string): boolean {
  const left = tokens(linkedinName);
  const right = tokens(instagramName);
  if (left.length && right.length) {
    const lastLeft = left[left.length - 1];
    const lastRight = right[right.length - 1];
    if (lastLeft === lastRight) return true;
    const shared = left.filter((part) => right.includes(part));
    if (shared.length >= 2) return true;
    if (left.length === 1 && right.includes(left[0])) return true;
    if (right.length === 1 && left.includes(right[0])) return true;
  }
  const handle = username.toLowerCase().replace(/[^a-z0-9]/g, "");
  const blob = linkedinText.toLowerCase().replace(/[^a-z0-9]/g, "");
  return handle.length >= 4 && blob.includes(handle);
}

export function readBlock(dossier: Pick<Dossier, "privateAccount" | "loginWalled" | "nameLinkedIn" | "nameInstagram" | "username" | "about" | "headline" | "lines">): string | null {
  if (dossier.privateAccount) {
    return "That Instagram account is private. Paste a public profile.";
  }
  if (dossier.loginWalled || !dossier.nameLinkedIn.trim()) {
    return "That LinkedIn page did not load for a logged-out visitor. Paste a public profile.";
  }
  if (dossier.lines.filter((line) => line.text.trim().length >= 12).length < 2) {
    return "Those pages did not contain enough public text to read.";
  }
  const aligned = namesAlign(
    dossier.nameLinkedIn,
    dossier.nameInstagram,
    dossier.username,
    `${dossier.about} ${dossier.headline}`,
  );
  if (!aligned) return "Those two profiles do not look like the same person.";
  return null;
}
