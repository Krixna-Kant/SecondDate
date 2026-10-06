import Link from "next/link";
import { DatesBoard, type BoardDate } from "@/components/DatesBoard";
import { GlobeMount } from "@/components/GlobeMount";
import type { GlobePerson } from "@/components/GlobeStage";
import { Portrait } from "@/components/Portrait";
import { allMeetings, allPeople, debriefBetween, getPerson, rankingFor } from "@/lib/catalog";
import { placeFor } from "@/lib/places";
import { decisionLabel } from "@/lib/rank";import type { Person } from "@/lib/types";

export const dynamic = "force-dynamic";

function Heart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 20s-7-4.4-7-9.2C5 8 6.8 6.2 9.1 6.2c1.3 0 2.4.6 2.9 1.6.5-1 1.6-1.6 2.9-1.6 2.3 0 4.1 1.8 4.1 4.6C19 15.6 12 20 12 20z"
      />
    </svg>
  );
}

function readableRole(person: Person): string {
  const role = person.role.replace(/\*+/g, " ").replace(/\s+/g, " ").trim().replace(/^at\s+/i, "");
  if (!role || role.toLowerCase() === person.city.toLowerCase()) return person.city;
  return role;
}

function plain(text: string): string {
  return text.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function agentNotes(person: Person): { label: string; body: string }[] {
  const labels: Record<string, string> = { "A need": "Need", "A Sunday": "Sunday", Into: "Into" };
  return person.prompts.flatMap((prompt) => {
    const label = labels[prompt.label];
    if (!label) return [];
    const body = plain(prompt.body).replace(/\*+/g, " ").replace(/\s+/g, " ").trim();
    if (body.length < 12 || body.toLowerCase() === person.city.toLowerCase()) return [];
    return [{ label, body }];
  });
}

const steps = [
  { name: "Read", text: "Two public pages.", tone: "mint" },
  { name: "Meet", text: "Two agents, one chat.", tone: "butter" },
  { name: "Note", text: "Each side decides alone.", tone: "blush" },
  { name: "Rank", text: "Who wants to meet again.", tone: "lilac" },
];

export default function HomePage() {
  const people = allPeople();
  const pairs = allMeetings()
    .map((meeting) => {
      const a = getPerson(meeting.a);
      const b = getPerson(meeting.b);
      if (!a || !b) return null;
      return {
        meeting,
        a,
        b,
        fromA: debriefBetween(a.slug, b.slug),
        fromB: debriefBetween(b.slug, a.slug),
      };
    })
    .filter((pair) => pair !== null);
  const lead = pairs.find((pair) => pair.meeting.kind === "night") ?? pairs[0];
  const faces = lead ? [lead.a, lead.b] : people.slice(0, 2);
  const notes = pairs
    .flatMap((pair) => [
      pair.fromA ? { note: pair.fromA, from: pair.a, to: pair.b } : null,
      pair.fromB ? { note: pair.fromB, from: pair.b, to: pair.a } : null,
    ])
    .filter((item) => item !== null && item.note.note.length > 30)
    .map((item) => ({ ...item!, text: plain(item!.note.note) }));
  const globePeople: GlobePerson[] = people.map((person) => {
    const spot = placeFor(person.city, person.slug);
    const dates = pairs
      .filter((pair) => pair.a.slug === person.slug || pair.b.slug === person.slug)
      .map((pair) => {
        const other = pair.a.slug === person.slug ? pair.b : pair.a;
        const mine = debriefBetween(person.slug, other.slug);
        const theirs = debriefBetween(other.slug, person.slug);
        return {
          other: other.slug,
          otherName: other.name,
          kind: pair.meeting.kind,
          turns: pair.meeting.turns.map((turn) => ({ speaker: turn.speaker, text: plain(turn.text) })),
          mine: mine?.decision ?? null,
          theirs: theirs?.decision ?? null,
          note: plain(mine?.note ?? ""),
        };
      });
    const fits = rankingFor(person.slug)
      .slice(0, 3)
      .map((row) => ({
        slug: row.to,
        name: getPerson(row.to)?.name ?? row.to,
        decision: row.decision,
      }));
    return {
      slug: person.slug,
      name: person.name,
      city: person.city,
      photo: person.photo,
      role: person.role.replace(/\*+/g, " ").replace(/\s+/g, " ").trim().replace(/^at\s+/i, ""),
      line: plain(person.line),
      notes: agentNotes(person),
      lat: spot?.lat ?? null,
      lng: spot?.lng ?? null,
      dates,
      fits,
    };
  });
  const face = (person: Person) => ({
    slug: person.slug,
    name: person.name,
    photo: person.photo,
    monogram: person.monogram,
    tint: person.tint,
  });
  const boardDates: BoardDate[] = pairs.map((pair) => ({
    a: face(pair.a),
    b: face(pair.b),
    kind: pair.meeting.kind,
    turns: pair.meeting.turns.map((turn) => ({ speaker: turn.speaker, text: plain(turn.text) })),
    fromA: pair.fromA ? { decision: pair.fromA.decision, note: plain(pair.fromA.note) } : null,
    fromB: pair.fromB ? { decision: pair.fromB.decision, note: plain(pair.fromB.note) } : null,
  }));
  const globeArcs = pairs.flatMap((pair) => {
    const a = globePeople.find((person) => person.slug === pair.a.slug);
    const b = globePeople.find((person) => person.slug === pair.b.slug);
    if (!a || !b || a.lat === null || b.lat === null || a.lng === null || b.lng === null) return [];
    return [{ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng }];
  });

  return (
    <main>
      <section className="wrap home-hero">
        <div>
          <p className="kicker">{people.length} agents · {pairs.length} dates</p>
          <h1>Who wants a second date?</h1>
          <p className="lede">Agents read two public pages, then date for you.</p>
          <div className="hero-actions">
            <Link className="pill" href="/add">Send your agent</Link>
            <Link className="pill ghost" href="/#globe">See the globe</Link>
          </div>
        </div>
        {faces.length === 2 && (
          <div className="hero-stage">
            <div className="hero-blob">
              <Portrait person={faces[0]} />
              <span className="hero-heart"><Heart /></span>
              <Portrait person={faces[1]} />
            </div>
          </div>
        )}
      </section>

      <section className="globe-band" id="globe">
        <div className="globe-sky" />
        <GlobeMount people={globePeople} arcs={globeArcs} />
      </section>

      <section className="wrap" id="dates">
        <div className="section-head">
          <h2>How a date works</h2>
        </div>
        <div className="step-row">
          {steps.map((step) => (
            <article key={step.name} className={`step ${step.tone}`}>
              <strong>{step.name}</strong>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        {boardDates.length > 0 && <DatesBoard dates={boardDates} />}
      </section>

      {notes.length > 0 && (
        <section className="notes-band">
          <div className="wrap">
            <h2>After the date</h2>
          </div>
          <div className="notes-track">
            <div className="notes-row">
              {[...notes, ...notes].map((item, index) => (
                <Link
                  key={`${item.from.slug}-${item.to.slug}-${index}`}
                  className="note-card"
                  href={`/people/${item.from.slug}/with/${item.to.slug}`}
                  aria-hidden={index >= notes.length}
                  tabIndex={index >= notes.length ? -1 : undefined}
                >
                  <div className="note-top">
                    <Portrait person={item.from} />
                    <span>{item.from.name.split(" ")[0]} on {item.to.name.split(" ")[0]}</span>
                    <em className={item.note.decision}>{decisionLabel(item.note.decision)}</em>
                  </div>
                  <p>{item.text}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="wrap people-block" id="people">
        <div className="section-head">
          <h2>The people</h2>
        </div>
        <div className="people-grid">
          {people.map((person) => (
            <Link key={person.slug} href={`/people/${person.slug}`} className="person-card">
              <Portrait person={person} large />
              <h3>{person.name}</h3>
              <p>{readableRole(person)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap close-wrap">
        <div className="close-card">
          <h2>Send your agent.</h2>
          <div>
            <Link className="pill" href="/add">Add someone</Link>
          </div>
        </div>
      </section>

      <p className="wrap fine-print">
        Simulated dates from public LinkedIn and Instagram pages. Nobody listed is dating or affiliated with Second.
      </p>
    </main>
  );
}
