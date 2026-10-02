/** Graph helpers: traversal, validation, demo workflow, React Flow conversion. */
import type { Decision, GraphEdge, GraphNode, SourceHandle, WorkflowGraph } from "./types";
import type { FlowEdge, FlowNode } from "./flowTypes";

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function findStartNode(graph: WorkflowGraph): GraphNode | undefined {
  return graph.nodes.find((n) => n.kind === "start");
}

/**
 * Follow edges out of a node. For decision nodes pass the decision to pick
 * the YES/NO edge; otherwise the first outgoing edge is used.
 */
export function nextStep(
  graph: WorkflowGraph,
  nodeId: string,
  decision?: Decision
): { node: GraphNode; edge: GraphEdge } | null {
  const outs = graph.edges.filter((e) => e.source === nodeId);
  if (outs.length === 0) return null;
  let edge: GraphEdge | undefined;
  if (decision) {
    edge = outs.find((e) => e.sourceHandle === decision.toLowerCase());
  }
  edge = edge ?? outs[0];
  const node = graph.nodes.find((n) => n.id === edge!.target);
  if (!node) return null;
  return { node, edge: edge! };
}

/** Returns a human-readable problem, or null when the graph is runnable. */
export function validateGraph(graph: WorkflowGraph): string | null {
  const starts = graph.nodes.filter((n) => n.kind === "start");
  if (starts.length === 0) return "Add a START node to the canvas first.";
  if (starts.length > 1) return "Only one START node is allowed.";
  const decisions = graph.nodes.filter((n) => n.kind === "decision");
  if (decisions.length === 0) return "Add at least one decision node.";
  for (const d of decisions) {
    if (!d.prompt.trim()) return `Decision node "${d.label}" has an empty prompt.`;
  }
  return null;
}

/** The default workflow shown on first load — runnable with one click. */
export function demoGraph(): WorkflowGraph {
  return {
    nodes: [
      { id: "start-1", kind: "start", label: "START", prompt: "", position: { x: 40, y: 220 } },
      {
        id: "dec-sky",
        kind: "decision",
        label: "Is the sky blue?",
        prompt:
          "Is the sky blue? Consider the typical daytime sky on Earth as seen by a human observer.",
        position: { x: 300, y: 200 },
      },
      { id: "end-celebrate", kind: "end", label: "Celebrate", prompt: "", position: { x: 640, y: 90 } },
      { id: "end-investigate", kind: "end", label: "Investigate", prompt: "", position: { x: 640, y: 330 } },
    ],
    edges: [
      { id: "e-start-sky", source: "start-1", target: "dec-sky", sourceHandle: "out" },
      { id: "e-sky-yes", source: "dec-sky", target: "end-celebrate", sourceHandle: "yes" },
      { id: "e-sky-no", source: "dec-sky", target: "end-investigate", sourceHandle: "no" },
    ],
  };
}

const EDGE_COLOR: Record<string, string> = {
  YES: "#22c55e",
  NO: "#ef4444",
};

/** Serializable graph -> React Flow nodes/edges (for rendering + editing). */
export function toReactFlow(graph: WorkflowGraph): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  const nodes: FlowNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: n.position,
    data: { kind: n.kind, label: n.label, prompt: n.prompt, status: "idle" },
  }));
  const edges: FlowEdge[] = graph.edges.map((e) => {
    const decision: Decision | undefined =
      e.sourceHandle === "yes" ? "YES" : e.sourceHandle === "no" ? "NO" : undefined;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: "in",
      label: decision,
      data: { decision },
      style: {
        stroke: decision ? EDGE_COLOR[decision] : "#94a3b8",
        strokeWidth: 2,
      },
    };
  });
  return { nodes, edges };
}

/** React Flow nodes/edges -> serializable graph (for saving + sending to the API). */
export function fromReactFlow(nodes: FlowNode[], edges: FlowEdge[]): WorkflowGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      label: n.data.label,
      prompt: n.data.prompt,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: (e.sourceHandle as SourceHandle) ?? "out",
    })),
  };
}
