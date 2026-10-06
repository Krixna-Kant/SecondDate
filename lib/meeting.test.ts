import assert from "node:assert/strict";
import test from "node:test";
import type { Llm } from "./llm";
import { quoteIsIn, runShortMeeting, settleDebrief } from "./meeting";
import { rankDebriefs } from "./rank";
import type { Debrief, Person, Turn } from "./types";

const turns: Turn[] = [
  { speaker: "Jonah's agent", text: "Is the path a reward, or how you come down?" },
  { speaker: "Mira's agent", text: "Reward. The kiln is first." },
];

test("a yes whose quote was never said is dropped to not now", () => {
  const debrief: Debrief = {
    from: "mira",
    to: "jonah",
    decision: "yes",
    quote: "Let us fly to Lisbon tomorrow.",
    responsiveness: 2,
    specificPlan: true,
    snag: 0,
    necessityBroken: false,
    prior: 0.9,
    note: "I want the Sunday.",
  };
  const settled = settleDebrief(debrief, turns);
  assert.equal(settled.decision, "not-now");
  assert.equal(settled.quote, null);
  assert.equal(quoteIsIn("Is the path a reward, or how you come down?", turns), true);
});

function person(slug: string, name: string, line: string): Person {
  return {
    slug,
    name,
    monogram: slug.slice(0, 2).toUpperCase(),
    tint: "#e6d3c4",
    role: "Reader",
    city: "Here",
    line,
    lineSource: { platform: "LinkedIn", detail: "Headline" },
    necessity: {
      text: line,
      evidence: line,
      source: { platform: "LinkedIn", detail: "Headline" },
    },
    prompts: [
      { label: "A need", body: line, source: { platform: "LinkedIn", detail: "Headline" } },
      { label: "A Sunday", body: line, source: { platform: "Instagram", detail: "Bio" } },
      { label: "Into", body: line, source: { platform: "Instagram", detail: "Bio" } },
      { label: "How the agent dates", body: line, source: { platform: "LinkedIn", detail: "Headline" } },
    ],
  };
}

test("a short meeting ranks from the private notes", async () => {
  const replies = [
    ...Array.from({ length: 6 }, (_, index) => JSON.stringify({ text: `Turn ${index}. The kiln stays first.` })),
    JSON.stringify({
      decision: "yes",
      quote: "Turn 1. The kiln stays first.",
      responsiveness: 2,
      specificPlan: true,
      snag: 0,
      necessityBroken: false,
      note: "He asked about the kiln and kept it.",
    }),
    JSON.stringify({
      decision: "never",
      quote: null,
      responsiveness: 0,
      specificPlan: false,
      snag: 2,
      necessityBroken: true,
      note: "The day I will not bend was ignored.",
    }),
  ];
  let cursor = 0;
  const llm: Llm = {
    async complete() {
      const next = replies[cursor] ?? replies[replies.length - 1];
      cursor += 1;
      return next;
    },
  };
  const result = await runShortMeeting(person("mira", "Mira Sen", "I keep Sundays empty on purpose."), person("jonah", "Jonah Park", "I take the train home."), llm);
  const ranked = rankDebriefs([
    result.fromA,
    {
      ...result.fromA,
      to: "someone",
      decision: "not-now",
      quote: null,
      necessityBroken: false,
      prior: 0.99,
      note: "Paper match only.",
    },
  ]);
  assert.equal(result.fromA.decision, "yes");
  assert.equal(result.fromB.decision, "never");
  assert.equal(ranked[0].to, "jonah");
  assert.equal(result.meeting.turns.length, 6);
});
