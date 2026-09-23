"use client";
import { Bot, ExternalLink, Play } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, cx, CopyButton, inputCls, PageHeader } from "@/components/ui";
import { Loading } from "@/components/domain";
import { useDerived, useLS, useWeek } from "@/lib/client/hooks";
import { useLearning } from "@/lib/client/store";
import { RESOURCES } from "@/lib/client/resources";
import { IDX } from "@/lib/roadmap/client-index";
import { currentTask } from "@/lib/state/selectors";

interface Prompt { id: string; name: string; when: string; body: string }

/** Fill the source prompt placeholders from real context (never invented). */
export function fillPrompt(body: string, v: Record<string, string>) {
  return body.replace(/\{([A-Z_]+)\}/g, (m, k: string) => (k in v && v[k] ? v[k] : m));
}

export function TutorView({ prompts, copy }: { prompts: Prompt[]; copy: { lead: string; workflow: string; tips: string[] } }) {
  const { hydrated, dispatch } = useLS();
  const sp = useSearchParams();
  const startTimer = useLearning((s) => s.startTimer);
  const timer = useLearning((s) => s.timer);
  const cur = useDerived((s) => currentTask(s));
  const taskId = sp.get("task") && IDX.byId.has(sp.get("task")!) ? sp.get("task")! : cur?.id;
  const t = taskId ? IDX.byId.get(taskId)! : null;
  const weekN = Number(sp.get("week")) || t?.week || 1;
  const week = useWeek(weekN);
  const [pid, setPid] = useState(sp.get("prompt") && prompts.some((p) => p.id === sp.get("prompt")) ? sp.get("prompt")! : "tutor");
  const [topic, setTopic] = useState(sp.get("topic") ?? "");
  const [edited, setEdited] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const task = week?.tasks.find((x) => x.id === taskId);
  const prompt = prompts.find((p) => p.id === pid)!;
  const vars = useMemo(() => {
    if (!week) return {} as Record<string, string>;
    const phase = IDX.phases.find((p) => p.id === week.phase)!;
    const res = task?.resource ? RESOURCES[task.resource] : RESOURCES[week.resources[0]];
    return {
      PHASE: `${phase.id} — ${phase.name}`, WEEK: String(week.n), WEEK_TITLE: week.title, TASK: task?.text ?? week.objective, WEEK_TOPICS: week.topics.join("; "),
      RESOURCE: res ? `${res.name}${res.url ? ` (${res.url})` : ""}` : "", CHECKPOINT: week.checkpoint.join("; "), MIN: String(task?.minutes ?? 60),
      TOPIC: topic || task?.text.split(/(?<=\.)\s/)[0] || week.title, NEXT_WEEK: IDX.weeks[week.n]?.title ?? "final review",
    };
  }, [week, task, topic]);
  useEffect(() => setEdited(null), [pid, taskId, weekN, topic]);
  if (!hydrated) return <Loading />;
  const text = edited ?? (week ? fillPrompt(prompt.body, vars) : "");
  return (
    <>
      <PageHeader title="Study with Claude" lead={copy.lead} />
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-1">
          {prompts.map((p) => (
            <button key={p.id} onClick={() => setPid(p.id)} className={cx("block w-full rounded-md border px-3 py-2 text-left", pid === p.id ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2")}>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-muted">{p.when}</div>
            </button>
          ))}
        </aside>
        <div className="min-w-0 space-y-3">
          <Card>
            <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted">Context</div>
                <div>
                  W{weekN} · {week?.title ?? "…"}
                  {t ? ` · D${t.day} task` : ""}
                </div>
              </div>
              <label className="block">
                <span className="text-xs text-muted">Topic override (optional)</span>
                <input className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={vars.TOPIC?.slice(0, 60)} />
              </label>
            </div>
            <textarea className={cx(inputCls, "h-auto min-h-72 py-2 font-mono text-xs leading-relaxed")} value={text} onChange={(e) => setEdited(e.target.value)} aria-label="Prompt" />
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={text} label="Copy prompt" />
              <a
                href={`https://claude.ai/new?q=${encodeURIComponent(text.slice(0, 7000))}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3.5 text-sm font-medium hover:border-line-strong"
              >
                <ExternalLink className="size-4" /> Open Claude
              </a>
              <Button
                variant="primary"
                disabled={started || !!timer}
                onClick={() => {
                  startTimer(taskId);
                  if (taskId) dispatch("TASK_STARTED", { taskId });
                  setStarted(true);
                }}
              >
                <Play className="size-4" /> {started || timer ? "Session running" : "Start session"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">Start session starts the focus timer{taskId ? " and marks the task in progress" : ""}. Stop it from the top bar when you finish.</p>
          </Card>
          <Card title="How to use it">
            <p className="text-sm">{copy.workflow}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
              {copy.tips.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <Bot className="hidden" />
          </Card>
        </div>
      </div>
    </>
  );
}
