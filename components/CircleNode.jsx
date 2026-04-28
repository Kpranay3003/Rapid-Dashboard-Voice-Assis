import { Handle, Position } from "reactflow";

export default function CircleNode({ data }) {
  return (
    <div style={{ position: "relative", width: 64, height: 64 }}>
      <Handle type="target" position={Position.Left}
        style={{ background: "transparent", border: "none", width: 1, height: 1 }} />

      {/* Circle */}
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: data.color,
        border: "3px solid rgba(255,255,255,0.4)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", cursor: "pointer",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
          {data.count?.toLocaleString() ?? ""}
        </div>
      </div>

      <Handle type="source" position={Position.Right}
        style={{ background: "transparent", border: "none", width: 1, height: 1 }} />

      {/* Label below */}
      <div style={{
        position: "absolute", top: 72, left: "50%",
        transform: "translateX(-50%)",
        whiteSpace: "pre", fontSize: 11, color: "#374151",
        textAlign: "center", pointerEvents: "none", lineHeight: 1.4,
        fontWeight: 500,
      }}>
        {data.label}
      </div>
    </div>
  );
}