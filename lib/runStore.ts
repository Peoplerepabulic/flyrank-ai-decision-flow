/**
 * SERVER-ONLY run record store, backed by a JSON file.
 *
 * A file (not a module-level Map) is used deliberately: in Next.js dev each
 * route can be compiled with its own module graph, so a Map would not
 * reliably be shared between /api/run, /api/runs/[id] and the Inngest
 * function served at /api/inngest. The file is also immune to dev-server
 * restarts. Do NOT import this from client components (it uses node:fs).
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type {
  NodeExecStatus,
  RunLogEntry,
  RunRecord,
  WorkflowGraph,
} from "./types";
import { uid } from "./graph";

const STORE_PATH = path.join(os.tmpdir(), "aidf-runs.json");
const MAX_STORED_RUNS = 50;
const MAX_LOG_ENTRIES = 500;

function readAll(): Record<string, RunRecord> {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, RunRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(runs: Record<string, RunRecord>): void {
  try {
    // Bound growth: keep only the most recent runs.
    const ids = Object.keys(runs).sort(
      (a, b) => (runs[a]?.startedAt ?? 0) - (runs[b]?.startedAt ?? 0)
    );
    while (ids.length > MAX_STORED_RUNS) {
      const oldest = ids.shift();
      if (oldest) delete runs[oldest];
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(runs));
  } catch {
    /* disk issues are non-fatal for the demo */
  }
}

export function createRun(
  graph: WorkflowGraph,
  workflowName: string,
  resumeFromRunId?: string
): RunRecord {
  const runs = readAll();
  const prev = resumeFromRunId ? runs[resumeFromRunId] : undefined;
  const id = uid("run");

  const nodeStatus: Record<string, NodeExecStatus> = {};
  for (const n of graph.nodes) nodeStatus[n.id] = "pending";

  const record: RunRecord = {
    id,
    workflowName,
    graph,
    status: "running",
    startedAt: Date.now(),
    nodeStatus,
    traversedEdges: [],
    visited: prev ? [...prev.visited] : [],
    decisions: prev ? { ...prev.decisions } : {},
    context: prev ? prev.context : "",
    log: [],
  };

  if (prev) {
    // Keep the already-decided nodes colored so the full path stays visible…
    for (const [nid, st] of Object.entries(prev.nodeStatus)) {
      if (st === "yes" || st === "no") record.nodeStatus[nid] = st;
    }
    // …and re-run from the failed node.
    if (prev.failedNodeId) {
      record.nodeStatus[prev.failedNodeId] = "pending";
      record.resume = {
        visited: [...prev.visited],
        decisions: { ...prev.decisions },
        context: prev.context,
        startNodeId: prev.failedNodeId,
      };
    }
    record.traversedEdges = [...prev.traversedEdges];
  }

  runs[id] = record;
  writeAll(runs);
  appendLog(
    id,
    "info",
    prev
      ? `Retry requested — resuming from the failed node.`
      : `Run started for workflow "${workflowName}".`
  );
  return runs[id]!;
}

export function getRun(id: string): RunRecord | undefined {
  return readAll()[id];
}

export function updateRun(id: string, fn: (r: RunRecord) => void): void {
  const runs = readAll();
  const r = runs[id];
  if (!r) return;
  fn(r);
  if (r.log.length > MAX_LOG_ENTRIES) {
    r.log = r.log.slice(-MAX_LOG_ENTRIES);
  }
  writeAll(runs);
}

export function appendLog(
  id: string,
  level: RunLogEntry["level"],
  message: string
): void {
  updateRun(id, (r) => {
    r.log.push({ ts: Date.now(), level, message });
  });
}
