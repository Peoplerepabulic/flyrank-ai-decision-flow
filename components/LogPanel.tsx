"use client";
import { useEffect, useRef } from "react";
import type { RunLogEntry, RunStatus } from "@/lib/types";

interface LogPanelProps {
  log: RunLogEntry[];
  runName: string | null;
  status: RunStatus | null;
  isRunning: boolean;
}

function fmt(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false });
}

const LEVEL_LABEL: Record<RunLogEntry["level"], string> = {
  info: "INFO",
  decision: "DECISION",
  error: "ERROR",
  success: "DONE",
};

export default function LogPanel({ log, runName, status, isRunning }: LogPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <section className="log-panel">
      <div className="log-head">
        <h3>Execution log</h3>
        {runName && (
          <span className="log-run">
            {runName}
            {status && <span className={`run-status ${status}`}>{status}</span>}
            {isRunning && <span className="spinner" />}
          </span>
        )}
      </div>
      <div className="log-body" ref={bodyRef}>
        {log.length === 0 && (
          <p className="muted">
            Press <b>▶ Run</b> to execute the workflow. Each decision node calls the LLM
            over HTTP and follows the YES (green) / NO (red) edge.
          </p>
        )}
        {log.map((e, i) => (
          <div key={i} className={`log-line ${e.level}`}>
            <span className="log-ts">{fmt(e.ts)}</span>
            <span className={`log-level ${e.level}`}>{LEVEL_LABEL[e.level]}</span>
            <span className="log-msg">{e.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
