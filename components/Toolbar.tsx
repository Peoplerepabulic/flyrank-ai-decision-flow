"use client";
import { useRef } from "react";

interface ToolbarProps {
  workflowName: string;
  onWorkflowNameChange: (v: string) => void;
  onAddDecision: () => void;
  onAddEnd: () => void;
  onRun: () => void;
  onRetry: () => void;
  canRetry: boolean;
  isRunning: boolean;
  onExport: () => void;
  onImportFile: (f: File) => void;
  onClear: () => void;
}

export default function Toolbar({
  workflowName,
  onWorkflowNameChange,
  onAddDecision,
  onAddEnd,
  onRun,
  onRetry,
  canRetry,
  isRunning,
  onExport,
  onImportFile,
  onClear,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">◆</span>
        <span className="brand-name">AI Decision Flow</span>
      </div>

      <input
        className="workflow-name"
        type="text"
        value={workflowName}
        onChange={(e) => onWorkflowNameChange(e.target.value)}
        placeholder="Workflow name"
        title="Workflow name"
      />

      <div className="toolbar-group">
        <button className="btn" onClick={onAddDecision} title="Add a decision node (asks the LLM)">
          ＋ Decision
        </button>
        <button className="btn" onClick={onAddEnd} title="Add a terminal end node">
          ＋ End
        </button>
      </div>

      <div className="toolbar-group">
        <button className="btn primary" onClick={onRun} disabled={isRunning} title="Execute the workflow via Inngest">
          {isRunning ? "Running…" : "▶ Run"}
        </button>
        {canRetry && (
          <button className="btn warn" onClick={onRetry} title="Resume from the failed node">
            ↻ Retry failed node
          </button>
        )}
      </div>

      <div className="toolbar-group">
        <button className="btn ghost" onClick={onExport} title="Download workflow as JSON">
          Export
        </button>
        <button
          className="btn ghost"
          onClick={() => fileRef.current?.click()}
          title="Import workflow from JSON"
        >
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = "";
          }}
        />
        <button className="btn ghost danger" onClick={onClear} title="Remove all nodes and edges">
          Clear
        </button>
      </div>
    </header>
  );
}
