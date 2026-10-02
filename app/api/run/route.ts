import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { createRun } from "@/lib/runStore";
import { validateGraph } from "@/lib/graph";
import type { WorkflowGraph } from "@/lib/types";

/**
 * POST /api/run
 * Body: { graph: WorkflowGraph, workflowName?: string, resumeFromRunId?: string }
 * Creates a run record and fires the Inngest event that executes the workflow.
 */
export async function POST(req: NextRequest) {
  let body: {
    graph?: WorkflowGraph;
    workflowName?: string;
    resumeFromRunId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const graph = body.graph;
  const workflowName =
    typeof body.workflowName === "string" && body.workflowName.trim()
      ? body.workflowName.trim()
      : "Untitled workflow";
  const resumeFromRunId =
    typeof body.resumeFromRunId === "string" ? body.resumeFromRunId : undefined;

  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return NextResponse.json(
      { error: "Body must include a graph: { nodes: [], edges: [] }." },
      { status: 400 }
    );
  }

  if (!resumeFromRunId) {
    const problem = validateGraph(graph);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }

  const run = createRun(graph, workflowName, resumeFromRunId);

  try {
    await inngest.send({
      name: "workflow/run.requested",
      data: { runId: run.id, graph, resume: run.resume ?? null },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not reach the Inngest dev server. Start it with: npx inngest-cli@latest dev -u http://localhost:3000/api/inngest",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ runId: run.id });
}
