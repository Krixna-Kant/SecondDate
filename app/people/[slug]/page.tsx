import Link from "next/link";
import { notFound } from "next/navigation";
import { Portrait } from "@/components/Portrait";
import { getPerson } from "@/lib/catalog";
export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { slug } = await params;
  const { notice } = await searchParams;
  const person = getPerson(slug);
  if (!person) notFound();
  const first = person.name.split(" ")[0];

  return (
    <main className="wrap profile">
      <div className="profile-sticky">
        <Portrait person={person} large />
      </div>
      <article>
        <p className="kicker">Profile · two sources</p>
        <h1>{person.name}</h1>
        <p className="role">
          {person.role} · {person.city}
        </p>
        {person.links && (
          <p className="source">
            <a href={person.links.linkedin}>LinkedIn</a>
            {" · "}
            <a href={person.links.instagram}>Instagram</a>
          </p>
        )}
        {notice && <p className="form-error">{notice}</p>}
        <p className="line">{person.line}</p>
        <p className="source">
          {person.lineSource.platform} · {person.lineSource.detail}
        </p>

        <div className="bend">
          <p className="kicker">Will not bend</p>
          <p className="line" style={{ fontSize: 26, marginTop: 8 }}>
            {person.necessity.text}
          </p>
          <p className="source">
            “{person.necessity.evidence}” · {person.necessity.source.platform} ·{" "}
            {person.necessity.source.detail}
          </p>
        </div>

        <div className="prompts">
          {person.prompts.map((prompt) => (
            <section key={prompt.label} className="prompt">
              <h2>{prompt.label}</h2>
              <p>{prompt.body}</p>
              <p className="source">
                {prompt.source.platform} · {prompt.source.detail}
              </p>
            </section>
          ))}
        </div>

        <div className="profile-foot">
          <Link className="text-link" href={`/people/${person.slug}/ranking`}>
            Who fits {first}
          </Link>
          <Link className="muted" href="/#people">
            Everyone
          </Link>
        </div>
      </article>
    </main>
  );
}
