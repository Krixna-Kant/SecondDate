const rungs = [
  {
    title: "Necessity",
    body: "A broken necessity stays below everyone whose necessity held. Shared hobbies do not average it back up.",
  },
  {
    title: "Second plan",
    body: "Yes, then not now, then never. The word comes from the agent’s private note after the meeting.",
  },
  {
    title: "Responsiveness",
    body: "Among the same decision, the agent who asked about the other person’s actual life ranks higher.",
  },
  {
    title: "A specific plan",
    body: "A next plan that uses this person’s evidenced life ranks above a vague yes.",
  },
  {
    title: "The snag",
    body: "If the date hit a real difference, staying with it ranks above smoothing it over.",
  },
  {
    title: "The paper match",
    body: "Values, pace, curiosity, then hobbies. This only breaks a tie once the five notes above are equal.",
  },
];

export default function HowPage() {
  return (
    <main className="wrap-narrow how">
      <p className="kicker">The ladder</p>
      <h1>The date decides. The profile breaks a tie.</h1>
      <p className="muted" style={{ maxWidth: "52ch" }}>
        Sort top to bottom. A later rung never rescues an earlier one.
      </p>
      <div className="rungs">
        {rungs.map((rung, index) => (
          <section key={rung.title} className="rung">
            <span className="faint">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{rung.title}</strong>
              <p>{rung.body}</p>
            </div>
          </section>
        ))}
      </div>
      <p className="cite">
        Aligned with Li, Bailey, Kenrick, and Linsenmeier 2002; Eastwick and
        Finkel 2008; Joel, Eastwick, and Finkel 2017; Huang, Yeomans, Brooks,
        Minson, and Gino 2017; Montoya, Horton, and Kirchner 2008. A yes with no
        quoted line is rejected. Each side of the date is a separate note, so
        the ranking can be one-sided.
      </p>
    </main>
  );
}
