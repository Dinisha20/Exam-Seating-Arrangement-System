import React, { useState } from 'react';
import { apiPost, apiPut, apiDelete } from '../api.js';
import { useToast } from '../components/Toast.jsx';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function TimePicker({ label, hour, minute, period, onHour, onMinute, onPeriod }) {
  return (
    <div className="flex-1">
      <label className="form-label">{label}</label>
      <div className="flex gap-1">
        <select className="form-input px-1.5" value={hour} onChange={(e) => onHour(e.target.value)}>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select className="form-input px-1.5" value={minute} onChange={(e) => onMinute(e.target.value)}>
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="form-input px-1.5" value={period} onChange={(e) => onPeriod(e.target.value)}>
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

export default function Exams({ exams, onDataChanged }) {
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
        await apiPost('/exams', {
          exam_name: examName.trim(),
          exam_date: examDate,
          session_type: sessionType,
          exam_time: buildTime(),
        });
        showToast('Exam session created');
        resetForm();
        onDataChanged();
      }
    } catch (e) {
      showToast(e.error || (editingExamId ? 'Failed to update session' : 'Failed to create session'), true);
    }
  };

  const deleteExam = async (exam) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${exam.exam_name}"?\n\nThis will also remove any student registrations and seating allocations associated with this exam.`
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={`card ${editingExamId ? 'border-primary/50 shadow-md ring-1 ring-primary/20' : ''}`}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="font-semibold text-sm">
            {editingExamId ? 'Edit exam session' : 'Create an exam session'}
          </div>
          {editingExamId && (
            <span className="badge bg-primary-light text-primary-dark">Editing ID #{editingExamId}</span>
          )}
        </div>

        <div className="mb-3.5">
          <label className="form-label">Exam name</label>
          <input
            className="form-input"
            placeholder="e.g. CAT-I"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
          />
        </div>
        <div className="flex gap-2.5 mb-3.5">
          <div className="flex-1">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="form-label">Session</label>
            <select className="form-input" value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
              <option value="FN">Forenoon (FN)</option>
              <option value="AN">Afternoon (AN)</option>
            </select>
          </div>
        </div>
        <div className="mb-1">
          <label className="form-label">Timing</label>
          <div className="flex gap-2.5 items-end">
            <TimePicker
              label="Start"
              hour={startHour} minute={startMin} period={startPeriod}
              onHour={setStartHour} onMinute={setStartMin} onPeriod={setStartPeriod}
            />
            <span className="text-gray-400 text-sm pb-2">to</span>
            <TimePicker
              label="End"
              hour={endHour} minute={endMin} period={endPeriod}
              onHour={setEndHour} onMinute={setEndMin} onPeriod={setEndPeriod}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Optional - recorded for reference and hall-allocation reports. Hall double-booking is still
            checked by date + FN/AN session regardless of this field.
          </p>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button className="btn btn-primary" onClick={saveExam}>
            {editingExamId ? 'Save changes' : 'Create session'}
          </button>
          {editingExamId && (
            <button
              className="btn border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs px-3.5 py-2"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="font-semibold text-sm mb-3.5 flex items-center gap-2">
          Exam sessions <span className="badge bg-primary-light text-primary-dark">{exams.length}</span>
        </div>
        {exams.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No exam sessions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="py-2 px-2">Name</th>
                  <th className="py-2 px-2">Date</th>
                  <th className="py-2 px-2">Session</th>
                  <th className="py-2 px-2">Timing</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => {
                  const isEditing = editingExamId === e.exam_id;
                  return (
                    <tr
                      key={e.exam_id}
                      className={`border-b border-gray-100 last:border-0 transition ${
                        isEditing ? 'bg-primary-light/40 font-medium' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      <td className="py-2 px-2"><b>{e.exam_name}</b></td>
                      <td className="py-2 px-2">{e.exam_date || '-'}</td>
                      <td className="py-2 px-2"><span className="badge bg-teal-light text-teal">{e.session_type}</span></td>
                      <td className="py-2 px-2 text-gray-500">{e.exam_time || '-'}</td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <button
                          className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-2.5 py-1 text-xs mr-1.5"
                          onClick={() => startEdit(e)}
                          title="Edit this exam session"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger px-2.5 py-1 text-xs"
                          onClick={() => deleteExam(e)}
                          title="Delete this exam session"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
