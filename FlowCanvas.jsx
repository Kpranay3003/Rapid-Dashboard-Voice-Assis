import ReactFlow, { Background } from "reactflow";
import "reactflow/dist/style.css";
import CircleNode from "./CircleNode";

const nodeTypes = { circle: CircleNode };

export default function FlowCanvas({ nodes, edges, onNodeClick }) {
  return (
    <div className="flowWrapper">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick(node)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        edgesFocusable={false}
        defaultEdgeOptions={{
          style: { stroke: "#9ca3af", strokeWidth: 1.5 },
          markerEnd: { type: "arrowclosed", color: "#9ca3af", width: 14, height: 14 },
        }}
      >
        <Background color="#e5e7eb" gap={24} size={1} />
      </ReactFlow>
    </div>
  );
}