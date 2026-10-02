/** React Flow flavored node/edge types used by the canvas components. */
import type { Edge, Node } from "@xyflow/react";
import type { Decision, NodeExecStatus, NodeKind } from "./types";

export interface FlowNodeData extends Record<string, unknown> {
  kind: NodeKind;
  label: string;
  prompt: string;
  status: NodeExecStatus;
}

export type FlowNode = Node<FlowNodeData, "start" | "decision" | "end">;

export interface FlowEdgeData extends Record<string, unknown> {
  decision?: Decision;
}

export type FlowEdge = Edge<FlowEdgeData>;
