import assert from "node:assert/strict";
import test from "node:test";
import { compareDebriefs, rankDebriefs, validateDebrief } from "./rank";
import type { Debrief } from "./types";

function note(partial: Partial<Debrief> & Pick<Debrief, "from" | "to">): Debrief {
  return {
    decision: "not-now",
    quote: null,
    responsiveness: 0,
    specificPlan: false,
    snag: 0,
    necessityBroken: false,
    prior: 0.5,
    note: "",
    ...partial,
  };
}

test("a broken necessity sinks a hobby match that said yes", () => {
  const held = note({
    from: "mira",
    to: "noor",
    decision: "not-now",
    prior: 0.2,
  });
  const broken = note({
    from: "mira",
    to: "adrian",
    decision: "yes",
    quote: "Give me one Sunday in the studio.",
    responsiveness: 2,
    specificPlan: true,
    prior: 0.95,
    necessityBroken: true,
  });
  assert.ok(compareDebriefs(held, broken) < 0);
});

test("a yes beats a high prior paired with a never", () => {
  const yes = note({
    from: "mira",
    to: "jonah",
    decision: "yes",
    quote: "Is the path a reward?",
    prior: 0.2,
  });
  const never = note({
    from: "mira",
    to: "samir",
    decision: "never",
    prior: 0.99,
  });
  assert.ok(compareDebriefs(yes, never) < 0);
});

test("two people can rank each other differently", () => {
  const miraOnNoor = note({
    from: "mira",
    to: "noor",
    decision: "not-now",
  });
  const noorOnMira = note({
    from: "noor",
    to: "mira",
    decision: "yes",
    quote: "Let me see the studio shelves.",
    responsiveness: 2,
    specificPlan: true,
  });
  const miraList = rankDebriefs([
    miraOnNoor,
    note({ from: "mira", to: "jonah", decision: "yes", quote: "Sunday, the kiln." }),
  ]);
  const noorList = rankDebriefs([noorOnMira]);
  assert.equal(miraList[0].to, "jonah");
  assert.equal(miraList[1].decision, "not-now");
  assert.equal(noorList[0].decision, "yes");
});

test("a yes with no quote is rejected", () => {
  const debrief = note({ from: "mira", to: "jonah", decision: "yes", quote: "  " });
  assert.match(validateDebrief(debrief) ?? "", /quoted line/);
  assert.throws(() => rankDebriefs([debrief]));
});

test("the prior does not cross a decision boundary", () => {
  const lowPriorYes = note({
    from: "mira",
    to: "leila",
    decision: "yes",
    quote: "Come at nine.",
    prior: 0.1,
  });
  const highPriorNotNow = note({
    from: "mira",
    to: "noor",
    decision: "not-now",
    prior: 0.99,
    responsiveness: 2,
    specificPlan: true,
  });
  const ranked = rankDebriefs([highPriorNotNow, lowPriorYes]);
  assert.deepEqual(
    ranked.map((row) => row.to),
    ["leila", "noor"],
  );
});

test("among the same yes, a follow-up and a cleaner snag rank higher", () => {
  const specific = note({
    from: "mira",
    to: "jonah",
    decision: "yes",
    quote: "Is the path a reward?",
    responsiveness: 2,
    specificPlan: true,
    snag: 0,
    prior: 0.1,
  });
  const smoothed = note({
    from: "mira",
    to: "leila",
    decision: "yes",
    quote: "Then nine.",
    responsiveness: 2,
    specificPlan: true,
    snag: 1,
    prior: 0.9,
  });
  assert.equal(rankDebriefs([smoothed, specific])[0].to, "jonah");
});
