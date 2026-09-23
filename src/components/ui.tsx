"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type BtnVariant = "primary" | "default" | "ghost" | "danger" | "good";
const btn: Record<BtnVariant, string> = {
  primary: "bg-accent text-accent-ink border-accent hover:brightness-110",
  default: "bg-surface-2 text-ink border-line hover:border-line-strong",
  ghost: "bg-transparent text-muted border-transparent hover:text-ink hover:bg-surface-2",
  danger: "bg-bad-soft text-bad border-transparent hover:border-bad",
  good: "bg-good-soft text-good border-transparent hover:border-good",
};
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }>(function Button(
  { variant = "default", size = "md", className, ...p },
  ref,
) {
  return (
    <button
      ref={ref}
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        btn[variant],
        className,
      )}
    />
  );
});

export function LinkButton({ href, children, variant = "default", className, external }: { href: string; children: ReactNode; variant?: BtnVariant; className?: string; external?: boolean }) {
  const cls = cx("inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3.5 text-sm font-medium transition-colors", btn[variant], className);
  return external ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function Card({ children, className, title, action, id }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <section id={id} className={cx("min-w-0 rounded-lg border border-line bg-surface shadow-[var(--shadow)]", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, lead, children, eyebrow }: { title: ReactNode; lead?: ReactNode; children?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs text-muted">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {lead && <p className="mt-1.5 max-w-3xl text-muted">{lead}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "good" | "bad" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent-soft text-accent border-transparent",
  good: "bg-good-soft text-good border-transparent",
  bad: "bg-bad-soft text-bad border-transparent",
  info: "bg-info-soft text-info border-transparent",
};
export function Badge({ children, tone = "neutral", className, title }: { children: ReactNode; tone?: Tone; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-px text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Progress({ value, className, tone = "accent", label }: { value: number; className?: string; tone?: "accent" | "good" | "bad"; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx("h-full rounded-full", tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : "bg-accent")} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0 rounded-lg border border-line bg-surface px-4 py-3 shadow-[var(--shadow)]", className)}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-mono text-xl font-medium tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <div className="font-medium">{title}</div>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Check_({ checked, onChange, label, sub, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("group flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 hover:bg-surface-2", disabled && "cursor-not-allowed opacity-60")}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cx(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent",
          checked ? "border-good bg-good text-bg" : "border-line-strong",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={cx("block", checked && "text-muted")}>{label}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
    </label>
  );
}
export { Check_ as Checkbox };

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-md border border-line bg-surface p-0.5", className)}>
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cx("rounded px-2.5 py-1 text-xs font-medium transition-colors", value === i.value ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export const inputCls = "h-9 w-full rounded-md border border-line bg-bg px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none";
export const selectCls = "h-9 rounded-md border border-line bg-bg px-2.5 text-sm text-ink focus:border-accent focus:outline-none";

export function Modal({ open, onOpenChange, title, children, description, wide }: { open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; children: ReactNode; description?: ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55" />
        <Dialog.Content
          className={cx(
            "fixed left-1/2 top-[8vh] z-50 max-h-[84vh] w-[calc(100vw-2rem)] -translate-x-1/2 overflow-y-auto rounded-lg border border-line bg-surface p-5 shadow-2xl scroll-thin",
            wide ? "max-w-2xl" : "max-w-lg",
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Dialog</Dialog.Description>}
            </div>
            <Dialog.Close className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CopyButton({ text, label = "Copy", className, onCopied }: { text: string; label?: string; className?: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        onCopied?.();
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-surface-2 px-1 font-mono text-[10px] text-muted">{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded bg-surface-2", className)} />;
}
