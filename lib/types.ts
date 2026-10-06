export type Decision = "yes" | "not-now" | "never";

export type Source = {
  platform: "LinkedIn" | "Instagram";
  detail: string;
};

export type Prompt = {
  label: string;
  body: string;
  source: Source;
};

export type Necessity = {
  text: string;
  evidence: string;
  source: Source;
};

export type Person = {
  slug: string;
  name: string;
  monogram: string;
  tint: string;
  role: string;
  city: string;
  line: string;
  lineSource: Source;
  necessity: Necessity;
  prompts: Prompt[];
  /** Lines from the two pages that the agent may speak from, in the person's own words. */
  world?: string[];
  links?: { linkedin: string; instagram: string };
  photo?: string;
};

/** A private note from one agent, about one other person. */
export type Debrief = {
  from: string;
  to: string;
  decision: Decision;
  /** Required when decision is yes. A line that was actually said. */
  quote: string | null;
  /** Follow-ups about the other person's actual life. 0, 1, or 2. */
  responsiveness: 0 | 1 | 2;
  /** The next plan uses this person's evidenced life. */
  specificPlan: boolean;
  /**
   * 0 stayed with a difference, or there wasn't one.
   * 1 smoothed it over.
   * 2 left it unanswered.
   */
  snag: 0 | 1 | 2;
  necessityBroken: boolean;
  /** Tie-break only. Higher is closer on paper. 0 to 1. */
  prior: number;
  /** What the agent tells its own person. */
  note: string;
};

export type Turn = {
  speaker: string;
  text: string;
};

export type Meeting = {
  a: string;
  b: string;
  kind: "night" | "short";
  venue: string;
  why: string;
  turns: Turn[];
};
