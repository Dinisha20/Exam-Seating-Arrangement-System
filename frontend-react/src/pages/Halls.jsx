import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../api.js';
import { useToast } from '../components/Toast.jsx';

export default function Halls({ onDataChanged }) {
  const showToast = useToast();
  const [halls, setHalls] = useState([]);
  const [hallName, setHallName] = useState('');
  const [block, setBlock] = useState('');
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(5);
  const [spb, setSpb] = useState(2);

  const load = async () => setHalls(await apiGet('/halls'));

  useEffect(() => {
    load();
  }, []);

  const addHall = async () => {
    if (!hallName.trim() || !rows || !cols) return showToast('Fill in all required fields', true);
    try {
      await apiPost('/halls', {
        hall_name: hallName.trim(), block: block.trim(),
        rows_count: Number(rows), cols_count: Number(cols), seats_per_bench: Number(spb),
      });
      showToast('Hall added');
      setHallName('');
      setBlock('');
      load();
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to add hall', true);
    }
  };

  const removeHall = async (id) => {
    if (!confirm('Remove this hall and all its benches?')) return;
    try {
      await apiDelete(`/halls/${id}`);
      showToast('Hall removed');
      load();
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to remove hall', true);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <div className="font-semibold text-sm mb-3.5">Add a hall</div>
        <div className="mb-3.5">
          <label className="form-label">Hall name</label>
          <input className="form-input" placeholder="e.g. B426" value={hallName} onChange={(e) => setHallName(e.target.value)} />
        </div>
        <div className="mb-3.5">
          <label className="form-label">Block</label>
          <input className="form-input" placeholder="e.g. B-Workshop" value={block} onChange={(e) => setBlock(e.target.value)} />
        </div>
        <div className="flex gap-2.5 mb-1">
          <div className="flex-1">
            <label className="form-label">Rows</label>
            <input type="number" min="1" className="form-input" value={rows} onChange={(e) => setRows(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="form-label">Benches per row</label>
            <input type="number" min="1" className="form-input" value={cols} onChange={(e) => setCols(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="form-label">Seats per bench</label>
            <input type="number" min="1" max="4" className="form-input" value={spb} onChange={(e) => setSpb(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary mt-2.5" onClick={addHall}>Add hall</button>
      </div>

      <div className="card">
        <div className="font-semibold text-sm mb-3.5 flex items-center gap-2">
          Configured halls <span className="badge bg-primary-light text-primary-dark">{halls.length}</span>
        </div>
        {halls.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No halls yet — add one to the left</div>
        ) : (
          halls.map((h) => (
            <div key={h.hall_id} className="flex justify-between items-center p-3.5 border border-gray-200 rounded-lg mb-2.5">
              <div>
                <div><b>{h.hall_name}</b> <span className="text-gray-400">{h.block}</span></div>
                <div className="text-xs text-gray-500">
                  {h.rows_count} rows &times; {h.cols_count} benches &middot; {h.seats_per_bench} seats/bench &middot; {h.capacity} total seats
                </div>
              </div>
              <button className="btn btn-danger px-2.5 py-1 text-xs" onClick={() => removeHall(h.hall_id)}>Remove</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
