import "../styles.css";

export default function SummaryCards({ summary }) {
  const total      = summary.total   ?? 0;
  const success    = summary.success ?? 0;
  const failed     = summary.failed  ?? 0;
  const successPct = total ? Math.round((success / total) * 100) : 0;
  const failedPct  = total ? Math.round((failed  / total) * 100) : 0;

  return (
    <div className="summaryContainer">
      {/* Total card */}
      <div className="summaryCard total">
        <div className="summaryValue">{total.toLocaleString()}</div>
        <div className="summaryLabel">Total</div>
        <div className="summaryBar">
          <div className="summaryBarFill" style={{ width: "100%" }} />
        </div>
      </div>

      {/* Success card */}
      <div className="summaryCard success">
        <div className="summaryValue">{success.toLocaleString()}</div>
        <div className="summaryLabel">Success</div>
        <div className="summarySub">{successPct}%</div>
        <div className="summaryBar">
          <div className="summaryBarFill" style={{ width: `${successPct}%` }} />
        </div>
      </div>

      {/* Failed card */}
      <div className="summaryCard failed">
        <div className="summaryValue">{failed.toLocaleString()}</div>
        <div className="summaryLabel">Failed</div>
        <div className="summarySub">{failedPct}%</div>
        <div className="summaryBar">
          <div className="summaryBarFill" style={{ width: `${failedPct}%` }} />
        </div>
      </div>
    </div>
  );
}