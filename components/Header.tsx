import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="wordmark">
          Second
        </Link>
        <nav className="nav">
          <Link href="/#people">People</Link>
          <Link href="/#dates">Dates</Link>
          <Link href="/how">How it ranks</Link>
          <Link href="/add" className="nav-pill">Add someone</Link>
        </nav>
      </div>
    </header>
  );
}
