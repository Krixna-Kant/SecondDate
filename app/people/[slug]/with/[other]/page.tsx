import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { Face, type BoardFace } from "@/components/DatesBoard";
import { debriefBetween, getPerson, meetingBetween } from "@/lib/catalog";
import { decisionLabel } from "@/lib/rank";import type { Person } from "@/lib/types";

export const dynamic = "force-dynamic";

const FIRST_DATE_TURNS = 6;

function plain(text: string): string {
  return text.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function face(person: Person): BoardFace {
  return { slug: person.slug, name: person.name, photo: person.photo, monogram: person.monogram, tint: person.tint };
}

export default async function DatePage({
  params,
}: {
  params: Promise<{ slug: string; other: string }>;
}) {
  const { slug, other } = await params;
  const viewer = getPerson(slug);
  const them = getPerson(other);
  const meeting = viewer && them ? meetingBetween(viewer.slug, them.slug) : undefined;
  if (!viewer || !them || !meeting) notFound();

  const me = face(viewer);
  const you = face(them);
  const first = (person: Person) => person.name.split(" ")[0];
  const notes = [
    { person: viewer, note: debriefBetween(viewer.slug, them.slug) },
    { person: them, note: debriefBetween(them.slug, viewer.slug) },
  ];

  return (
    <main className="date-view wrap">
      <BackButton fallback={`/people/${viewer.slug}/ranking`} />

      <article className="date-card-full">
        <header className="board-head">
          <div className="board-pair">
            <Face face={me} size="md" />
            <Face face={you} size="md" />
          </div>
          <div>
            <h3>{first(viewer)} × {first(them)}</h3>
            <p>{meeting.kind === "night" ? "Two dates" : "First date"} · {meeting.turns.length} messages</p>
          </div>
        </header>

        <div className="board-chat date-chat">
          {meeting.turns.map((turn, index) => {
            const mine = turn.speaker.startsWith(first(viewer));
            const who = mine ? me : you;
            const sameAsBefore = index > 0 && meeting.turns[index - 1].speaker === turn.speaker;
            return (
              <div key={index}>
                {index === FIRST_DATE_TURNS && meeting.kind === "night" && <p className="board-divider">Second date</p>}
                <div className={`board-msg ${mine ? "left" : "right"}`} style={{ animationDelay: `${Math.min(index, 10) * 60}ms` }}>
                  {!sameAsBefore ? <Face face={who} /> : <span className="board-face sm ghost" />}
                  <div>
                    {!sameAsBefore && <span className="board-who">{turn.speaker}</span>}
                    <p>{plain(turn.text)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="board-notes">
          {notes.map(({ person, note }) =>
            note ? (
              <div key={person.slug} className={`board-note ${note.decision}`}>
                <div className="board-note-top">
                  <Face face={face(person)} />
                  <strong>{first(person)}</strong>
                  <em>{decisionLabel(note.decision)}</em>
                </div>
                <p>{plain(note.note)}</p>
              </div>
            ) : null,
          )}
        </footer>
      </article>

      <p className="date-links">
        <Link className="text-link" href={`/people/${viewer.slug}/ranking`}>{first(viewer)}’s ranking</Link>
        <span className="faint"> · </span>
        <Link className="text-link" href={`/people/${them.slug}/with/${viewer.slug}`}>{first(them)}’s side</Link>
      </p>
    </main>
  );
}
