"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { ArrowRight, Moon, Play, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLearning } from "@/lib/client/store";
import { currentTask } from "@/lib/state/selectors";
import { ALL_NAV } from "./nav";

interface Result { kind: string; title: string; context: string; href: string }

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: Result[] }) => setResults(d.results))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 150);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const act = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const item = "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-surface-2";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55" />
        <Dialog.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-2xl">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search the roadmap and run actions</Dialog.Description>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-faint" />
              <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Search or jump to…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1.5 scroll-thin">
              {q.trim().length < 2 && (
                <>
                  <Command.Group heading="Actions" className="px-1 pb-1 text-[11px] text-faint">
                    <Command.Item className={item} onSelect={() => act(() => { const s = useLearning.getState(); const t = currentTask(s.state); if (t) s.dispatch("TASK_COMPLETED", { taskId: t.id }); })}>
                      <ArrowRight className="size-4 text-good" /> Complete current task
                    </Command.Item>
                    <Command.Item className={item} onSelect={() => act(() => { const s = useLearning.getState(); if (!s.timer) s.startTimer(currentTask(s.state)?.id); })}>
                      <Play className="size-4 text-accent" /> Start study timer
                    </Command.Item>
                    <Command.Item className={item} onSelect={() => go("/dsa?log=1")}>
                      <ArrowRight className="size-4" /> Log a DSA attempt
                    </Command.Item>
                    <Command.Item className={item} onSelect={() => act(() => { const cur = document.documentElement.dataset.theme; const next = cur === "light" ? "dark" : "light"; document.documentElement.dataset.theme = next; localStorage.setItem("pb_theme", JSON.stringify(next)); })}>
                      <Moon className="size-4" /> Toggle theme
                    </Command.Item>
                  </Command.Group>
                  <Command.Group heading="Go to" className="px-1 pb-1 text-[11px] text-faint">
                    {ALL_NAV.map((n) => (
                      <Command.Item key={n.href} className={item} onSelect={() => go(n.href)}>
                        <n.icon className="size-4 text-muted" /> {n.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                </>
              )}
              {q.trim().length >= 2 && (
                <>
                  {ALL_NAV.filter((n) => `${n.label} ${n.keywords ?? ""}`.toLowerCase().includes(q.toLowerCase())).map((n) => (
                    <Command.Item key={n.href} className={item} onSelect={() => go(n.href)}>
                      <n.icon className="size-4 text-muted" /> {n.label}
                    </Command.Item>
                  ))}
                  {results.map((r) => (
                    <Command.Item key={r.href + r.title} value={r.href + r.title} className={item} onSelect={() => go(r.href)}>
                      <span className="w-24 shrink-0 text-[11px] text-faint">{r.kind}</span>
                      <span className="min-w-0">
                        <span className="block truncate">{r.title}</span>
                        <span className="block truncate text-xs text-muted">{r.context}</span>
                      </span>
                    </Command.Item>
                  ))}
                  {!loading && !results.length && <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches.</Command.Empty>}
                </>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
