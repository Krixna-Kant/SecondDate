const DENY = new Set(["boldjourneymag", "shoutoutla", "shoutoutsocal", "shoutoutatl", "shoutoutmiami", "explore", "p", "reel", "reels", "stories", "accounts"]);

console.log("index");
const index = await (await fetch("https://boldjourney.com/sitemap.xml")).text();
const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const meet = [];
for (const map of maps) {
  if (map.includes("misc") || map.includes("category") || map.includes("author")) continue;
  const xml = await (await fetch(map)).text();
  const found = [...xml.matchAll(/<loc>([^<]*\/meet-[^<]+)<\/loc>/g)].map((match) => match[1]);
  console.log(found.length, map.split("/").pop());
  meet.push(...found);
  if (meet.length >= 250) break;
}
const pagesToRead = meet.slice(0, 180);
console.log("meet", pagesToRead.length);

const pairs = [];
const seen = new Set();

function take(html) {
  const handles = [...html.matchAll(/instagram\.com\/([A-Za-z0-9._]+)/gi)]
    .map((match) => match[1].replace(/\/$/, "").toLowerCase())
    .filter((handle) => !DENY.has(handle) && handle.length > 2 && !handle.startsWith("boldjourney"));
  const li = html.match(/linkedin\.com\/in\/([A-Za-z0-9\-_%]+)/i);
  if (!li || !handles.length) return null;
  const slug = decodeURIComponent(li[1]).toLowerCase();
  const parts = slug.split(/[^a-z0-9]+/).filter((part) => part.length > 3);
  const handle = handles.find((item) => parts.some((part) => item.includes(part))) ?? handles[0];
  const linkedin = `https://www.linkedin.com/in/${decodeURIComponent(li[1].replace(/\/$/, ""))}`;
  if (seen.has(linkedin)) return null;
  seen.add(linkedin);
  return { linkedin, instagram: `https://www.instagram.com/${handle}/` };
}

for (let i = 0; i < pagesToRead.length && pairs.length < 32; i += 6) {
  const pages = await Promise.all(
    pagesToRead.slice(i, i + 6).map(async (url) => {
      try {
        return take(await (await fetch(url, { signal: AbortSignal.timeout(20000) })).text());
      } catch {
        return null;
      }
    }),
  );
  for (const pair of pages) if (pair) pairs.push(pair);
  console.log("pairs", pairs.length);
}

const extras = [
  { linkedin: "https://www.linkedin.com/in/gretchen-reese", instagram: "https://www.instagram.com/gretchen_reese/" },
  { linkedin: "https://www.linkedin.com/in/megan-zina-624324146", instagram: "https://www.instagram.com/meganzina/" },
  { linkedin: "https://www.linkedin.com/in/cassie-clark-ingram-b630bb1a", instagram: "https://www.instagram.com/cassieclarkingram/" },
  { linkedin: "https://www.linkedin.com/in/tanshaoqi", instagram: "https://www.instagram.com/tanshaoqi/" },
  { linkedin: "https://www.linkedin.com/in/robertoob", instagram: "https://www.instagram.com/robertoortizblanco/" },
  { linkedin: "https://www.linkedin.com/in/rinke-joosten-499538296", instagram: "https://www.instagram.com/studiorinkejoosten/" },
  { linkedin: "https://www.linkedin.com/in/kara-mickelson-0146461a", instagram: "https://www.instagram.com/styleddelicious/" },
  { linkedin: "https://www.linkedin.com/in/mardimiskit", instagram: "https://www.instagram.com/mardikins/" },
];
for (const extra of extras) {
  if (!seen.has(extra.linkedin)) pairs.push(extra);
}

await import("node:fs").then((fs) => fs.writeFileSync("data/roster.json", JSON.stringify(pairs, null, 2)));
console.log("wrote", pairs.length);
console.log(pairs.slice(0, 8).map((pair) => pair.instagram).join("\n"));
