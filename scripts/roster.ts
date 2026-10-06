import fs from "node:fs";
import { ingestPair } from "../lib/pipeline";
import { loadLocalEnv } from "./env";

loadLocalEnv();

const file = "data/roster.json";
if (!fs.existsSync(file)) {
  console.error("Add data/roster.json as a list of { linkedin, instagram }.");
  process.exit(1);
}

const pairs = JSON.parse(fs.readFileSync(file, "utf8")) as { linkedin: string; instagram: string }[];
if (!Array.isArray(pairs) || pairs.length === 0) {
  console.error("data/roster.json is empty. Each entry needs a public LinkedIn /in/ URL and that person's public Instagram.");
  process.exit(1);
}

async function main(): Promise<void> {
  for (const pair of pairs) {
    const result = await ingestPair(pair.linkedin, pair.instagram, { dates: false });
    console.log(result.slug);
  }
  console.log("Profiles are saved. Run npm run season to date every pair.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
