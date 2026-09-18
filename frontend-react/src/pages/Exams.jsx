import React, { useState } from 'react';
import { apiPost, apiPut, apiDelete } from '../api.js';
import { useToast } from '../components/Toast.jsx';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function TimePicker({ label, hour, minute, period, onHour, onMinute, onPeriod }) {
  return (
    <div className="flex-1">
      <label className="form-label text-xs">{label}</label>
      <div className="flex gap-1">
        <select className="form-input px-1.5 text-xs" value={hour} onChange={(e) => onHour(e.target.value)}>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select className="form-input px-1.5 text-xs" value={minute} onChange={(e) => onMinute(e.target.value)}>
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="form-input px-1.5 text-xs" value={period} onChange={(e) => onPeriod(e.target.value)}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

function parseTime(timeStr) {
  const def = {
    startHour: '09', startMin: '30', startPeriod: 'AM',
    endHour: '12', endMin: '30', endPeriod: 'PM',
  };
  if (!timeStr) return def;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    return {
      startHour: match[1].padStart(2, '0'),
      startMin: match[2],
      startPeriod: match[3].toUpperCase(),
      endHour: match[4].padStart(2, '0'),
      endMin: match[5],
      endPeriod: match[6].toUpperCase(),
    };
  }
  return def;
}

export default function Exams({ exams, currentExamId, setCurrentExamId, onDataChanged, setView }) {
  const showToast = useToast();
  const [editingExamId, setEditingExamId] = useState(null);
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [sessionType, setSessionType] = useState('FN');

  const [startHour, setStartHour] = useState('09');
  const [startMin, setStartMin] = useState('30');
  const [startPeriod, setStartPeriod] = useState('AM');
  const [endHour, setEndHour] = useState('12');
  const [endMin, setEndMin] = useState('30');
  const [endPeriod, setEndPeriod] = useState('PM');

  const buildTime = () =>
    `${startHour}:${startMin} ${startPeriod} - ${endHour}:${endMin} ${endPeriod}`;

  const resetForm = () => {
    setEditingExamId(null);
    setExamName('');
    setExamDate('');
    setSessionType('FN');
    setStartHour('09');
    setStartMin('30');
    setStartPeriod('AM');
    setEndHour('12');
    setEndMin('30');
    setEndPeriod('PM');
  };

  const startEdit = (exam) => {
    setEditingExamId(exam.exam_id);
    setExamName(exam.exam_name || '');
    setExamDate(exam.exam_date || '');
    setSessionType(exam.session_type || 'FN');
    const parsed = parseTime(exam.exam_time);
    setStartHour(parsed.startHour);
    setStartMin(parsed.startMin);
    setStartPeriod(parsed.startPeriod);
    setEndHour(parsed.endHour);
    setEndMin(parsed.endMin);
    setEndPeriod(parsed.endPeriod);
  };

  const cancelEdit = () => {
    resetForm();
  };

  const saveExam = async () => {
    if (!examName.trim()) return showToast('Enter an exam name', true);
    try {
      if (editingExamId) {
        await apiPut(`/exams/${editingExamId}`, {
          exam_name: examName.trim(),
          exam_date: examDate,
          session_type: sessionType,
          exam_time: buildTime(),
        });
        showToast('Exam session updated');
        resetForm();
        onDataChanged();
      } else {
        const res = await apiPost('/exams', {
          exam_name: examName.trim(),
          exam_date: examDate,
          session_type: sessionType,
          exam_time: buildTime(),
        });
        showToast('Exam session created');
        if (res && res.exam_id && setCurrentExamId) {
          setCurrentExamId(String(res.exam_id));
        }
        resetForm();
        onDataChanged();
      }
    } catch (e) {
      showToast(e.error || (editingExamId ? 'Failed to update session' : 'Failed to create session'), true);
    }
  };

  const deleteExam = async (exam) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${exam.exam_name}" (${exam.exam_date} - ${exam.session_type})?\n\nThis will remove this exam session and any student registrations and seating allocations associated with it.`
    );
    if (!confirmed) return;

    try {
      await apiDelete(`/exams/${exam.exam_id}`);
      showToast('Exam session deleted');
      if (editingExamId === exam.exam_id) {
        resetForm();
      }
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to delete session', true);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Workflow Banner ───────────────────────────────────── */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100/80 px-2.5 py-0.5 rounded-full">
                Step 1 of Seating Workflow
              </span>
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">Exam Sessions Management</div>
            <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
              Create and select the exam session you want to arrange seating for. Each session holds its own independent subjects, students, and seating allocations.
            </p>
          </div>
          {currentExamId && setView && (
            <button
              onClick={() => setView('halls')}
              className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shrink-0 shadow-md shadow-indigo-500/20"
            >
              <span>Next: Setup Halls & Benches</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left Column: Create/Edit Form ───────────────────── */}
        <div className="lg:col-span-5">
          <div className={`card ${editingExamId ? 'border-indigo-400 shadow-lg ring-2 ring-indigo-200' : ''}`}>
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-gray-100">
              <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                {editingExamId ? 'Edit Exam Session' : 'Create New Exam Session'}
              </div>
              {editingExamId && (
                <span className="badge bg-indigo-100 text-indigo-700 text-xs font-semibold">Editing #{editingExamId}</span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">Exam Name / Title</label>
                <input
                  className="form-input"
                  placeholder="e.g. CAT-1, End Semester Exam, Model Exam"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input text-xs" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Session Slot</label>
                  <select className="form-input text-xs font-medium" value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
                    <option value="FN">Forenoon (FN)</option>
                    <option value="AN">Afternoon (AN)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Timing Range</label>
                <div className="flex gap-2 items-end bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <TimePicker
                    label="Start Time"
                    hour={startHour} minute={startMin} period={startPeriod}
                    onHour={setStartHour} onMinute={setStartMin} onPeriod={setStartPeriod}
                  />
                  <span className="text-gray-400 text-xs font-semibold pb-2">TO</span>
                  <TimePicker
                    label="End Time"
                    hour={endHour} minute={endMin} period={endPeriod}
                    onHour={setEndHour} onMinute={setEndMin} onPeriod={setEndPeriod}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                  Recorded for hall plans and export sheets. Hall conflicts are automatically guarded by date + FN/AN session.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button className="btn btn-primary flex-1 text-xs py-2.5 font-semibold" onClick={saveExam}>
                  {editingExamId ? 'Save Changes' : 'Create Exam Session'}
                </button>
                {editingExamId && (
                  <button
                    className="btn border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs px-4 py-2.5"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Sessions List ─────────────────────── */}
        <div className="lg:col-span-7">
          <div className="card h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-gray-100">
              <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <span>Configured Exam Sessions</span>
                <span className="badge bg-indigo-50 text-indigo-700 font-bold">{exams.length}</span>
              </div>
              <span className="text-xs text-gray-400">Click a session to make it active</span>
            </div>

            {exams.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm flex flex-col items-center justify-center flex-1">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="font-semibold text-gray-600">No exam sessions yet</div>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  Create your first exam session using the form on the left to start setting up seating arrangements.
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {exams.map((e) => {
                  const isActive = String(e.exam_id) === String(currentExamId);
                  const isEditing = editingExamId === e.exam_id;
                  return (
                    <div
                      key={e.exam_id}
                      className={`p-4 rounded-xl border transition-all duration-150 ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-300'
                          : 'border-gray-200 hover:border-indigo-200 bg-white hover:bg-gray-50/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900">{e.exam_name}</span>
                            {isActive ? (
                              <span className="badge bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                ACTIVE SESSION
                              </span>
                            ) : (
                              <button
                                onClick={() => setCurrentExamId && setCurrentExamId(String(e.exam_id))}
                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 transition"
                                title="Switch to this exam session"
                              >
                                Set as Active
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 pt-1">
                            <span className="flex items-center gap-1 font-medium">
                              📅 {e.exam_date || 'No date set'}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className={`badge text-[10px] font-bold ${
                              e.session_type === 'FN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {e.session_type === 'FN' ? 'Forenoon (FN)' : 'Afternoon (AN)'}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-500 text-[11px]">
                              ⏰ {e.exam_time || '—'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            className="btn border border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-white text-xs px-2.5 py-1"
                            onClick={() => startEdit(e)}
                            title="Edit this session"
                          >
                            Edit
                          </button>
                          <button
                            className="btn text-red-600 hover:text-red-800 hover:bg-red-50 text-xs px-2.5 py-1 border border-red-200"
                            onClick={() => deleteExam(e)}
                            title="Delete this session"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
