import assert from "node:assert/strict";
import test from "node:test";
import { instagramUsername, namesAlign, parseInstagram, parseLinkedIn, readBlock } from "./sources";
import type { Dossier } from "./sources";

test("official profile urls are accepted and other urls are refused", () => {
  assert.equal(parseLinkedIn("https://www.linkedin.com/in/mira-sen/"), "https://www.linkedin.com/in/mira-sen");
  assert.equal(parseLinkedIn("https://www.linkedin.com/company/acme"), null);
  assert.equal(parseInstagram("https://instagram.com/mirasen/"), "https://www.instagram.com/mirasen/");
  assert.equal(parseInstagram("https://instagram.com/p/abc123"), null);
  assert.equal(instagramUsername("https://www.instagram.com/mirasen/"), "mirasen");
});

function dossier(partial: Partial<Dossier> = {}): Dossier {
  return {
    linkedinUrl: "https://www.linkedin.com/in/mira-sen",
    instagramUrl: "https://www.instagram.com/mirasen/",
    nameLinkedIn: "Mira Sen",
    nameInstagram: "Mira Sen",
    username: "mirasen",
    headline: "I keep Sundays empty on purpose.",
    about: "The kiln and one walk.",
    location: "Brooklyn",
    bio: "Clay, then the river.",
    privateAccount: false,
    loginWalled: false,
    lines: [
      { platform: "LinkedIn", detail: "Headline", text: "I keep Sundays empty on purpose." },
      { platform: "Instagram", detail: "Bio", text: "Clay, then the river path if the week behaved." },
    ],
    ...partial,
  };
}

test("a private instagram, a login wall, and a mismatched pair stop", () => {
  assert.match(readBlock(dossier({ privateAccount: true })) ?? "", /private/);
  assert.match(readBlock(dossier({ loginWalled: true, nameLinkedIn: "" })) ?? "", /logged-out/);
  assert.match(
    readBlock(dossier({ nameInstagram: "Alex Rivera", username: "arivera", about: "", headline: "Designer" })) ?? "",
    /same person/,
  );
  assert.equal(readBlock(dossier()), null);
});

test("a shared last name or a handle written on linkedin counts as the same person", () => {
  assert.equal(namesAlign("Mira Sen", "Mira S.", "m", ""), true);
  assert.equal(namesAlign("Alex Kim", "Alex Rivera", "arivera", "Designer in Lisbon"), false);
  assert.equal(namesAlign("Alex Kim", "", "alexkim", "Find me at alexkim"), true);
});
