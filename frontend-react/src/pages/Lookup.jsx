import React, { useState } from 'react';
import { apiGet } from '../api.js';
import { useToast } from '../components/Toast.jsx';

export default function Lookup({ currentExamId }) {
  const showToast = useToast();
  const [regNo, setRegNo] = useState('');
  const [seat, setSeat] = useState(null);
  const [error, setError] = useState(null);

  if (!currentExamId) return <div className="alert alert-info">Select or create an exam session first.</div>;

  const doLookup = async () => {
    if (!regNo.trim()) return showToast('Enter a register number', true);
    setError(null);
    setSeat(null);
    try {
      const data = await apiGet(`/seat-lookup/${currentExamId}/${encodeURIComponent(regNo.trim())}`);
      setSeat(data);
    } catch (e) {
      setError(e.error || 'Seat not found');
    }
  };

  return (
    <div className="card max-w-md">
      <div className="font-semibold text-sm mb-3.5">Find your seat</div>
      <div className="mb-1">
        <label className="form-label">Register number</label>
        <input
          className="form-input"
          placeholder="e.g. CSE21CS001"
          value={regNo}
          onChange={(e) => setRegNo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doLookup()}
        />
      </div>
      <button className="btn btn-primary mt-2.5" onClick={doLookup}>Search</button>

      {error && <div className="alert alert-error mt-4">{error}</div>}

      {seat && (
        <div className="mt-4 rounded-xl p-6 text-white bg-gradient-to-br from-primary to-purple-600">
          <div className="text-[11px] uppercase tracking-wide opacity-75">Register number</div>
          <div className="text-xl font-bold mb-3.5">{seat.register_no}</div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-75">Hall</div>
              <div className="font-semibold">{seat.hall_name}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-75">Block</div>
              <div className="font-semibold">{seat.block || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-75">Row / Bench</div>
              <div className="font-semibold">{seat.row_number} / {seat.column_number}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-75">Seat</div>
              <div className="font-semibold">{seat.seat_label}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-75">Class</div>
              <div className="font-semibold">{seat.class_name || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-75">Course code</div>
              <div className="font-semibold">{seat.course_code || '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
