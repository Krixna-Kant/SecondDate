import type { EvidenceLine } from "./sources";

export function norm(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function findLine(evidence: string, lines: EvidenceLine[]): EvidenceLine | null {
  const needle = norm(evidence);
  if (needle.length < 12) return null;
  return lines.find((line) => norm(line.text).includes(needle)) ?? null;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function asText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "person";
}

const TINTS = ["#e6d3c4", "#ddd4c8", "#ead9cc", "#d7cfc4", "#e4d5cb", "#d9c8bc"];

export function tintFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % TINTS.length;
  return TINTS[hash] ?? TINTS[0];
}

export function monogram(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "•";
}
