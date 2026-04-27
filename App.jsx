import { useEffect, useState, useCallback } from "react";
import FlowCanvas   from "./components/FlowCanvas";
import DataTable    from "./components/DataTable";
import SummaryCards from "./components/SummaryCards";
import Pagination   from "./components/Pagination";
import FloatingAssistant from "./components/FloatingAssistant";
import { nodesConfig, edgesConfig } from "./data/flowConfig";
import { getNodeData, getSummary }  from "./services/api";
import "./styles.css";

export default function App() {
  const [selectedNode,    setSelectedNode]    = useState(null);
  const [selectedLabel,   setSelectedLabel]   = useState("Select a node");
  const [tableData,       setTableData]       = useState([]);
  const [summaryMap,      setSummaryMap]       = useState({});
  const [currentSummary,  setCurrentSummary]  = useState({});
  const [currentPage,     setCurrentPage]     = useState(1);
  const [rowsPerPage,     setRowsPerPage]     = useState(10);

  const totalPages    = Math.ceil(tableData.length / rowsPerPage);
  const startIndex    = (currentPage - 1) * rowsPerPage;
  const paginatedData = tableData.slice(startIndex, startIndex + rowsPerPage);

  // Pre-load all node summaries for circle counts/colors
  useEffect(() => {
    const load = async () => {
      const map = {};
      for (const node of nodesConfig) {
        try   { map[node.id] = await getSummary(node.id); }
        catch { map[node.id] = {}; }
      }
      setSummaryMap(map);
    };
    load();
  }, []);

  const handleNodeClick = useCallback(async (node) => {
    const nodeId = node.id;
    const cfg    = nodesConfig.find(n => n.id === nodeId);
    setSelectedNode(nodeId);
    setSelectedLabel(cfg ? cfg.label.replace(/\n/g, " ") : nodeId);
    setCurrentPage(1);
    try {
      const [data, summary] = await Promise.all([getNodeData(nodeId), getSummary(nodeId)]);
      setTableData(data);
      setCurrentSummary(summary);
    } catch {
      setTableData([]);
      setCurrentSummary({});
    }
  }, []);

  const handleVoiceNodeSelect = useCallback((nodeId) => {
    const matched = nodesConfig.find(n => n.id === nodeId);
    if (matched) handleNodeClick({ id: matched.id });
  }, [handleNodeClick]);

  const nodes = nodesConfig.map(n => {
    const s     = summaryMap[n.id] || {};
    const color = s.failed > 0 ? "#ef4444" : "#22c55e";
    return {
      id:       n.id,
      type:     "circle",
      position: { x: n.x, y: n.y },
      data:     { label: n.label, count: s.total ?? 0, color },
    };
  });

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <div className="header">
        <h2 className="headerTitle">Rapid Dashboard</h2>
      </div>

      {/* ── Flow canvas ── */}
      <div className="flowSection">
        <FlowCanvas nodes={nodes} edges={edgesConfig} onNodeClick={handleNodeClick} />
      </div>

      {/* ── Tab bar ── */}
      <div className="tabBar">
        <span className="tab tab--active">All</span>
      </div>

      {/* ── Bottom section: summary cards + table ── */}
      <div className="contentSection">
        {/* Left: summary cards */}
        <div className="summaryPanel">
          <SummaryCards summary={currentSummary} />
        </div>

        {/* Right: table */}
        <div className="tableSection">
          {/* Table header row */}
          <div className="tableHeader">
            <div className="tableHeaderLeft">
              <span className="tableTitle">
                {selectedLabel} Total Transactions
              </span>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              rowsPerPage={rowsPerPage}
              setCurrentPage={setCurrentPage}
              setRowsPerPage={setRowsPerPage}
              totalData={tableData.length}
              startIndex={startIndex}
            />
          </div>

          <DataTable data={paginatedData} />
        </div>
      </div>

      {/* ── Floating Voice + AI Chatbot (bottom-right) ── */}
      <FloatingAssistant
        nodesConfig={nodesConfig}
        summaryMap={summaryMap}
        selectedNode={selectedNode}
        currentSummary={currentSummary}
        onNodeSelect={handleVoiceNodeSelect}
      />
    </div>
  );
}