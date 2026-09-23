"use client";
import { Menu, MoreHorizontal, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx, Kbd } from "@/components/ui";
import { CommandPalette } from "./command-palette";
import { MOBILE_TABS, NAV, SETTINGS_ITEM } from "./nav";
import { StreakChip, ThemeToggle, TimerChip } from "./status";
import { WelcomeBack } from "./welcome";
import { PushBadge } from "@/components/push";

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/projects") return path === "/projects" || (/^\/projects\/[^/]+$/.test(path) && !["/projects/pick", "/projects/portfolio"].includes(path));
  return path === href || path.startsWith(href + "/");
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex h-13 items-center gap-2 border-b border-line px-4 font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={24} height={24} className="size-6" />
        AI PrepBoard
      </Link>
      <div className="flex-1 overflow-y-auto px-2 py-3 scroll-thin">
        {NAV.map((g) => (
          <div key={g.group} className="mb-3">
            <div className="px-2 pb-1 text-[11px] font-medium text-faint">{g.group}</div>
            {g.items.map((i) => {
              const active = isActive(path, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors", active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink")}
                >
                  <i.icon className={cx("size-4 shrink-0", active && "text-accent")} />
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-line p-2">
        <Link href={SETTINGS_ITEM.href} onClick={onNavigate} className={cx("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px]", isActive(path, "/settings") ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}>
          <SETTINGS_ITEM.icon className="size-4" /> Settings
        </Link>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const path = usePathname();
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (path === "/login") return <main>{children}</main>;
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface lg:block">
        <Sidebar />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/55" aria-label="Close navigation" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-surface">
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-13 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur md:px-5">
          <button className="rounded p-1.5 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <button
            onClick={() => setPalette(true)}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-sm text-faint hover:border-line-strong md:max-w-md"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search tasks, weeks, projects, DSA…</span>
            <span className="ml-auto hidden gap-0.5 sm:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <TimerChip />
            <PushBadge />
            <StreakChip />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 md:px-6 lg:pb-12">{children}</main>
      </div>
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE_TABS.map((t) => (
          <Link key={t.href} href={t.href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px]", isActive(path, t.href) ? "text-accent" : "text-muted")}>
            <t.icon className="size-5" />
            {t.label}
          </Link>
        ))}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted">
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
      <CommandPalette open={palette} onOpenChange={setPalette} />
      <WelcomeBack />
    </div>
  );
}
