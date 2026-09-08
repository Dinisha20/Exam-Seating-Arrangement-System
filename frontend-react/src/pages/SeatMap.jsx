import React, { useEffect, useState } from 'react';
import { apiGet, exportUrl } from '../api.js';

const PAPER_COLORS = ['#4f46e5', '#0f9d8c', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#db2777'];
function colorFor(paperId, list) {
  const idx = list.indexOf(paperId);
  return PAPER_COLORS[idx % PAPER_COLORS.length];
}

export default function SeatMap({ currentExamId, setView }) {
  const [alloc, setAlloc] = useState(null);
  const [halls, setHalls] = useState([]);

  useEffect(() => {
    if (!currentExamId) return;
    (async () => {
      try {
        const a = await apiGet(`/allocation/${currentExamId}`);
        setAlloc(a);
      } catch {
        setAlloc([]);
      }
      setHalls(await apiGet('/halls'));
    })();
  }, [currentExamId]);

  if (!currentExamId) return <div className="alert alert-info">Select or create an exam session first.</div>;
  if (alloc === null) return null;

  if (alloc.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No seating generated yet for this exam session.
        <div className="mt-3.5">
          <button className="btn btn-primary" onClick={() => setView('generate')}>Go to Generate Seating</button>
        </div>
      </div>
    );
  }

  const paperIds = [...new Set(alloc.map((a) => a.paper_id).filter(Boolean))];

  const byHall = {};
  for (const h of halls) byHall[h.hall_id] = { name: h.hall_name, rows: h.rows_count, cols: h.cols_count, spb: h.seats_per_bench, seatMap: {} };
  for (const a of alloc) {
    if (!byHall[a.hall_id]) continue;
    const key = `${a.row_number}:${a.column_number}`;
    if (!byHall[a.hall_id].seatMap[key]) byHall[a.hall_id].seatMap[key] = {};
    byHall[a.hall_id].seatMap[key][a.seat_label] = a;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3.5 mb-4">
        {paperIds.map((p) => (
          <div key={p} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded" style={{ background: colorFor(p, paperIds) }} />
            {p}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded bg-gray-200" />
          Empty (buffer)
        </div>
      </div>

      {Object.entries(byHall).map(([hallId, h]) => {
        const seatedCount = Object.values(h.seatMap).reduce((s, b) => s + Object.keys(b).length, 0);
        if (seatedCount === 0) return null;
        const labels = h.spb === 1 ? ['A'] : h.spb === 2 ? ['A', 'B'] : Array.from({ length: h.spb }, (_, i) => String.fromCharCode(65 + i));

        return (
          <div key={hallId} className="mb-6">
            <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-2">
              {h.name} <span className="badge bg-primary-light text-primary-dark">{seatedCount} seated</span>
            </h3>
            <div className="overflow-x-auto">
              {Array.from({ length: h.rows }, (_, ri) => ri + 1).map((r) => (
                <div key={r} className="flex gap-2.5 mb-2.5">
                  {Array.from({ length: h.cols }, (_, ci) => ci + 1).map((c) => {
                    const bench = h.seatMap[`${r}:${c}`] || {};
                    return (
                      <div key={c} className="flex rounded-md overflow-hidden border border-gray-200 shrink-0">
                        {labels.map((label) => {
                          const seat = bench[label];
                          return (
                            <div
                              key={label}
                              title={seat ? `${seat.register_no} — ${seat.course_code}` : ''}
                              className="w-11 h-11 flex items-center justify-center text-[10px] font-semibold text-center leading-tight"
                              style={seat ? { background: `${colorFor(seat.paper_id, paperIds)}22`, color: colorFor(seat.paper_id, paperIds), borderRight: '1px solid #e3e5ea' } : { background: '#fafbfc', color: '#9aa0ab', borderRight: '1px solid #e3e5ea' }}
                            >
                              {seat ? seat.register_no.slice(-4) : '—'}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <a className="btn btn-outline inline-block" href={exportUrl(currentExamId)}>Export to Excel</a>
    </div>
  );
}
