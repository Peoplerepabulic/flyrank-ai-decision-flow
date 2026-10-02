/**
 * The workflow executor. Walks the graph from the START node; every decision
 * node becomes ONE Inngest step (step.run) that really calls the LLM over
 * HTTP and parses a YES/NO answer. YES/NO edges decide where to go next.
 *
 * The run record (lib/runStore.ts) is updated as the walk proceeds so the
 * client can poll /api/runs/[id] and render live status colors, animated
 * edges, and the execution log.
 *
 * NOTE on Inngest replays: the function body re-executes from the top after
 * every completed step, so all store writes in the body must be idempotent —
 * hence logOnce() and the deduped edge pushes below.
 */
import { inngest } from "./client";
import { decideYesNo } from "../lib/llm";
import { findStartNode, nextStep } from "../lib/graph";
import { appendLog, getRun, updateRun } from "../lib/runStore";
import type {
  Decision,
  ResumeState,
  RunLogEntry,
  RunRecord,
  WorkflowGraph,
} from "../lib/types";

interface RunEventData {
  runId: string;
  graph: WorkflowGraph;
  resume: ResumeState | null;
}

/** Safety cap so a cyclic graph can't loop (and bill LLM calls) forever. */
const MAX_ITERATIONS = 50;

export const runWorkflow = inngest.createFunction(
  // No automatic retries of the whole function: a failed decision node stops
  // the run and the user retries explicitly from that node.
  { id: "run-workflow", retries: 0 },
  { event: "workflow/run.requested" },
  async ({ event, step }) => {
    const { runId, graph, resume } = event.data as RunEventData;

    const visited: string[] = resume ? [...resume.visited] : [];
    const decisions: Record<string, Decision> = resume ? { ...resume.decisions } : {};
    let context: string = resume ? resume.context : "";
    // Step ids must be deterministic across replays; the counter keeps them unique.
    let stepCounter = visited.length;

    let currentId: string | null = resume
      ? resume.startNodeId
      : (findStartNode(graph)?.id ?? null);

    /** Idempotent log: skips messages already recorded (replays re-run the body). */
    const logOnce = (level: RunLogEntry["level"], message: string) => {
      const r = getRun(runId);
      if (r && r.log.some((e) => e.level === level && e.message === message)) return;
      appendLog(runId, level, message);
    };

    /** Idempotent edge traversal record. */
    const pushEdge = (edgeId: string) => {
      updateRun(runId, (r) => {
        if (!r.traversedEdges.includes(edgeId)) r.traversedEdges.push(edgeId);
      });
    };

    const markNode = (nodeId: string, status: RunRecord["nodeStatus"][string]) => {
      updateRun(runId, (r) => {
        r.nodeStatus[nodeId] = status;
      });
    };

    if (resume) {
      logOnce(
        "info",
        `Resumed run from failed node — restored ${visited.length} visited node(s) and prior decisions.`
      );
    }

    let iterations = 0;
    while (currentId) {
      if (++iterations > MAX_ITERATIONS) {
        const msg = `Stopped after ${MAX_ITERATIONS} iterations — the graph may contain a cycle.`;
        updateRun(runId, (r) => {
          r.nodeStatus[currentId!] = "error";
          r.status = "error";
          r.failedNodeId = currentId!;
          r.error = msg;
          r.finishedAt = Date.now();
          r.visited = [...visited];
          r.decisions = { ...decisions };
          r.context = context;
        });
        logOnce("error", msg);
        return { ok: false as const, error: msg, visited, decisions };
      }

      const node = graph.nodes.find((n) => n.id === currentId);
      if (!node) {
        logOnce("error", `Node "${currentId}" not found in graph — stopping.`);
        break;
      }

      markNode(node.id, "running");
      logOnce("info", `Visiting ${node.kind} node "${node.label}".`);

      if (node.kind === "decision") {
        const stepId = `decide-${node.id}-${stepCounter}`;
        let decision: Decision;
        let repaired = false;
        try {
          const result = await step.run(stepId, async () => {
            return await decideYesNo(node.prompt || node.label, context);
          });
          decision = result.decision;
          repaired = result.repaired;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          updateRun(runId, (r) => {
            r.nodeStatus[node.id] = "error";
            r.status = "error";
            r.failedNodeId = node.id;
            r.error = msg;
            r.finishedAt = Date.now();
            r.visited = [...visited];
            r.decisions = { ...decisions };
            r.context = context;
          });
          logOnce("error", `Decision node "${node.label}" failed: ${msg}`);
          logOnce(
            "info",
            `Run stopped at the failed node. Use "Retry from failed node" to continue from here.`
          );
          return { ok: false as const, error: msg, visited, decisions };
        }

        visited.push(node.id);
        decisions[node.id] = decision;
        context += `\n- "${node.label}" → ${decision}`;
        markNode(node.id, decision === "YES" ? "yes" : "no");
        updateRun(runId, (r) => {
          r.visited = [...visited];
          r.decisions = { ...decisions };
          r.context = context;
        });
        logOnce(
          "decision",
          `"${node.label}" → ${decision}${repaired ? " (recovered via repair retry)" : ""}`
        );

        const nxt = nextStep(graph, node.id, decision);
        if (nxt) {
          pushEdge(nxt.edge.id);
          logOnce("info", `Following ${decision} edge to "${nxt.node.label}".`);
          currentId = nxt.node.id;
        } else {
          logOnce("info", `No outgoing ${decision} edge — workflow ends here.`);
          currentId = null;
        }
      } else {
        // START / END nodes: no LLM call, just pass through.
        visited.push(node.id);
        markNode(node.id, "yes");
        updateRun(runId, (r) => {
          r.visited = [...visited];
        });
        const nxt = nextStep(graph, node.id);
        if (nxt) {
          pushEdge(nxt.edge.id);
          currentId = nxt.node.id;
        } else {
          logOnce("info", `Reached terminal node "${node.label}".`);
          currentId = null;
        }
      }
      stepCounter++;
    }

    updateRun(runId, (r) => {
      r.status = "complete";
      r.finishedAt = Date.now();
      r.visited = [...visited];
      r.decisions = { ...decisions };
      r.context = context;
    });
    logOnce(
      "success",
      `Run complete — visited ${visited.length} node(s): ${visited.join(" → ")}.`
    );
    return { ok: true as const, visited, decisions };
  }
);
