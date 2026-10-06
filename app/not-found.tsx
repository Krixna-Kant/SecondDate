import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap how">
      <h1>That page isn’t here.</h1>
      <p>
        <Link className="text-link" href="/">
          Back to the six
        </Link>
      </p>
    </main>
  );
}
