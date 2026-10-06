import fs from "node:fs";
import path from "node:path";
import { asRecord, asText } from "./text";

export async function savePortrait(slug: string, linkedin: unknown, instagram: unknown): Promise<string | undefined> {
  const li = asRecord(linkedin);
  const ig = asRecord(instagram);
  const url = asText(ig.profilePicUrlHD) || asText(ig.profilePicUrl) || asText(li.profileImageUrl);
  if (!url.startsWith("http")) return undefined;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 500) return undefined;
    const dir = path.join(process.cwd(), "public", "portraits");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.jpg`), bytes);
    return `/portraits/${slug}.jpg`;
  } catch {
    return undefined;
  }
}
