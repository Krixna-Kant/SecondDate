import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { DecisionWord } from "@/components/DecisionWord";
import { Portrait } from "@/components/Portrait";
import { allPeople, getPerson, meetingBetween, rankingFor } from "@/lib/catalog";
import { priorBetween, sharedWords } from "@/lib/prior";
export const dynamic = "force-dynamic";

export default async function RankingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const person = getPerson(slug);
  if (!person) notFound();
  const first = person.name.split(" ")[0];
  const ranked = rankingFor(slug);
  const dated = new Set(ranked.map((row) => row.to));

  const next = allPeople()
    .filter((other) => other.slug !== slug && !dated.has(other.slug))
    .map((other) => ({ other, prior: priorBetween(person, other), words: sharedWords(person, other) }))
    .sort((a, b) => b.prior - a.prior);
  const best = Math.max(0.001, ...next.map((row) => row.prior));

  return (
    <main className="wrap rank-page">
      <BackButton fallback={`/people/${slug}`} />
      <div className="rank-intro">
        <div>
          <p className="kicker">{first}’s agent</p>
          <h1>Who fits {first}</h1>
        </div>
        <p className="muted">Dated first, by the note. Then who it would date next.</p>
      </div>

      <h2 className="rank-head">After a date <span className="faint">{ranked.length}</span></h2>
      {ranked.length === 0 && <p className="muted">No dates yet.</p>}
      <div className="rank-list">
        {ranked.map((row, index) => {
          const other = getPerson(row.to);
          if (!other) return null;
          const meeting = meetingBetween(person.slug, other.slug);
          const inner = (
            <>
              <span className="idx">{String(index + 1).padStart(2, "0")}</span>
              <Portrait person={other} />
              <div className="rank-copy">
                <h3>{other.name}</h3>
                <p className="note">{row.note}</p>
                {row.necessityBroken && <p className="flag">Necessity broken</p>}
              </div>
              <DecisionWord decision={row.decision} />
            </>
          );
          return meeting ? (
            <Link key={row.to} href={`/people/${person.slug}/with/${other.slug}`} className="rank-row">
              {inner}
            </Link>
          ) : (
            <div key={row.to} className="rank-row">{inner}</div>
          );
        })}
      </div>

      <h2 className="rank-head">Next in line <span className="faint">{next.length}</span></h2>
      <p className="muted rank-sub">Not dated yet. Ordered by shared public words, a guess until they meet.</p>
      <div className="rank-list">
        {next.map(({ other, prior, words }, index) => (
          <Link key={other.slug} href={`/people/${other.slug}`} className="rank-row next">
            <span className="idx">{String(ranked.length + index + 1).padStart(2, "0")}</span>
            <Portrait person={other} />
            <div className="rank-copy">
              <h3>{other.name}</h3>
              <p className="note">{other.role.replace(/^\*+\s*at\s+/, "")}</p>
              {words.length > 0 && <p className="shared">Both mention {words.join(", ")}</p>}
            </div>
            <span className="fit" title={`Paper match ${prior}`}>
              <i style={{ width: `${Math.round((prior / best) * 100)}%` }} />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
