import type { Person } from "@/lib/types";

export function Portrait({ person, large = false }: { person: Person; large?: boolean }) {
  return (
    <div
      className={large ? "portrait lg" : "portrait sq"}
      style={{ background: person.tint }}
      aria-hidden
    >
      {person.photo ? <img src={person.photo} alt="" /> : <span>{person.monogram}</span>}
    </div>
  );
}
