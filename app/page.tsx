"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import FlowCanvas from "@/components/FlowCanvas";
import LogPanel from "@/components/LogPanel";
import NodeEditor from "@/components/NodeEditor";
import Sidebar from "@/components/Sidebar";
import Toolbar from "@/components/Toolbar";
import {
  demoGraph,
  fromReactFlow,
  toReactFlow,
  uid,
  validateGraph,
} from "@/lib/graph";
import type { FlowEdge, FlowNode } from "@/lib/flowTypes";
import type {
  HistoryEntry,
  RunRecord,
  SavedWorkflow,
  SourceHandle,
  WorkflowGraph,
} from "@/lib/types";

const LS_GRAPH = "aidf:graph:v1";
const LS_WORKFLOWS = "aidf:workflows:v1";
const LS_HISTORY = "aidf:history:v1";

function readLS<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

export default function Home() {
  const initial = useMemo(() => toReactFlow(demoGraph()), []);
  const [nodes, setNodes] = useState<FlowNode[]>(initial.nodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("Demo: Is the sky blue?");

  const [runId, setRunId] = useState<string | null>(null);
  const [runRecord, setRunRecord] = useState<RunRecord | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [saved, setSaved] = useState<SavedWorkflow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // ---- restore persisted state on first mount ----
  useEffect(() => {
    const g = readLS<WorkflowGraph>(LS_GRAPH);
    if (g && Array.isArray(g.nodes) && g.nodes.length > 0) {
      const rf = toReactFlow(g);
      setNodes(rf.nodes);
      setEdges(rf.edges);
    }
    const w = readLS<SavedWorkflow[]>(LS_WORKFLOWS);
    if (w) setSaved(w);
    const h = readLS<HistoryEntry[]>(LS_HISTORY);
    if (h) setHistory(h);
  }, []);

  // ---- auto-save graph on change (debounced) ----
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      writeLS(LS_GRAPH, fromReactFlow(nodes, edges));
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [nodes, edges]);

  // ---- run status overlay: color nodes + animate traversed edges ----
  const displayNodes = useMemo<FlowNode[]>(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: runRecord?.nodeStatus[n.id] ?? "idle",
        },
      })),
    [nodes, runRecord]
  );

  const displayEdges = useMemo<FlowEdge[]>(() => {
    const traversed = new Set(runRecord?.traversedEdges ?? []);
    return edges.map((e) =>
      traversed.has(e.id)
        ? {
            ...e,
            animated: true,
            style: { ...(e.style ?? {}), strokeWidth: 3.5 },
          }
        : e
    );
  }, [edges, runRecord]);

  // ---- React Flow handlers ----
  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;
    const sourceHandle = (conn.sourceHandle ?? "out") as SourceHandle;
    const decision =
      sourceHandle === "yes" ? "YES" : sourceHandle === "no" ? "NO" : undefined;
    const edge: FlowEdge = {
      id: uid("e"),
      source: conn.source,
      target: conn.target,
      sourceHandle,
      targetHandle: "in",
      label: decision,
      data: { decision },
      style: {
        stroke: decision === "YES" ? "#22c55e" : decision === "NO" ? "#ef4444" : "#94a3b8",
        strokeWidth: 2,
      },
    };
    // One edge per source handle keeps YES/NO routing unambiguous.
    setEdges((eds) => [
      ...eds.filter(
        (e) => !(e.source === edge.source && e.sourceHandle === edge.sourceHandle)
      ),
      edge,
    ]);
  }, []);

  const addNode = useCallback(
    (kind: "decision" | "end") => {
      const id = uid(kind === "decision" ? "dec" : "end");
      const n = nodes.length;
      const node: FlowNode = {
        id,
        type: kind,
        position: { x: 140 + (n % 6) * 70, y: 140 + (n % 6) * 70 },
        data: {
          kind,
          label: kind === "decision" ? "New decision" : "New end",
          prompt: kind === "decision" ? "Answer YES or NO: " : "",
          status: "idle",
        },
      };
      setNodes((nds) => [...nds, node]);
      setSelectedId(id);
    },
    [nodes.length]
  );

  const patchNode = useCallback(
    (id: string, patch: { label?: string; prompt?: string }) =>
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
        )
      ),
    []
  );

  const deleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  // ---- run execution ----
  const startRun = useCallback(
    async (resumeFrom?: string) => {
      const graph = fromReactFlow(nodes, edges);
      if (!resumeFrom) {
        const problem = validateGraph(graph);
        if (problem) {
          alert(problem);
          return;
        }
      }
      setIsRunning(true);
      setRunRecord(null);
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            graph,
            workflowName,
            resumeFromRunId: resumeFrom,
          }),
        });
        const data = (await res.json()) as { runId?: string; error?: string };
        if (!res.ok || !data.runId) {
          alert(`Run failed to start: ${data.error ?? res.status}`);
          setIsRunning(false);
          return;
        }
        setRunId(data.runId);
      } catch (err) {
        alert(`Run failed to start: ${err instanceof Error ? err.message : err}`);
        setIsRunning(false);
      }
    },
    [nodes, edges, workflowName]
  );

  // Poll the run record while a run is active.
  useEffect(() => {
    if (!runId) return;
    let timer: number | null = null;
    let consecutiveFailures = 0;
    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
      setIsRunning(false);
    };
    const poll = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) {
          if (++consecutiveFailures >= 15) {
            stop();
            alert("Lost track of the run (no status after 15 tries). It may have finished on the server.");
          }
          return;
        }
        consecutiveFailures = 0;
        const record = (await res.json()) as RunRecord;
        setRunRecord(record);
        if (record.status === "complete" || record.status === "error") {
          stop();
          const entry: HistoryEntry = {
            id: record.id,
            name: record.workflowName,
            startedAt: record.startedAt,
            finishedAt: record.finishedAt,
            status: record.status,
            visited: record.visited,
            decisions: record.decisions,
            log: record.log,
            error: record.error,
          };
          setHistory((h) => {
            const next = [entry, ...h].slice(0, 30);
            writeLS(LS_HISTORY, next);
            return next;
          });
        }
      } catch {
        /* transient poll failure — next tick retries */
      }
    };
    poll();
    timer = window.setInterval(poll, 1200);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [runId]);

  const canRetry =
    !isRunning &&
    runRecord?.status === "error" &&
    !!runRecord.failedNodeId;

  // ---- named workflows: save / load / delete ----
  const saveWorkflow = useCallback(() => {
    const name = workflowName.trim() || "Untitled workflow";
    const entry: SavedWorkflow = {
      name,
      savedAt: Date.now(),
      graph: fromReactFlow(nodes, edges),
    };
    setSaved((s) => {
      const next = [entry, ...s.filter((x) => x.name !== name)].slice(0, 30);
      writeLS(LS_WORKFLOWS, next);
      return next;
    });
  }, [workflowName, nodes, edges]);

  const loadWorkflow = useCallback(
    (name: string) => {
      const w = saved.find((x) => x.name === name);
      if (!w) return;
      const rf = toReactFlow(w.graph);
      setNodes(rf.nodes);
      setEdges(rf.edges);
      setWorkflowName(w.name);
      setSelectedId(null);
      setRunRecord(null);
      setRunId(null);
    },
    [saved]
  );

  const deleteSaved = useCallback((name: string) => {
    setSaved((s) => {
      const next = s.filter((x) => x.name !== name);
      writeLS(LS_WORKFLOWS, next);
      return next;
    });
  }, []);

  // ---- JSON export / import ----
  const exportJSON = useCallback(() => {
    const payload = {
      name: workflowName,
      exportedAt: new Date().toISOString(),
      graph: fromReactFlow(nodes, edges),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${workflowName.trim().replace(/\s+/g, "-") || "workflow"}.aidf.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [workflowName, nodes, edges]);

  const importFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          name?: string;
          graph?: WorkflowGraph;
        };
        const graph = parsed.graph ?? (parsed as unknown as WorkflowGraph);
        if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
          alert("That file doesn't look like an AI Decision Flow export.");
          return;
        }
        const rf = toReactFlow(graph);
        setNodes(rf.nodes);
        setEdges(rf.edges);
        if (parsed.name) setWorkflowName(parsed.name);
        setSelectedId(null);
        setRunRecord(null);
        setRunId(null);
      } catch {
        alert("Could not parse that JSON file.");
      }
    };
    reader.readAsText(f);
  }, []);

  const clearCanvas = useCallback(() => {
    if (!window.confirm("Remove all nodes and edges from the canvas?")) return;
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
    setRunRecord(null);
    setRunId(null);
  }, []);

  return (
    <div className="app">
      <Toolbar
        workflowName={workflowName}
        onWorkflowNameChange={setWorkflowName}
        onAddDecision={() => addNode("decision")}
        onAddEnd={() => addNode("end")}
        onRun={() => startRun()}
        onRetry={() => runId && startRun(runId)}
        canRetry={canRetry}
        isRunning={isRunning}
        onExport={exportJSON}
        onImportFile={importFile}
        onClear={clearCanvas}
      />
      <div className="main">
        <aside className="sidebar">
          <NodeEditor node={selectedNode} onChange={patchNode} onDelete={deleteNode} />
          <Sidebar
            saved={saved}
            onSave={saveWorkflow}
            onLoad={loadWorkflow}
            onDeleteSaved={deleteSaved}
            history={history}
            onClearHistory={() => {
              setHistory([]);
              writeLS(LS_HISTORY, []);
            }}
          />
        </aside>
        <div className="canvas-wrap">
          <FlowCanvas
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={setSelectedId}
          />
        </div>
      </div>
      <LogPanel
        log={runRecord?.log ?? []}
        runName={runRecord?.workflowName ?? null}
        status={runRecord?.status ?? null}
        isRunning={isRunning}
      />
    </div>
  );
}
