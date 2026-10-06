import assert from "node:assert/strict";
import test from "node:test";
import { toDossier } from "./normalize";
import { readPerson } from "./read";
import { findLine } from "./text";

test("a profile keeps only lines that were on the page", () => {
  const dossier = toDossier(
    "https://www.linkedin.com/in/mira-sen",
    "https://www.instagram.com/mirasen/",
    {
      success: true,
      name: "Mira Sen",
      headline: "I keep Sundays empty on purpose.",
      about: "The kiln and one walk, or the week goes square.",
      location: "Brooklyn",
      currentPositions: [{ title: "Ceramicist", company: "Own studio" }],
    },
    {
      username: "mirasen",
      fullName: "Mira Sen",
      biography: "Clay in the morning.",
      private: false,
      latestPosts: [{ caption: "The river path if the clay behaved today." }],
    },
  );
  const person = readPerson(dossier);
  const evidence = [person.line, person.necessity.evidence, ...person.prompts.map((prompt) => (prompt.label === "How the agent dates" ? person.line : prompt.body))];
  for (const line of evidence) {
    assert.ok(findLine(line, dossier.lines), line);
  }
  assert.equal(findLine("she loves surprise travel", dossier.lines), null);
});
