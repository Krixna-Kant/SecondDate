import type { Debrief, Decision } from "./types";

const decisionOrder: Record<Decision, number> = {
  yes: 0,
  "not-now": 1,
  never: 2,
};

export function validateDebrief(debrief: Debrief): string | null {
  if (debrief.decision === "yes" && !debrief.quote?.trim()) {
    return "A yes needs a quoted line from the night.";
  }
  if (debrief.prior < 0 || debrief.prior > 1) {
    return "Prior must sit between 0 and 1.";
  }
  return null;
}

/**
 * Negative when `a` should rank above `b`.
 * Later rungs cannot rescue an earlier one.
 */
export function compareDebriefs(a: Debrief, b: Debrief): number {
  if (a.necessityBroken !== b.necessityBroken) {
    return a.necessityBroken ? 1 : -1;
  }
  if (a.decision !== b.decision) {
    return decisionOrder[a.decision] - decisionOrder[b.decision];
  }
  if (a.responsiveness !== b.responsiveness) {
    return b.responsiveness - a.responsiveness;
  }
  if (a.specificPlan !== b.specificPlan) {
    return a.specificPlan ? -1 : 1;
  }
  if (a.snag !== b.snag) {
    return a.snag - b.snag;
  }
  return b.prior - a.prior;
}

export function rankDebriefs(debriefs: Debrief[]): Debrief[] {
  for (const debrief of debriefs) {
    const error = validateDebrief(debrief);
    if (error) throw new Error(error);
  }
  return [...debriefs].sort(compareDebriefs);
}

export function decisionLabel(decision: Decision): string {
  if (decision === "yes") return "Second date";
  if (decision === "not-now") return "Not now";
  return "Never";
}
