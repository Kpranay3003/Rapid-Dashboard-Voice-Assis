import { useState } from "react";

export default function Pagination({
  currentPage, totalPages, rowsPerPage,
  setCurrentPage, setRowsPerPage, totalData, startIndex,
}) {
  const [goToPage, setGoToPage] = useState("");

  const getPageNumbers = () => {
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end   = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const end = Math.min(startIndex + rowsPerPage, totalData);

  return (
    <div className="pagination">
      <span className="paginationInfo">
        Showing {totalData === 0 ? 0 : startIndex + 1} – {end} of {totalData} records
      </span>

      <div className="paginationControls">
        {/* First */}
        <button className="pageBtn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>⏮</button>
        {/* Prev */}
        <button className="pageBtn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>◀</button>

        {/* Page numbers */}
        {getPageNumbers().map(p => (
          <button
            key={p}
            className={`pageNumberBtn ${p === currentPage ? "active" : ""}`}
            onClick={() => setCurrentPage(p)}
          >{p}</button>
        ))}

        {/* Next */}
        <button className="pageBtn" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}>▶</button>
        {/* Last */}
        <button className="pageBtn" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(totalPages)}>⏭</button>

        {/* Go to page */}
        <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>Go to</span>
        <input
          type="number"
          className="goToInput"
          placeholder="page"
          value={goToPage}
          onChange={e => setGoToPage(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              const p = Number(goToPage);
              if (p >= 1 && p <= totalPages) setCurrentPage(p);
              setGoToPage("");
            }
          }}
        />

        {/* Rows per page */}
        <select
          className="pageSize"
          value={rowsPerPage}
          onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>
    </div>
  );
}