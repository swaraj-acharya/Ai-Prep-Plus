"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-semibold">Something broke on this screen</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">Your progress is stored as events on this device and is safe. {error.digest ? `Reference: ${error.digest}` : ""}</p>
      <button onClick={reset} className="mt-5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink">
        Try again
      </button>
    </div>
  );
}
