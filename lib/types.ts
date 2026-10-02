/** Shared domain types for the AI Decision Flow app. */

export type NodeKind = "start" | "decision" | "end";
export type Decision = "YES" | "NO";

/** Visual execution status of a node on the canvas. */
export type NodeExecStatus =
  | "idle" // not part of an active run
  | "pending" // in the graph, run hasn't reached it yet
  | "running" // currently being executed
  | "yes" // completed with YES (green) — also used for completed start/end nodes
  | "no" // completed with NO (red)
  | "error"; // LLM call failed

export type RunStatus = "running" | "complete" | "error";

/** Serializable node — the unit persisted to localStorage / sent to the API. */
export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** The question sent to the LLM (decision nodes only). */
  prompt: string;
  position: { x: number; y: number };
}

/** Which output handle an edge leaves from. */
export type SourceHandle = "yes" | "no" | "out";

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: SourceHandle;
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RunLogEntry {
  ts: number;
  level: "info" | "decision" | "error" | "success";
  message: string;
}

/** State carried into a retried run so it can resume from the failed node. */
export interface ResumeState {
  visited: string[];
  decisions: Record<string, Decision>;
  /** Accumulated "node label → decision" lines fed back into later prompts. */
  context: string;
  startNodeId: string;
}

/** Server-side record of one execution, polled by the client. */
export interface RunRecord {
  id: string;
  workflowName: string;
  graph: WorkflowGraph;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  nodeStatus: Record<string, NodeExecStatus>;
  traversedEdges: string[];
  visited: string[];
  decisions: Record<string, Decision>;
  context: string;
  log: RunLogEntry[];
  failedNodeId?: string;
  error?: string;
  resume?: ResumeState;
}

export interface SavedWorkflow {
  name: string;
  savedAt: number;
  graph: WorkflowGraph;
}

export interface HistoryEntry {
  id: string;
  name: string;
  startedAt: number;
  finishedAt?: number;
  status: RunStatus;
  visited: string[];
  decisions: Record<string, Decision>;
  log: RunLogEntry[];
  error?: string;
}
