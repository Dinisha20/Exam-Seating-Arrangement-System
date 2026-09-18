import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useToast } from '../components/Toast.jsx';

const API = '/api';

export default function Upload({ currentExamId, exams, onDataChanged, setView }) {
  const showToast = useToast();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [availableSheets, setAvailableSheets] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState(new Set());
  const fileInputRef = useRef(null);

  // Student list state
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  // Selected students for bulk delete
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // Modals / confirmations
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);
  const [showRemoveSelectedModal, setShowRemoveSelectedModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const activeExam = exams?.find((e) => String(e.exam_id) === String(currentExamId));

  const loadStudents = async () => {
    if (!currentExamId) return;
    setLoadingStudents(true);
    try {
      const res = await fetch(`${API}/upload/${currentExamId}/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadStudents();
    setSearchQuery('');
    setDeptFilter('');
    setCurrentPage(1);
    setSelectedStudentIds(new Set());
    setResult(null);
  }, [currentExamId]);

  if (!currentExamId) {
    return (
      <div className="alert alert-info">
        Please select or create an exam session first (using the top bar or Exam Sessions tab), then come back here to upload students.
      </div>
    );
  }

  const reset = () => {
    setPendingFile(null);
    setAvailableSheets(null);
    setSelectedSheets(new Set());
  };

  const inspectFile = async (file) => {
    setBusy(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/upload/${currentExamId}/inspect`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw data;

      if (data.sheets.length === 1) {
        await doImport(file, data.sheets);
      } else {
        setPendingFile(file);
        setAvailableSheets(data.sheets);
        setSelectedSheets(new Set());
      }
    } catch (e) {
      setResult({ ok: false, error: (e && e.detail) || e.error || 'Could not read this file' });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file, sheetNames) => {
    setBusy(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sheets', sheetNames.join(','));
      const res = await fetch(`${API}/upload/${currentExamId}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw data;
      setResult({ ok: true, data });
      showToast(`Upload complete — ${data.imported} student(s) imported`);
      onDataChanged();
      loadStudents();
    } catch (e) {
      setResult({ ok: false, error: (e && e.detail) || e.error || 'Upload failed' });
    } finally {
      setBusy(false);
      reset();
    }
  };

  const toggleSheet = (name) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const confirmImport = () => {
    if (selectedSheets.size === 0) return showToast('Select at least one sheet', true);
    doImport(pendingFile, [...selectedSheets]);
  };

  // Remove ALL students for this session
  const removeAllStudents = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/upload/${currentExamId}/students`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw data;
      showToast(`Removed all ${data.removed || students.length} student registrations for this session`);
      setShowRemoveAllModal(false);
      setStudents([]);
      setSelectedStudentIds(new Set());
      setResult(null);
      onDataChanged();
    } catch (e) {
      showToast((e && e.detail) || e.error || 'Failed to remove students', true);
    } finally {
      setDeleting(false);
    }
  };

  // Remove SELECTED students
  const removeSelectedStudents = async () => {
    if (selectedStudentIds.size === 0) return;
    setDeleting(true);
    try {
      const idsToDelete = Array.from(selectedStudentIds);
      for (const sid of idsToDelete) {
        await fetch(`${API}/upload/${currentExamId}/students/${sid}`, { method: 'DELETE' });
      }
      showToast(`Removed ${idsToDelete.length} selected student(s) from this session`);
      setShowRemoveSelectedModal(false);
      setSelectedStudentIds(new Set());
      loadStudents();
      onDataChanged();
    } catch (e) {
      showToast((e && e.detail) || e.error || 'Failed to remove selected students', true);
    } finally {
      setDeleting(false);
    }
  };

  // Remove single student from this session
  const removeSingleStudent = async (student) => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/upload/${currentExamId}/students/${student.student_id}`, { method: 'DELETE' });
      if (!res.ok) throw await res.json().catch(() => ({}));
      showToast(`Student ${student.register_no} removed from this session`);
      setStudentToDelete(null);
      setStudents((prev) => prev.filter((s) => s.student_id !== student.student_id));
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(student.student_id);
        return next;
      });
      onDataChanged();
    } catch (e) {
      showToast((e && e.detail) || e.error || 'Failed to remove student', true);
    } finally {
      setDeleting(false);
    }
  };

  // Multi-select toggle
  const toggleSelectStudent = (id) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.student_id)));
    }
  };

  // Filtered & Paginated students
  const departments = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.department && s.department !== '—') set.add(s.department);
    });
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.register_no.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.course_code.toLowerCase().includes(q) ||
        s.paper_name.toLowerCase().includes(q) ||
        s.class_name.toLowerCase().includes(q);
      const matchDept = !deptFilter || s.department === deptFilter;
      return matchSearch && matchDept;
    });
  }, [students, searchQuery, deptFilter]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

  return (
    <div className="space-y-6">
      {/* ── Active Session Banner ─────────────────────────────── */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100/80 px-2.5 py-0.5 rounded-full">
              Step 4 of Seating Workflow
            </span>
          </div>
          <div className="text-base font-bold text-gray-900 mt-1">
            Students for: {activeExam ? `${activeExam.exam_name} (${activeExam.exam_date} - ${activeExam.session_type})` : `Session #${currentExamId}`}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Uploaded students and allocations belong <b>exclusively to this exam session</b>.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="badge bg-indigo-600 text-white font-bold px-3 py-1 text-xs shadow-sm">
            {students.length} Student{students.length === 1 ? '' : 's'} Registered
          </span>
          {students.length > 0 && setView && (
            <button
              onClick={() => setView('generate')}
              className="btn btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1 shadow-sm"
            >
              <span>Next: Generate Seating</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Upload Card ───────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <div className="font-semibold text-sm text-gray-900">Upload Hall Plan Excel</div>
          {students.length > 0 && (
            <button
              className="btn btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-sm"
              onClick={() => setShowRemoveAllModal(true)}
              disabled={deleting}
            >
              🗑 Clear Uploaded Students ({students.length})
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3.5">
          Accepts COE hall plan spreadsheets (columns: Year, Class, Course Code, Register Nos., etc.).
          Register number ranges like "001 - 015, 020 - 025" are expanded automatically.
        </p>

        {availableSheets ? (
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
            <div className="text-sm font-semibold mb-1">This file has {availableSheets.length} sheets</div>
            <p className="text-xs text-gray-500 mb-3">
              Select only the sheet(s) that belong to <b>this</b> exam session — the others will not be imported.
            </p>
            {availableSheets.map((name) => (
              <div key={name} className="flex items-center gap-2 py-1.5">
                <input
                  type="checkbox"
                  id={`sheet_${name}`}
                  checked={selectedSheets.has(name)}
                  onChange={() => toggleSheet(name)}
                />
                <label htmlFor={`sheet_${name}`} className="text-sm cursor-pointer font-medium text-gray-700">{name}</label>
              </div>
            ))}
            <div className="flex gap-2 mt-3.5">
              <button className="btn btn-primary text-xs px-4 py-2" disabled={busy} onClick={confirmImport}>
                {busy ? 'Importing…' : 'Import Selected Sheet(s)'}
              </button>
              <button className="btn btn-outline text-xs px-3.5 py-2" disabled={busy} onClick={reset}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              dragging ? 'border-primary bg-primary/10' : 'border-gray-200 bg-gray-50 hover:border-primary'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length) inspectFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="text-gray-700 text-sm font-semibold">
              {busy ? 'Reading Excel file…' : 'Drag & drop your Excel file (.xlsx, .xls) here, or click to browse'}
            </div>
            <div className="text-xs text-gray-400 mt-1">Accepts COE Hall Plan format</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files.length && inspectFile(e.target.files[0])}
            />
          </div>
        )}

        {result && (
          <div className="mt-4">
            {result.ok ? (
              <div className="space-y-2">
                <div className="alert alert-success">
                  Successfully imported {result.data.imported} of {result.data.total_parsed} parsed student(s) for this exam session.
                </div>
                {result.data.unmapped_course_codes?.length > 0 && (
                  <div className="alert alert-error">
                    These course codes have no paper mapping in this session, so their students were skipped:{' '}
                    <b>{result.data.unmapped_course_codes.join(', ')}</b>. Add mappings on the Papers &amp; Mapping tab, then re-upload.
                  </div>
                )}
                {result.data.parse_errors?.length > 0 && (
                  <div className="alert alert-info">
                    {result.data.parse_errors.length} row(s) could not be parsed (see browser console for details).
                  </div>
                )}
              </div>
            ) : (
              <div className="alert alert-error">{result.error}</div>
            )}
          </div>
        )}
      </div>

      {/* ── Registered Students Table Section ────────────────── */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900">Students Registered for this Session</span>
            <span className="badge bg-indigo-50 text-indigo-700 font-bold">
              {students.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedStudentIds.size > 0 && (
              <button
                className="btn text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-medium transition"
                onClick={() => setShowRemoveSelectedModal(true)}
                disabled={deleting}
              >
                🗑 Remove Selected ({selectedStudentIds.size})
              </button>
            )}
            {students.length > 0 && (
              <button
                className="btn btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-sm"
                onClick={() => setShowRemoveAllModal(true)}
                disabled={deleting}
              >
                🗑 Remove All Students
              </button>
            )}
          </div>
        </div>

        {students.length > 0 ? (
          <div>
            {/* Search and Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  className="form-input text-xs"
                  placeholder="Search by register no, name, class, subject..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </div>

              {departments.length > 1 && (
                <div className="w-44">
                  <select
                    className="form-input text-xs"
                    value={deptFilter}
                    onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {(searchQuery || deptFilter) && (
                <button
                  className="text-xs text-gray-500 hover:text-gray-800 underline"
                  onClick={() => { setSearchQuery(''); setDeptFilter(''); setCurrentPage(1); }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50/80 border-b border-gray-200">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
                        onChange={toggleSelectAll}
                        title="Select/Deselect All Filtered"
                      />
                    </th>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Register No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Class / Year</th>
                    <th className="py-2.5 px-3">Course Code</th>
                    <th className="py-2.5 px-3">Subject / Paper</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-400 text-xs">
                        No students match your search filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((s, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      const isSelected = selectedStudentIds.has(s.student_id);
                      return (
                        <tr key={s.student_id} className={`border-b border-gray-100 hover:bg-gray-50/50 transition ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectStudent(s.student_id)}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-400">{rowNum}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-xs text-indigo-700">
                            {s.register_no}
                          </td>
                          <td className="py-2.5 px-3 text-xs font-medium text-gray-800">
                            {s.name || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-600">
                            {s.class_name || '—'} {s.year ? `(${s.year})` : ''}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="badge bg-teal-light text-teal text-xs font-semibold">
                              {s.course_code}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-700">
                            {s.paper_name || s.course_code}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded px-2.5 py-1 transition font-medium"
                              title="Remove student from this session"
                              onClick={() => setStudentToDelete(s)}
                              disabled={deleting}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <div>
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="btn px-2.5 py-1 text-xs border border-gray-200 disabled:opacity-40"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="px-2 font-medium text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="btn px-2.5 py-1 text-xs border border-gray-200 disabled:opacity-40"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400 text-xs flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mb-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            {loadingStudents ? 'Loading registered students…' : 'No students uploaded for this exam session yet. Upload a COE Excel file above.'}
          </div>
        )}
      </div>

      {/* ── Modal: Remove All Students Confirmation ────────────── */}
      {showRemoveAllModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="font-bold text-base text-gray-900">Remove All Uploaded Students?</div>
            <p className="text-xs text-gray-600 leading-relaxed">
              This will remove all <b>{students.length}</b> student registration(s) for session{' '}
              <b>{activeExam?.exam_name || `#${currentExamId}`}</b>.
              Any generated seat allocations for this session will also be cleared.
            </p>
            <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-medium">
              ⚠️ You will be able to upload a fresh Excel file for this session after removal.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                className="btn border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-3.5 py-2"
                onClick={() => setShowRemoveAllModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger text-xs px-4 py-2"
                onClick={removeAllStudents}
                disabled={deleting}
              >
                {deleting ? 'Removing…' : 'Yes, Remove All Students'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Remove Selected Students Confirmation ───────── */}
      {showRemoveSelectedModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="font-bold text-base text-gray-900">Remove Selected Students?</div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to remove <b>{selectedStudentIds.size}</b> selected student(s) from this exam session?
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                className="btn border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-3.5 py-2"
                onClick={() => setShowRemoveSelectedModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger text-xs px-4 py-2"
                onClick={removeSelectedStudents}
                disabled={deleting}
              >
                {deleting ? 'Removing…' : `Remove ${selectedStudentIds.size} Students`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Remove Single Student Confirmation ─────────── */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="font-bold text-base text-gray-900">Remove Student?</div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to remove student <b className="font-mono text-indigo-600">{studentToDelete.register_no}</b>{' '}
              ({studentToDelete.name || studentToDelete.course_code}) from this exam session?
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                className="btn border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-3.5 py-2"
                onClick={() => setStudentToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger text-xs px-4 py-2"
                onClick={() => removeSingleStudent(studentToDelete)}
                disabled={deleting}
              >
                {deleting ? 'Removing…' : 'Remove Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
