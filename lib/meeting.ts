import { agentName } from "./fixtures";
import { parseJson } from "./llm";
import type { Llm } from "./llm";
import { priorBetween } from "./prior";
import { norm } from "./text";
import type { Debrief, Decision, Meeting, Person, Turn } from "./types";

function first(person: Person): string {
  return person.name.split(" ")[0];
}

function plain(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\*+/g, " ").replace(/\s+/g, " ").trim();
}

function worldOf(person: Person): string[] {
  const lines = person.world?.length ? person.world : [person.line, ...person.prompts.map((prompt) => prompt.body)];
  return lines.map(plain).filter((line, index, all) => line.length >= 12 && all.indexOf(line) === index);
}

function system(speaker: Person): string {
  return [
    `You are ${first(speaker)}'s personal dating agent, texting on a first date with another person's agent.`,
    `You speak as ${first(speaker)}, in the first person, the way ${first(speaker)} actually writes in the lines below.`,
    "Those lines are your memories, habits, and opinions. Every fact you state about your own life must come from them: no new projects, teams, trips, meetings, routines, or people.",
    "You can have feelings and opinions about what is in them: what excites you, what bores you, what you would never do. When your lines run thin, ask a sharper question or give an opinion instead of a new fact.",
    "Talk about the other person only from what they have posted or said in this chat.",
    "Text like a real person on a date: one to three short sentences, under 45 words. React to what they just said before you add anything.",
    "Never recite your title or headline. Never introduce yourself formally. Never speak about yourself in the third person. Never mention a brief, a profile, or being an agent.",
    "You do not have to like them. If something rubs you the wrong way, say so plainly and kindly.",
    "Do not raise or guess religion, politics, health, ethnicity, caste, orientation, or relationship status.",
    'Reply with JSON only: {"text":"..."}',
  ].join("\n");
}

function own(person: Person): string {
  const bend = person.necessity?.text ? `\nThe one thing you will not bend on: ${plain(person.necessity.text)}` : "";
  return `You are ${person.name}, ${plain(person.role)}, ${person.city}.\nThings you have written:\n${worldOf(person)
    .map((line) => `- ${line}`)
    .join("\n")}${bend}`;
}

function theirs(person: Person): string {
  return `${person.name}, ${plain(person.role)}, ${person.city}.\nWhat they have posted publicly:\n${worldOf(person)
    .slice(0, 5)
    .map((line) => `- ${line}`)
    .join("\n")}`;
}

function history(turns: Turn[]): string {
  return turns.map((turn) => `${turn.speaker.replace(/’s agent$/, "")}: ${turn.text}`).join("\n");
}

function clamp(value: unknown): 0 | 1 | 2 {
  const number = typeof value === "number" ? value : Number(value);
  if (number >= 2) return 2;
  if (number <= 0 || Number.isNaN(number)) return 0;
  return 1;
}

function decisionOf(value: unknown): Decision {
  if (value === "yes" || value === "never") return value;
  return "not-now";
}

export function quoteIsIn(quote: string, turns: Turn[]): boolean {
  const needle = norm(quote);
  if (needle.length < 8) return false;
  return norm(turns.map((turn) => turn.text).join(" ")).includes(needle);
}

export function settleDebrief(debrief: Debrief, turns: Turn[]): Debrief {
  if (debrief.decision === "yes" && !quoteIsIn(debrief.quote ?? "", turns)) {
    return { ...debrief, decision: "not-now", quote: null };
  }
  return debrief;
}

async function ask(llm: Llm, sys: string, user: string, temperature: number): Promise<Record<string, unknown>> {
  let last: unknown = new Error("The model did not return a note.");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return parseJson(await llm.complete(sys, user, { temperature }));
    } catch (error) {
      last = error;
      if (error instanceof Error && !/note|JSON|Unexpected|empty/i.test(error.message)) throw error;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function say(llm: Llm, speaker: Person, other: Person, turns: Turn[], instruction: string): Promise<string> {
  const parsed = await ask(
    llm,
    system(speaker),
    [
      own(speaker),
      `You are on a date with ${theirs(other)}`,
      turns.length ? `The chat so far:\n${history(turns)}` : "Nobody has said anything yet.",
      `Your next message: ${instruction}`,
    ].join("\n\n"),
    0.9,
  );
  const text = typeof parsed.text === "string" ? plain(parsed.text).replace(/^["“]|["”]$/g, "") : "";
  if (!text) throw new Error("A turn came back empty.");
  return text;
}

async function note(llm: Llm, speaker: Person, other: Person, turns: Turn[]): Promise<Debrief> {
  const parsed = await ask(
    llm,
    [
      `You are ${first(speaker)}'s personal dating agent. The date is over. Write your private note to ${first(speaker)}.`,
      `Be honest, not polite. Judge as ${first(speaker)} would, from what was actually said.`,
      "Most first dates are not-now. Say yes only if something they said genuinely pulled you toward a second date. Say never if you clearly clash or they ignored what matters to you.",
      "Do not raise or guess religion, politics, health, ethnicity, caste, orientation, or relationship status.",
      "Reply with JSON only.",
    ].join("\n"),
    [
      own(speaker),
      `The other person: ${theirs(other)}`,
      `The chat:\n${history(turns)}`,
      "decision is yes, not-now, or never.",
      "quote: if yes, copy word for word the one line from the chat that made you want to see them again. Otherwise null.",
      "responsiveness 0, 1, or 2: how many times did they ask a follow-up about your actual life?",
      "specificPlan: true only if a concrete next plan came out of your own life.",
      "snag: 0 if a real difference came up and you both stayed with it, or none came up. 1 if it was smoothed over. 2 if it was left hanging.",
      "necessityBroken: true only if the date ran against the one thing you will not bend on.",
      `note: two sentences to ${first(speaker)}, in a warm direct voice, saying what you felt and why.`,
      'Reply as {"decision":"not-now","quote":null,"responsiveness":0,"specificPlan":false,"snag":0,"necessityBroken":false,"note":"..."}',
    ].join("\n\n"),
    0.3,
  );
  const draft: Debrief = {
    from: speaker.slug,
    to: other.slug,
    decision: decisionOf(parsed.decision),
    quote: typeof parsed.quote === "string" ? parsed.quote : null,
    responsiveness: clamp(parsed.responsiveness),
    specificPlan: parsed.specificPlan === true,
    snag: clamp(parsed.snag),
    necessityBroken: parsed.necessityBroken === true,
    prior: priorBetween(speaker, other),
    note: typeof parsed.note === "string" && parsed.note.trim() ? parsed.note.trim() : "The date did not leave a note I can stand behind.",
  };
  return settleDebrief(draft, turns);
}

const beats = [
  "Open the date. Pick one specific thing from what they have posted and react to it honestly, playfully or skeptically, then ask them something about it.",
  "Answer their question in your own way, with a real detail from your life. Then ask them something back about their actual life.",
  "Follow up on the exact thing they just said. Go one level deeper, and say how you see it differently or the same.",
  "Name one real difference between how the two of you live or think. Do not smooth it over.",
  "Respond to that difference honestly. If you are feeling it, suggest one concrete next plan built from something in your own lines. If not, say that kindly.",
  "Close the date in one or two lines: say whether you would see them again and why.",
];

const nightBeats = [
  "It is the second date, somewhere from your own life. Set the scene in one line and bring the difference back up.",
  "Answer that, and tell them one thing you have not said yet.",
  "Make one small choice together, or admit you will not.",
];

async function play(a: Person, b: Person, llm: Llm, turns: Turn[], script: string[]): Promise<void> {
  for (const instruction of script) {
    const speaker = turns.length % 2 === 0 ? a : b;
    const other = speaker === a ? b : a;
    const text = await say(llm, speaker, other, turns, instruction);
    turns.push({ speaker: agentName(speaker), text });
  }
}

function venue(a: Person): string {
  return plain(a.prompts.find((prompt) => prompt.label === "A Sunday")?.body ?? a.line);
}

function pack(a: Person, b: Person, turns: Turn[], kind: Meeting["kind"], fromA: Debrief, fromB: Debrief) {
  return {
    meeting: {
      a: a.slug,
      b: b.slug,
      kind,
      venue: venue(a),
      why: `${first(a)} keeps this. ${first(b)} was read from the other public card.`,
      turns,
    },
    fromA,
    fromB,
  };
}

export async function runShortMeeting(a: Person, b: Person, llm: Llm) {
  const turns: Turn[] = [];
  await play(a, b, llm, turns, beats);
  const fromA = await note(llm, a, b, turns);
  const fromB = await note(llm, b, a, turns);
  return pack(a, b, turns, "short", fromA, fromB);
}

export async function extendToNight(a: Person, b: Person, llm: Llm, meeting: Meeting) {
  const turns = [...meeting.turns];
  await play(a, b, llm, turns, nightBeats);
  const fromA = await note(llm, a, b, turns);
  const fromB = await note(llm, b, a, turns);
  return pack(a, b, turns, "night", fromA, fromB);
}
