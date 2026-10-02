"use client";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowEdge, FlowNode } from "@/lib/flowTypes";
import { DecisionNode, EndNode, StartNode } from "./DecisionNode";

const nodeTypes = { start: StartNode, decision: DecisionNode, end: EndNode };

interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (id: string | null) => void;
}

export default function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
}: FlowCanvasProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_e, node) => onNodeClick(node.id)}
      onPaneClick={() => onNodeClick(null)}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      deleteKeyCode={["Backspace", "Delete"]}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1.5} />
      <Controls />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
