"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNode } from "@/lib/flowTypes";
import type { NodeExecStatus } from "@/lib/types";

const STATUS_CLASS: Record<NodeExecStatus, string> = {
  idle: "st-idle",
  pending: "st-pending",
  running: "st-running",
  yes: "st-yes",
  no: "st-no",
  error: "st-error",
};

function cls(data: FlowNode["data"], selected: boolean | undefined, extra: string) {
  return `rf-node ${extra} ${STATUS_CLASS[data.status] ?? "st-idle"}${selected ? " selected" : ""}`;
}

/**
 * Decision node: one target handle (left), two source handles (right):
 * green YES on top, red NO below.
 */
export function DecisionNode({ data, selected }: NodeProps<FlowNode>) {
  return (
    <div className={cls(data, selected, "decision")}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="node-kind">AI DECISION</div>
      <div className="node-label">{data.label}</div>
      <div className="node-prompt">{data.prompt || "— no prompt set —"}</div>
      <Handle
        type="source"
        position={Position.Right}
        id="yes"
        style={{ top: "30%", background: "#22c55e", width: 12, height: 12 }}
      />
      <span className="handle-tag yes" style={{ top: "30%" }}>
        YES
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id="no"
        style={{ top: "70%", background: "#ef4444", width: 12, height: 12 }}
      />
      <span className="handle-tag no" style={{ top: "70%" }}>
        NO
      </span>
    </div>
  );
}

/** Entry point of a run — one outgoing handle, no LLM call. */
export function StartNode({ data, selected }: NodeProps<FlowNode>) {
  return (
    <div className={cls(data, selected, "start")}>
      <div className="node-label">▶ {data.label}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

/** Terminal node — just a labeled stop, no LLM call. */
export function EndNode({ data, selected }: NodeProps<FlowNode>) {
  return (
    <div className={cls(data, selected, "end")}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="node-kind">END</div>
      <div className="node-label">{data.label}</div>
    </div>
  );
}
