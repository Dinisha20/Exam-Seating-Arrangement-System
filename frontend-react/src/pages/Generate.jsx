import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api.js';
import { useToast } from '../components/Toast.jsx';

const ADJACENCY_OPTIONS = [
  {
    value: 'bench_only',
    label: 'Bench only',
    description: 'Same paper can\'t share a bench, but may sit at the bench directly beside or behind. Loosest — fits more students per hall.',
  },
  {
    value: 'left_right',
    label: 'Bench + left/right neighbour (recommended)',
    description: 'Same paper can\'t share a bench or sit at the bench immediately left/right in the same row. Matches the standard 2-per-bench exam hall setup.',
  },
  {
    value: 'full_grid',
    label: 'Bench + all neighbours (strictest)',
    description: 'Also keeps same paper apart front-to-back, not just left/right. Tightest anti-cheating enforcement — may need more halls to stay feasible.',
  },
];

export default function Generate({ currentExamId, onDataChanged, setView }) {
  const showToast = useToast();
  const [halls, setHalls] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [adjacencyMode, setAdjacencyMode] = useState('left_right');
  const [suggestion, setSuggestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [candidates, setCandidates] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!currentExamId) return;
    (async () => {
      const h = await apiGet(`/halls?for_exam_id=${currentExamId}`);
      setHalls(h);
      setSelected(new Set(h.filter((x) => !x.locked).map((x) => x.hall_id)));
    })();
  }, [currentExamId]);

  // Fetch an auto-suggested adjacency mode whenever the hall selection
  // changes — a recommendation only, admin still picks the actual mode.
  useEffect(() => {
    if (!currentExamId || selected.size === 0) {
      setSuggestion(null);
      return;
    }
    (async () => {
      try {
        const hallIdsParam = [...selected].join(',');
        const s = await apiGet(`/suggest-adjacency/${currentExamId}?hall_ids=${hallIdsParam}`);
        setSuggestion(s);
      } catch {
        setSuggestion(null);
      }
    })();
  }, [currentExamId, selected]);

  if (!currentExamId) {
    return <div className="alert alert-info">Create an exam session first.</div>;
  }

  const toggle = (id, locked) => {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applySuggestion = () => {
    if (suggestion) setAdjacencyMode(suggestion.suggested_adjacency_mode);
  };

  const generate = async () => {
    if (selected.size === 0) return showToast('Select at least one hall', true);
    setBusy(true);
    setResult(null);
    setCandidates(null);
    try {
      const data = await apiPost(`/generate/${currentExamId}`, {
        hall_ids: [...selected], adjacency_mode: adjacencyMode,
      });
      setResult({ ok: true, data });
      showToast('Seating generated successfully');
      onDataChanged();
    } catch (e) {
      setResult({ ok: false, error: e.error || 'Generation failed', hint: e.hint });
    } finally {
      setBusy(false);
    }
  };

  const generateOptions = async () => {
    if (selected.size === 0) return showToast('Select at least one hall', true);
    setBusy(true);
    setResult(null);
    setCandidates(null);
    try {
      const data = await apiPost(`/generate-preview/${currentExamId}`, {
        hall_ids: [...selected], adjacency_mode: adjacencyMode,
      });
      setCandidates(data.candidates);
      if (data.note) showToast(data.note, false);
    } catch (e) {
      setResult({ ok: false, error: e.error || 'Could not generate options', hint: e.hint });
    } finally {
      setBusy(false);
    }
  };

  const confirmCandidate = async (candidate) => {
    setConfirming(true);
    try {
      const data = await apiPost(`/generate-confirm/${currentExamId}`, { assignments: candidate.assignments });
      setCandidates(null);
      setResult({
        ok: true,
        data: {
          students_seated: data.students_seated, total_seats: candidate.total_seats,
          solver_status: candidate.packed ? 'OPTIMAL (packed)' : 'FEASIBLE (alternative)',
          freed_halls: candidate.freed_halls,
        },
      });
      showToast('Selected arrangement saved');
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to save this arrangement', true);
    } finally {
      setConfirming(false);
    }
  };

  const lockedCount = halls.filter((h) => h.locked).length;

  return (
    <div className="card max-w-2xl">
      <div className="font-semibold text-sm mb-1">Anti-cheating adjacency rule</div>
      <p className="text-xs text-gray-500 mb-3">
        Choose how strictly the solver keeps students writing the same paper apart. Stricter settings
        give stronger anti-malpractice enforcement but need more seats/halls to stay feasible.
      </p>

      {suggestion && (
        <div className="alert alert-info flex items-center justify-between gap-3">
          <span>
            <b>Suggested: {ADJACENCY_OPTIONS.find((o) => o.value === suggestion.suggested_adjacency_mode)?.label.split(' (')[0]}</b>
            {' — '}{suggestion.reason}
          </span>
          {adjacencyMode !== suggestion.suggested_adjacency_mode && (
            <button className="btn btn-outline px-2.5 py-1 text-xs shrink-0" onClick={applySuggestion}>Use suggestion</button>
          )}
        </div>
      )}

      {ADJACENCY_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={`block border rounded-lg p-3 mb-2.5 cursor-pointer transition ${
            adjacencyMode === opt.value ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="adjacencyMode"
              checked={adjacencyMode === opt.value}
              onChange={() => setAdjacencyMode(opt.value)}
            />
            <span className="text-sm font-semibold">{opt.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 ml-5">{opt.description}</p>
        </label>
      ))}

      <div className="font-semibold text-sm mt-5 mb-1">Select halls to use for this session</div>
      {lockedCount > 0 && (
        <div className="alert alert-info">
          {lockedCount} hall{lockedCount > 1 ? 's are' : ' is'} already booked for the other session
          (FN/AN) on this exam's date and can't be selected here — greyed out below.
        </div>
      )}
      {halls.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No halls configured — add halls first</div>
      ) : (
        halls.map((h) => (
          <div key={h.hall_id} className={`flex items-center gap-2 py-2 ${h.locked ? 'opacity-50' : ''}`}>
            <input
              type="checkbox"
              id={`hall_${h.hall_id}`}
              checked={selected.has(h.hall_id)}
              disabled={h.locked}
              onChange={() => toggle(h.hall_id, h.locked)}
            />
            <label htmlFor={`hall_${h.hall_id}`} className="text-sm">
              <b>{h.hall_name}</b> — {h.capacity} seats ({h.rows_count}&times;{h.cols_count}, {h.seats_per_bench}/bench)
              {h.locked && <span className="text-xs text-amber ml-2">({h.locked_reason})</span>}
            </label>
          </div>
        ))
      )}

      <div className="flex gap-2 mt-3.5 flex-wrap items-center">
        <button className="btn btn-primary" disabled={halls.length === 0 || busy} onClick={generate}>
          {busy ? 'Generating…' : 'Generate seating'}
        </button>
        <button className="btn btn-outline" disabled={halls.length === 0 || busy} onClick={generateOptions}>
          {busy ? 'Generating…' : 'Generate multiple options to compare'}
        </button>
        {suggestion && (
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            suggestion.total_students > suggestion.total_seats
              ? 'bg-red-100 text-red-700'
              : suggestion.total_students > suggestion.total_seats * 0.9
              ? 'bg-amber-100 text-amber-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {suggestion.total_students} students / {suggestion.total_seats} seats
            {suggestion.total_students > suggestion.total_seats
              ? ` — ⚠ ${suggestion.total_students - suggestion.total_seats} more seat(s) needed!`
              : ` — ${suggestion.total_seats - suggestion.total_students} seat(s) to spare`}
          </span>
        )}
      </div>


      {candidates && (
        <div className="mt-5">
          <div className="font-semibold text-sm mb-3">
            {candidates.length > 1
              ? `${candidates.length} distinct valid arrangements found — pick one to save`
              : 'Only one distinct arrangement was found — review and confirm'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {candidates.map((c) => (
              <div key={c.candidate_id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge ${c.packed ? 'bg-primary-light text-primary-dark' : 'bg-teal-light text-teal'}`}>
                    {c.packed ? 'Tightly packed' : 'Alternative'}
                  </span>
                </div>
                <div className="text-sm mb-2">
                  <b>{c.students_seated}</b> / {c.total_seats} seats used
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {Object.entries(c.seated_per_hall).map(([hall, count]) => (
                    <div key={hall}>{hall}: {count} seated</div>
                  ))}
                </div>
                {c.freed_halls.length > 0 && (
                  <div className="text-xs text-teal mb-2">Fully free: {c.freed_halls.join(', ')}</div>
                )}
                <button
                  className="btn btn-primary btn-sm w-full mt-1"
                  disabled={confirming}
                  onClick={() => confirmCandidate(c)}
                >
                  {confirming ? 'Saving…' : 'Use this arrangement'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4">
          {result.ok ? (
            <>
              <div className="alert alert-success">
                Seated {result.data.students_seated} students across {result.data.total_seats} available seats
                (solver status: {result.data.solver_status}). No two students writing the same paper share or sit
                adjacent to a bench, per the "{ADJACENCY_OPTIONS.find((o) => o.value === adjacencyMode)?.label}" rule.
              </div>
              {result.data.freed_halls?.length > 0 && (
                <div className="alert alert-info">
                  These halls ended up with zero students seated and can be released for other use:{' '}
                  <b>{result.data.freed_halls.join(', ')}</b>.
                </div>
              )}
              <button className="btn btn-outline" onClick={() => setView('seatmap')}>View seat map</button>
            </>
          ) : (
            <div className="alert alert-error">
              <div className="font-semibold">{result.error}</div>
              {result.hint && result.hint !== result.error && (
                <div className="mt-1 text-sm opacity-90">{result.hint}</div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}