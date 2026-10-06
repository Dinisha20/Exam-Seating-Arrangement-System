import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api.js';
import { useToast } from '../components/Toast.jsx';

const ADJACENCY_OPTIONS = [
  {
    value: 'bench_only',
    label: 'Bench only',
    description: "Same paper can't share a bench, but may sit at the bench directly beside or behind. Loosest — fits more students per hall.",
  },
  {
    value: 'left_right',
    label: 'Bench + left/right neighbour (recommended)',
    description: "Same paper can't share a bench or sit at the bench immediately left/right in the same row. Matches the standard 2-per-bench exam hall setup.",
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
  // Hall selector is hidden by default — only shown when user clicks "Halls Unavailable?"
  const [showHallSelector, setShowHallSelector] = useState(false);

  useEffect(() => {
    if (!currentExamId) return;
    setResult(null);
    setCandidates(null);
    setShowHallSelector(false);
    (async () => {
      try {
        const h = await apiGet(`/halls?for_exam_id=${currentExamId}`);
        setHalls(h);
        // Auto-select all non-locked halls
        setSelected(new Set(h.filter((x) => !x.locked).map((x) => x.hall_id)));
      } catch {
        setHalls([]);
      }
    })();
  }, [currentExamId]);

  // Auto-suggest adjacency whenever hall selection changes
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
    if (selected.size === 0) return showToast('No halls available — mark halls as unavailable to deselect some, or add halls first', true);
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
    if (selected.size === 0) return showToast('No halls available — mark halls as unavailable to deselect some, or add halls first', true);
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
  const availableHalls = halls.filter((h) => !h.locked);
  const deselectedCount = availableHalls.filter((h) => !selected.has(h.hall_id)).length;

  return (
    <div className="card max-w-2xl">

      {/* ── Adjacency Rule ─────────────────────────────────── */}
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

      {/* ── Hall Status Summary + Unavailable Toggle ───────── */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {/* Seat capacity pill */}
        {suggestion && (
          <span className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
            suggestion.total_students > suggestion.total_seats
              ? 'bg-red-50 text-red-700 border-red-200'
              : suggestion.total_students > suggestion.total_seats * 0.9
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            🪑 {suggestion.total_students} students / {suggestion.total_seats} seats
            {suggestion.total_students > suggestion.total_seats
              ? ` — ⚠ ${suggestion.total_students - suggestion.total_seats} more seat(s) needed!`
              : ` — ${suggestion.total_seats - suggestion.total_students} spare`}
          </span>
        )}

        {/* Halls pill */}
        <span className="text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200">
          🏫 {selected.size} hall{selected.size !== 1 ? 's' : ''} in use
          {deselectedCount > 0 && <span className="ml-1 text-amber-600">({deselectedCount} excluded)</span>}
          {lockedCount > 0 && <span className="ml-1 text-gray-400">· {lockedCount} locked</span>}
        </span>

        {/* Halls Unavailable toggle button */}
        {halls.length > 0 && (
          <button
            className={`btn text-xs px-3.5 py-1.5 flex items-center gap-1.5 border transition ${
              showHallSelector
                ? 'bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200'
                : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
            }`}
            onClick={() => setShowHallSelector((v) => !v)}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {showHallSelector ? 'Hide Halls' : 'Halls Unavailable?'}
          </button>
        )}
      </div>

      {/* ── Collapsible Hall Selector ──────────────────────── */}
      {showHallSelector && (
        <div className="mt-3 border border-amber-200 rounded-xl p-4 bg-amber-50/40 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-sm font-semibold text-amber-800">Mark halls unavailable for this session</div>
              <p className="text-xs text-gray-500 mt-0.5">
                Uncheck any hall that cannot be used. Locked halls (used by sibling FN/AN session) are greyed out.
              </p>
            </div>
          </div>

          {lockedCount > 0 && (
            <div className="alert alert-info text-xs py-2">
              {lockedCount} hall{lockedCount > 1 ? 's are' : ' is'} locked — already booked for the other session (FN/AN) on this date.
            </div>
          )}

          {halls.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">No halls configured — add halls first</div>
          ) : (
            halls.map((h) => (
              <div
                key={h.hall_id}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition cursor-pointer ${
                  h.locked
                    ? 'opacity-50 bg-gray-50 border-gray-200 cursor-not-allowed'
                    : selected.has(h.hall_id)
                    ? 'bg-white border-green-200 hover:border-green-300'
                    : 'bg-red-50/50 border-red-200 hover:border-red-300'
                }`}
                onClick={() => toggle(h.hall_id, h.locked)}
              >
                <input
                  type="checkbox"
                  id={`hall_${h.hall_id}`}
                  checked={selected.has(h.hall_id)}
                  disabled={h.locked}
                  onChange={() => toggle(h.hall_id, h.locked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <label htmlFor={`hall_${h.hall_id}`} className="text-sm flex-1 cursor-pointer">
                  <b>{h.hall_name}</b>
                  <span className="text-gray-500 ml-2">
                    — {h.capacity} seats ({h.rows_count}×{h.cols_count}, {h.seats_per_bench}/bench)
                  </span>
                  {h.locked && <span className="text-xs text-amber-600 ml-2">({h.locked_reason})</span>}
                </label>
                {!h.locked && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    selected.has(h.hall_id) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {selected.has(h.hall_id) ? 'In use' : 'Excluded'}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Generate Buttons ───────────────────────────────── */}
      <div className="flex gap-2 mt-5 flex-wrap items-center">
        <button
          className="btn btn-primary"
          disabled={halls.length === 0 || busy || selected.size === 0}
          onClick={generate}
        >
          {busy ? 'Generating…' : 'Generate seating'}
        </button>
        <button
          className="btn btn-outline"
          disabled={halls.length === 0 || busy || selected.size === 0}
          onClick={generateOptions}
        >
          {busy ? 'Generating…' : 'Generate multiple options to compare'}
        </button>
        {halls.length === 0 && (
          <span className="text-xs text-red-600">No halls configured — add halls first</span>
        )}
        {halls.length > 0 && selected.size === 0 && (
          <span className="text-xs text-red-600">All halls excluded — re-enable at least one above</span>
        )}
      </div>

      {/* ── Candidates (multiple options) ─────────────────── */}
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

      {/* ── Result ─────────────────────────────────────────── */}
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