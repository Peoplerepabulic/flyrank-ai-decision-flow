"use client";
import { useState } from "react";
import type { HistoryEntry, RunLogEntry, SavedWorkflow } from "@/lib/types";

interface SidebarProps {
  saved: SavedWorkflow[];
  onSave: () => void;
  onLoad: (name: string) => void;
  onDeleteSaved: (name: string) => void;
  history: HistoryEntry[];
  onClearHistory: () => void;
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function HistoryLog({ log }: { log: RunLogEntry[] }) {
  return (
    <div className="history-log">
      {log.map((e, i) => (
        <div key={i} className={`log-line ${e.level}`}>
          <span className="log-ts">{fmt(e.ts)}</span>
          <span className="log-msg">{e.message}</span>
        </div>
      ))}
    </div>
  );
}

/** Saved named workflows + execution history of past runs. */
export default function Sidebar({
  saved,
  onSave,
  onLoad,
  onDeleteSaved,
  history,
  onClearHistory,
}: SidebarProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <div className="panel">
        <h3>Workflows</h3>
        <button className="btn wide" onClick={onSave} title="Save the current canvas under its workflow name">
          Save current as named workflow
        </button>
        {saved.length === 0 && <p className="muted">No saved workflows yet.</p>}
        <ul className="saved-list">
          {saved.map((s) => (
            <li key={s.name}>
              <button className="link" onClick={() => onLoad(s.name)} title="Load this workflow">
                {s.name}
              </button>
              <span className="muted small">{fmt(s.savedAt)}</span>
              <button
                className="link danger"
                onClick={() => onDeleteSaved(s.name)}
                title="Delete saved workflow"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>
          Run history
          {history.length > 0 && (
            <button className="link danger small" onClick={onClearHistory} title="Clear history">
              clear
            </button>
          )}
        </h3>
        {history.length === 0 && <p className="muted">No runs yet.</p>}
        <ul className="history-list">
          {history.map((h) => (
            <li key={h.id} className={expanded === h.id ? "open" : ""}>
              <button
                className="history-head"
                onClick={() => setExpanded(expanded === h.id ? null : h.id)}
              >
                <span className={`run-status ${h.status}`}>{h.status}</span>
                <span className="history-name">{h.name}</span>
                <span className="muted small">{fmt(h.startedAt)}</span>
              </button>
              <div className="muted small history-meta">
                {h.visited.length} node(s) visited
                {h.error ? ` · ${h.error.slice(0, 80)}` : ""}
              </div>
              {expanded === h.id && <HistoryLog log={h.log} />}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
