import "../styles.css";

export default function DataTable({ data }) {
  if (!data || !data.length)
    return <p style={{ padding: "20px", color: "#9ca3af", fontSize: 13 }}>
      No data — click a node to load records.
    </p>;

  const columns = Object.keys(data[0]);

  return (
    <div className="tableWrapper">
      <table className="dataTable">
        <thead>
          <tr>
            {columns.map(col => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map((col, idx) => {
                const val = row[col];
                // Render Status column as a badge
                if (col === "Status" || col === "STATUS") {
                  const isSuccess = String(val).toUpperCase() === "SUCCESS";
                  const isFailed  = String(val).toUpperCase() === "FAILED";
                  return (
                    <td key={idx}>
                      <span className={`badge ${isSuccess ? "badge-success" : isFailed ? "badge-failed" : ""}`}>
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: isSuccess ? "#16a34a" : isFailed ? "#dc2626" : "#9ca3af",
                          display: "inline-block", flexShrink: 0,
                        }} />
                        {val}
                      </span>
                    </td>
                  );
                }
                return <td key={idx}>{val}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}