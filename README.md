# AI Decision Flow

A visual AI workflow builder (FlyRank Backend AI Engineering internship project).

Draw a flowchart where **each node is a real LLM decision** returning **YES** or **NO**.
Press **Run** → the graph is sent to a Next.js API route → an **Inngest** function
walks the graph, calling the LLM once per decision node (`step.run`), and follows
the green YES / red NO edges. Node colors, animated edges, and a timestamped log
show the execution live.

No mocking: every decision node really calls an LLM over HTTP
(Pollinations keyless GET endpoint — no API key needed).

## Prerequisites

- Node.js 18+ and npm
- Two terminal windows (one for Next.js, one for the Inngest dev server)

## Install

```bash
npm install
```

## Run (development)

Terminal 1 — the Next.js app (http://localhost:3000):

```bash
npm run dev
```

Terminal 2 — the Inngest dev server (http://localhost:8288), pointed at the app's
Inngest route:

```bash
npm run inngest
# equivalent: npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Then open http://localhost:3000. Both servers must be running before you press **Run** —
the app POSTs the graph to `/api/run`, which fires an Inngest event; the dev server
executes the function through the app.

Optional env (see `.env.example`):

```bash
INNGEST_DEV=1                 # dev-server mode (also auto-enabled outside production)
LLM_BASE_URL=...              # override the LLM endpoint (default: Pollinations keyless GET)
```

## Build a flow

1. **＋ Decision** adds an AI decision node (asks the LLM a yes/no question).
   **＋ End** adds a terminal label node. A **START** node kicks off every run.
2. Drag nodes to position them. Drag from a node's **YES** (green) or **NO** (red)
   handle onto another node to connect them (one edge per handle).
3. Click a node to edit its **label** and **prompt** in the side panel.
4. The canvas auto-saves to `localStorage`; **Export/Import** moves workflows as JSON;
   **Save current as named workflow** keeps named versions in the sidebar.

## Run it

Press **▶ Run**. The log panel streams timestamped entries while:

- the current node pulses **blue** (running),
- YES decisions turn **green**, NO decisions turn **red**, failures turn **amber**,
- traversed edges animate.

Past runs appear under **Run history** (click to expand the full log). If an LLM
call fails, the node is marked as failed and **↻ Retry failed node** resumes the
workflow from that node with all prior decisions restored.

## The demo workflow

On first load you get `START → "Is the sky blue?" → YES → "Celebrate" / NO → "Investigate"`.
Press **Run** immediately: the START node passes through, the LLM answers the sky
question (one Inngest `step.run`), and execution follows the matching colored edge
to the end node. The log records the decision and the full visit order.

## How it works

- `app/page.tsx` + `components/*` — React Flow canvas, editor, toolbar, log, history.
- `app/api/run/route.ts` — receives the graph, creates a run record, sends the Inngest event.
- `inngest/functions.ts` — `run-workflow`: walks from START; each decision node is one
  `step.run` calling `lib/llm.ts`, then follows the YES/NO edge; updates the run record.
- `lib/llm.ts` — Pollinations GET caller (45s timeout), robust YES/NO parsing
  (first tokens, then a final-line fallback), plus ONE repair retry asking for
  "only YES or NO" when the answer isn't parseable.
- `lib/runStore.ts` — server-side in-memory run records, polled via `app/api/runs/[id]`.

## Production build

```bash
npm run build
npm start
```

Note: run records live in a JSON file (`$TMPDIR/aidf-runs.json`), so they survive
dev-server restarts — history in the browser (`localStorage`) persists.

## Troubleshooting

- **`/api/run` returns 502 "Could not reach the Inngest dev server"** — the dev
  server isn't running. Start it (second terminal) before pressing Run.
- **Port 8288 already taken** (e.g. another project's Inngest dev server is
  using it): start yours on a free port and point the app at it —
  `./inngest dev -u http://localhost:3000/api/inngest -p 8388` plus
  `INNGEST_BASE_URL=http://localhost:8388 npm run dev`.
  (The `npx inngest-cli@latest` download is ~100MB; if it's slow, grab the
  standalone binary from the
  [inngest-cli releases](https://github.com/inngest/inngest-cli/releases) instead.)
- **Decision node fails with an LLM HTTP error** — the Pollinations keyless
  endpoint occasionally has outages (e.g. HTTP 500 `ENOSPC`). The node is
  marked failed; press **↻ Retry failed node** once the endpoint recovers.
  The run resumes from that node with prior decisions intact.
