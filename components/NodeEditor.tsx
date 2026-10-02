"use client";
import type { FlowNode } from "@/lib/flowTypes";

interface NodeEditorProps {
  node: FlowNode | null;
  onChange: (id: string, patch: { label?: string; prompt?: string }) => void;
  onDelete: (id: string) => void;
}

/** Side panel for editing the selected node's label and (decision) prompt. */
export default function NodeEditor({ node, onChange, onDelete }: NodeEditorProps) {
  if (!node) {
    return (
      <div className="panel">
        <h3>Node editor</h3>
        <p className="muted">
          Click a node to edit it. Drag from a node&apos;s <b className="yes">YES</b> /{" "}
          <b className="no">NO</b> handle to another node to connect them.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>
        Node editor{" "}
        <span className={`kind-badge ${node.data.kind}`}>{node.data.kind}</span>
      </h3>
      <label className="field">
        <span>Label</span>
        <input
          type="text"
          value={node.data.label}
          onChange={(e) => onChange(node.id, { label: e.target.value })}
        />
      </label>
      {node.data.kind === "decision" && (
        <label className="field">
          <span>Prompt (sent to the LLM)</span>
          <textarea
            rows={5}
            value={node.data.prompt}
            onChange={(e) => onChange(node.id, { prompt: e.target.value })}
            placeholder="Ask a yes/no question, e.g. Is the sky blue?"
          />
        </label>
      )}
      <button className="btn danger ghost" onClick={() => onDelete(node.id)}>
        Delete node
      </button>
    </div>
  );
}
