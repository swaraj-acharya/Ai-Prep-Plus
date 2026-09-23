# AI PrepBoard

A learning OS for the **52-week AI-Cloud engineering roadmap**: a daily plan that always knows where you are, spaced
DSA revision, mastery checkpoints and phase gates that never pass themselves, a 57-project **Project Lab**,
"Study with Claude" prompts filled from your real context — and, like
[swaraj-acharya/PrepBoard](https://github.com/swaraj-acharya/PrepBoard), **owner sign-in, a day-by-day history,
a daily goal with streak and heatmap, and a "Push progress now" button that saves everything to your GitHub repo in one commit.**

No database, no paid services. Progress lives in your browser and in your GitHub repo.

Light and dark themes share one brand (navy + amber). The app icon is an AI-style sparkle (`public/icon.svg`, with
`favicon.ico`, `apple-icon.png` and 192/512 PNGs for phones and the installable PWA).

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Locally, without `AUTH_ID`/`AUTH_PASSWORD`, the site is open so you can try it immediately. A production deploy
without them stays locked.

## Deploy to Vercel

1. Push this folder to a GitHub repo (or upload it: *Add file → Upload files*, drag the folder's contents, commit).
2. On vercel.com: **Add New → Project → Import** the repo → **Deploy**.
3. In **Settings → Environment Variables** add `AUTH_ID` and `AUTH_PASSWORD` (and GitHub saving below), then redeploy.

## Sign-in

The whole site sits behind one ID and password that you choose (`AUTH_ID`, `AUTH_PASSWORD` in Vercel — never in the
code). After signing in, the browser keeps a signed HttpOnly cookie for 7 days. Changing `AUTH_PASSWORD` (or the
optional `AUTH_SECRET`) signs out every device. Pages redirect to `/login`, API requests get a 401. Wrong passwords
are slowed down and rate-limited. **Settings → Sign out on this device** ends the session.

## Save progress to GitHub (optional)

Your progress can be committed to your GitHub repo, so it shows on your contribution graph and syncs between devices.

1. Create a fine-grained token at <https://github.com/settings/personal-access-tokens/new>: **Only select repositories** →
   this repo, **Contents: Read and write**.
2. In Vercel → Settings → Environment Variables add:
   - `GITHUB_TOKEN`: the token
   - `GITHUB_REPO`: `yourname/your-repo`
   - `SYNC_SECRET`: a long password you make up (leave empty to let any signed-in device push)
   - optional: `GITHUB_BRANCH` (defaults to the repo's default branch), `PROGRESS_DIR` (defaults to `progress`)

   Then redeploy.
3. On the site: **GitHub → Save progress to GitHub**, type your `SYNC_SECRET`, click **Connect**. Once per device.
4. Study as usual. **Nothing is sent until you click _Push progress now_** (on the GitHub page, the Today page, or the
   **“N not pushed”** badge in the top bar). Everything you changed since the last push goes up together as **one commit**
   with a message like `Completed W14D3; solved Two Sum; passed P3 gate`. Pushing with nothing new creates no commit.

Opening the site (or coming back to the tab) loads what's on GitHub and merges it in, so your phone and laptop stay in
sync. Progress is an append-only event log, so merging is a set union — two devices can never overwrite each other;
if another device pushed while you were pushing, the commit is redone on top of it.

What gets committed (all inside `progress/`):

| File | What |
|---|---|
| `events.json` | the complete learning log — the source of truth every device loads (one event per line) |
| `README.md` | summary, current streak, last 14 days, your last 7 active days |
| `HISTORY.md` | every active day, newest first |
| `daily/YYYY/DATE.md` + `.json` | one file per study day |
| `weekly/WNN.md`, `reflections/WNN.md` | week summaries and your weekly reflections |
| `milestones/`, `dsa/`, `projects/` | gates, mastery, DSA milestones; problem log; project status and evidence |

`vercel.json` stops Vercel from redeploying for commits that only touch `progress/`. The token never reaches the
browser; without your sign-in (and `SYNC_SECRET`) nobody can save. If the repo is public, your progress — including
notes and reflections — is public too. Commits count on your contribution graph when they land on the default branch
of a repo that isn't a fork (for private repos, enable "Private contributions" on your profile). Commits are dated
when you push; nothing is backdated.

## Daily track and history

- **Daily goal** (default 3 study units: roadmap tasks, DSA problems solved, project milestones). Reaching it keeps your
  **streak**, shown in the top bar with today's progress (`12 days streak · 2/3`). Change it with − / + on Today.
- **Heatmap** of the last 18 weeks on Today, the Dashboard and History; click a day to jump to it.
- **Finish line**: remaining tasks and the date you'll finish at your recent pace.
- **History**: every active day, newest first — tasks completed, DSA solved / revised (remembered or forgot),
  mastery confirmed, gates passed, project status changes, weekly reflections — with filters (Everything, Tasks,
  DSA, Revisions, Milestones), search, "Show older days", and each day's end-of-day roadmap position.
  History is built from your current progress, so un-ticking a task removes it from its day.

## Resources

The Resources page has two libraries:

- **Roadmap library (142)** — every resource from the original roadmap, unchanged. The two book resources that had no
  link now get one (DDIA → dataintensive.net, 2nd edition 2026; Alex Xu → ByteByteGo), and each week page now also
  lists library resources whose own week range covers that week (e.g. Grafana and Loki in W22, Helm in W44).
- **Curated additions (68)** — free, maintained resources that fill real gaps: LLM engineering (Claude Academy, Claude
  and OpenAI cookbooks, LLM Course, Hands-On LLMs), transformers from scratch (LLMs-from-scratch, nanoGPT, annotated
  papers), RAG (RAG_Techniques, the Stanford IR book, LLM Zoomcamp), agents and MCP (AI Agents for Beginners, GenAI
  Agents, 12-Factor Agents, reference MCP servers), evals and red-teaming (Evals FAQ, DeepEval, Phoenix, garak, PyRIT),
  inference and MLOps (ML Engineering Open Book, Ultra-Scale Playbook, llama.cpp, SGLang, TRL, MLOps Zoomcamp), cloud
  (AWS SAA exam guide and Well-Architected — the core certification had no prep resource — 90DaysOfDevOps, Kubernetes
  the Hard Way, CKAD exercises, Terraform best practices), system design, CS foundations, interview prep and negotiation.
  Each is matched to roadmap weeks and appears on those week pages; Lab projects show the most relevant ones.
  All 45 GitHub repos were verified on 2026-09-23 and show their last-update date.

Edit `src/data/resources/curated.ts` to add your own; `npm run validate-roadmap` checks every entry.

## Scripts

| Script | What it does |
|---|---|
| `npm run extract-roadmap` | Parses `source/Master-Roadmap-AI-Cloud-v2.html` → `src/data/generated/*` |
| `npm run validate-roadmap` | Re-parses the source independently and checks every count, task text, ID and link; scans for VLSI; validates the Project Lab |
| `npm run build` | extract → validate → `next build` |
| `npm test` | Vitest: roadmap, reducer, streaks/time zones, DSA engine, Lab, push-progress sync, sign-in, history, importers, acceptance flow |

## How it works

- **Event log.** Every action is a zod-validated event saved in IndexedDB first (works offline). State is a pure,
  order-independent reduction, so any device's log merges cleanly and any past day can be reconstructed.
- **Position = first day with an unresolved task**, not the calendar. Tasks can be not started, in progress,
  completed, skipped or deferred (deferred tasks stay visible but don't block).
- **DSA revision** after 1/7/21/30 days (configurable), anchored on your first solve; a revision only completes when
  you log a solved attempt on/after its due date.
- **Mastery and gates never complete themselves**: mastery needs every item checked plus a confirmation; "Mark passed"
  needs every pass criterion checked.
- **Project Lab**: 57 projects in 4 tiers with prerequisites, roadmap links, architecture, milestones, evidence,
  quality checklists and startup mode. Locks are advice; every project can be started. Recommendations explain themselves.

## Importing and backups

Settings → Data exports a backup file and imports either a backup or a backup of the original single-file Learning OS
(`learning-os-v1`), keeping completion dates, notes, reflections, checklists and timer history. VLSI checklist entries
are dropped. Imported progress is pushed like anything else.

## Security

Signed, expiring HttpOnly cookies (`SameSite=Lax`, `Secure` in production); constant-time secret comparison; login
delay + rate limits; same-origin checks on every write; the GitHub token stays server-side; pushes accept only
validated client event types and reject future-dated events; commits only write inside `PROGRESS_DIR`; security
headers (`X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies).
# Ai-Prep-Plus
