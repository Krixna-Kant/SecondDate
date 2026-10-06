"use client";

import { useEffect, useState } from "react";
import { addPerson } from "./actions";

const stages = [
  { after: 0, text: "Opening LinkedIn and Instagram" },
  { after: 20, text: "Reading both public pages" },
  { after: 60, text: "Checking it is the same person" },
  { after: 120, text: "Still reading. Big profiles take up to three minutes" },
];

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AddForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!pending) return;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  const stage = [...stages].reverse().find((item) => seconds >= item.after) ?? stages[0];

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const result = await addPerson(new FormData(event.currentTarget));
        if (result?.error) {
          setError(result.error);
          setPending(false);
        }
      }}
    >
      <label className="field">
        <span>LinkedIn</span>
        <input name="linkedin" required placeholder="https://www.linkedin.com/in/…" autoComplete="off" disabled={pending} />
      </label>
      <label className="field">
        <span>Instagram</span>
        <input name="instagram" required placeholder="https://www.instagram.com/…" autoComplete="off" disabled={pending} />
      </label>
      {error && <p className="form-error">{error}</p>}
      {pending ? (
        <div className="add-progress" role="status" aria-live="polite">
          <span className="add-dot" />
          <span>{stage.text}</span>
          <span className="add-clock">{clock(seconds)}</span>
          <div className="add-bar"><i style={{ width: `${Math.min(95, (seconds / 150) * 100)}%` }} /></div>
        </div>
      ) : (
        <button className="pill" type="submit">Read this person</button>
      )}
    </form>
  );
}
