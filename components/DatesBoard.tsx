"use client";

import { useEffect, useRef, useState } from "react";
import type { Decision } from "@/lib/types";

export type BoardFace = { slug: string; name: string; photo?: string; monogram: string; tint: string };

export type BoardDate = {
  a: BoardFace;
  b: BoardFace;
  kind: "night" | "short";
  turns: { speaker: string; text: string }[];
  fromA: { decision: Decision; note: string } | null;
  fromB: { decision: Decision; note: string } | null;
};

const FIRST_DATE_TURNS = 6;

function first(face: BoardFace): string {
  return face.name.split(" ")[0];
}

function label(decision: Decision): string {
  if (decision === "yes") return "Second date";
  if (decision === "never") return "Never";
  return "Not now";
}

export function Face({ face, size = "sm" }: { face: BoardFace; size?: "sm" | "md" }) {
  return (
    <span className={`board-face ${size}`} style={{ background: face.tint }} aria-hidden>
      {face.photo ? <img src={face.photo} alt="" /> : face.monogram}
    </span>
  );
}

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

export function DatesBoard({ dates }: { dates: BoardDate[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const date = open === null ? null : dates[open];

  useEffect(() => {
    if (open === null) return;
    panelRef.current?.querySelector(".board-chat")?.scrollTo({ top: 0 });
    if (window.matchMedia("(max-width: 800px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [open]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={date ? "board open" : "board"}>
      <div className="date-grid">
        {dates.map((item, index) => {
          const yes = item.fromA?.decision === "yes" || item.fromB?.decision === "yes";
          return (
            <button
              key={`${item.a.slug}-${item.b.slug}`}
              type="button"
              className={open === index ? "date-card on" : "date-card"}
              aria-pressed={open === index}
              onClick={() => setOpen(open === index ? null : index)}
            >
              <div className="date-faces">
                <Face face={item.a} size="md" />
                <span className="date-heart"><Heart /></span>
                <Face face={item.b} size="md" />
              </div>
              <h3>{first(item.a)} × {first(item.b)}</h3>
              <span className={yes ? "date-pill yes" : "date-pill"}>{yes ? "Second date" : "Not this time"}</span>
            </button>
          );
        })}
      </div>

      {date && (
        <aside ref={panelRef} className="board-panel" aria-label={`${first(date.a)} and ${first(date.b)}`}>
          <header className="board-head">
            <div className="board-pair">
              <Face face={date.a} size="md" />
              <Face face={date.b} size="md" />
            </div>
            <div>
              <h3>{first(date.a)} × {first(date.b)}</h3>
              <p>{date.kind === "night" ? "Two dates" : "First date"} · {date.turns.length} messages</p>
            </div>
            <button type="button" className="board-close" onClick={() => setOpen(null)} aria-label="Close chat">
              ×
            </button>
          </header>

          <div className="board-chat" key={open}>
            {date.turns.map((turn, index) => {
              const mine = turn.speaker.startsWith(first(date.a));
              const face = mine ? date.a : date.b;
              const sameAsBefore = index > 0 && date.turns[index - 1].speaker === turn.speaker;
              return (
                <div key={index}>
                  {index === FIRST_DATE_TURNS && date.kind === "night" && <p className="board-divider">Second date</p>}
                  <div
                    className={`board-msg ${mine ? "left" : "right"}`}
                    style={{ animationDelay: `${Math.min(index, 10) * 70}ms` }}
                  >
                    {!sameAsBefore ? <Face face={face} /> : <span className="board-face sm ghost" />}
                    <div>
                      {!sameAsBefore && <span className="board-who">{turn.speaker}</span>}
                      <p>{turn.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="board-notes">
            {[
              { face: date.a, note: date.fromA },
              { face: date.b, note: date.fromB },
            ].map(({ face, note }) =>
              note ? (
                <div key={face.slug} className={`board-note ${note.decision}`}>
                  <div className="board-note-top">
                    <Face face={face} />
                    <strong>{first(face)}</strong>
                    <em>{label(note.decision)}</em>
                  </div>
                  <p>{note.note}</p>
                </div>
              ) : null,
            )}
          </footer>
        </aside>
      )}
    </div>
  );
}
