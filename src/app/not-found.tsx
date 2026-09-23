import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <div className="font-mono text-sm text-muted">404</div>
      <h1 className="mt-2 text-xl font-semibold">That page isn't on the roadmap</h1>
      <p className="mt-2 text-sm text-muted">Try the command palette (⌘K) to search weeks, tasks, projects and problems.</p>
      <Link href="/today" className="mt-5 inline-block rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink">
        Go to today
      </Link>
    </div>
  );
}
