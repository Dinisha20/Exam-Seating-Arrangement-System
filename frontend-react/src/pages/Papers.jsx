import React, { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, apiDelete, apiUpload } from '../api.js';
import { useToast } from '../components/Toast.jsx';

export default function Papers({ onDataChanged, currentExamId, exams, setView }) {
  const showToast = useToast();
  const [papers, setPapers] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [allCatalogPapers, setAllCatalogPapers] = useState([]);
  const [showCatalog, setShowCatalog] = useState(false);

  const [paperId, setPaperId] = useState('');
  const [paperName, setPaperName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [dept, setDept] = useState('');
  const [selectedPaper, setSelectedPaper] = useState('');

  // Bulk upload state
  const fileInputRef = useRef(null);
  const [uploadFileObj, setUploadFileObj] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const activeExam = exams?.find((e) => String(e.exam_id) === String(currentExamId));

  const load = async () => {
    if (!currentExamId) {
      setPapers([]);
      setMappings([]);
      return;
    }
    try {
      const data = await apiGet(`/papers?exam_id=${currentExamId}`);
      setPapers(data.papers || []);
      setMappings(data.mappings || []);
      setAllCatalogPapers(data.all_papers || []);
    } catch (e) {
      showToast(e.error || 'Failed to load subjects', true);
    }
  };

  useEffect(() => {
    load();
  }, [currentExamId]);

  if (!currentExamId) {
    return (
      <div className="alert alert-info">
        Please select or create an exam session first (Exam Sessions tab) before adding subjects.
      </div>
    );
  }

  const addPaper = async () => {
    if (!paperId.trim() || !paperName.trim()) return showToast('Enter both a paper ID and name', true);
    try {
      await apiPost(`/papers?exam_id=${currentExamId}`, {
        paper_id: paperId.trim().toUpperCase(),
        paper_name: paperName.trim(),
      });
      showToast('Paper added to this session');
      setPaperId('');
      setPaperName('');
      load();
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to add paper', true);
    }
  };

  const addCatalogPaperToSession = async (catPaper) => {
    try {
      await apiPost(`/papers?exam_id=${currentExamId}`, {
        paper_id: catPaper.paper_id,
        paper_name: catPaper.paper_name,
      });
      showToast(`Subject "${catPaper.paper_name}" added to this session`);
      setShowCatalog(false);
      load();
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to add paper', true);
    }
  };

  const addMapping = async () => {
    if (!courseCode.trim() || !selectedPaper) return showToast('Enter a course code and select a paper', true);
    try {
      await apiPost(`/course-mapping?exam_id=${currentExamId}`, {
        course_code: courseCode.trim().toUpperCase(),
        department: dept.trim().toUpperCase(),
        paper_id: selectedPaper,
      });
      showToast('Course code mapped to paper for this session');
      setCourseCode('');
      setDept('');
      setSelectedPaper('');
      load();
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to add mapping', true);
    }
  };

  const removeMapping = async (code) => {
    try {
      const res = await apiDelete(`/course-mapping/${encodeURIComponent(code)}?exam_id=${currentExamId}`);
      const extraMsg = res.removed_registrations ? ` (${res.removed_registrations} student registration(s) unlinked)` : '';
      showToast(`Mapping "${code}" removed from this session${extraMsg}`);
      load();
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to remove mapping', true);
    }
  };

  const removePaper = async (pId) => {
    try {
      await apiDelete(`/papers/${encodeURIComponent(pId)}?exam_id=${currentExamId}`);
      showToast(`Paper "${pId}" removed from this session`);
      load();
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to remove paper', true);
    }
  };

  const downloadTemplate = () => {
    const csv = 'course_code,department,paper_name\nCS301,CSE,Database Management Systems\nIT305,IT,Database Management Systems\nMA101,CSE,Engineering Mathematics\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'subjects_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const uploadFile = async () => {
    if (!uploadFileObj) return showToast('Select a CSV or Excel file first', true);
    setUploading(true);
    setUploadResult(null);
    try {
      const extraFields = { exam_id: String(currentExamId) };
      const result = await apiUpload('/papers/bulk-upload', uploadFileObj, extraFields);
      setUploadResult(result);
      setUploadFileObj(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
      onDataChanged();
      showToast(`Upload complete — ${result.papers_created} paper(s) created, ${result.mappings_created} mapping(s) linked to this session`);
    } catch (e) {
      showToast(e.error || 'Upload failed', true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Active Session Banner ─────────────────────────────── */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100/80 px-2.5 py-0.5 rounded-full">
              Step 3 of Seating Workflow
            </span>
          </div>
          <div className="text-base font-bold text-gray-900 mt-1">
            Subjects for: {activeExam ? `${activeExam.exam_name} (${activeExam.exam_date} - ${activeExam.session_type})` : `Session #${currentExamId}`}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Subjects created or uploaded here belong <b>exclusively to this exam session</b>.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="badge bg-indigo-600 text-white font-bold px-3 py-1 text-xs shadow-sm">
            {papers.length} Session Subject{papers.length === 1 ? '' : 's'}
          </span>
          <span className="badge bg-teal-600 text-white font-bold px-3 py-1 text-xs shadow-sm">
            {mappings.length} Mapping{mappings.length === 1 ? '' : 's'}
          </span>
          {setView && (
            <button
              onClick={() => setView('upload')}
              className="btn btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1 shadow-sm"
            >
              <span>Next: Upload Students</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Add Paper Card ────────────────────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-sm text-gray-900">1. Add a Subject (Paper)</div>
            {allCatalogPapers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCatalog(!showCatalog)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
              >
                {showCatalog ? 'Close catalog' : '📋 Pick from catalog'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3.5">
            A subject is the actual exam paper (e.g. <i>Database Management Systems</i>). Multiple branches can share the same paper.
          </p>

          {showCatalog && (
            <div className="mb-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-indigo-900">Select an existing subject to add to this session:</div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {allCatalogPapers
                  .filter((cp) => !papers.some((p) => p.paper_id === cp.paper_id))
                  .map((cp) => (
                    <div key={cp.paper_id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-100 text-xs">
                      <div>
                        <span className="font-semibold text-gray-800">{cp.paper_name}</span>{' '}
                        <span className="text-gray-400 font-mono text-[10px]">({cp.paper_id})</span>
                      </div>
                      <button
                        className="btn btn-primary text-[10px] px-2 py-0.5"
                        onClick={() => addCatalogPaperToSession(cp)}
                      >
                        + Add to Session
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="mb-3.5">
            <label className="form-label">Paper ID / Code</label>
            <input
              className="form-input font-mono"
              placeholder="e.g. PAPER_DBMS, CS301_PAPER"
              value={paperId}
              onChange={(e) => setPaperId(e.target.value)}
            />
          </div>
          <div className="mb-3.5">
            <label className="form-label">Subject Name</label>
            <input
              className="form-input"
              placeholder="e.g. Database Management Systems"
              value={paperName}
              onChange={(e) => setPaperName(e.target.value)}
            />
          </div>
          <button className="btn btn-primary w-full text-xs py-2" onClick={addPaper}>
            + Add Subject to this Session
          </button>
        </div>

        {/* ── Add Mapping Card ──────────────────────────────────── */}
        <div className="card">
          <div className="font-semibold text-sm mb-1 text-gray-900">2. Map Course Code to Subject</div>
          <p className="text-xs text-gray-500 mb-3.5">
            Map course codes from your student roll sheets (e.g. CS301, IT305) to a subject in this session.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3.5">
            <div>
              <label className="form-label">Course Code</label>
              <input
                className="form-input font-mono uppercase"
                placeholder="e.g. CS301"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Department</label>
              <input
                className="form-input uppercase"
                placeholder="e.g. CSE, IT, AIDS"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-3.5">
            <label className="form-label">Target Subject in this Session</label>
            <select
              className="form-input text-xs font-medium"
              value={selectedPaper}
              onChange={(e) => setSelectedPaper(e.target.value)}
            >
              <option value="">-- Select a subject in this session --</option>
              {papers.map((p) => (
                <option key={p.paper_id} value={p.paper_id}>
                  {p.paper_name} ({p.paper_id})
                </option>
              ))}
            </select>
            {papers.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                ⚠️ No subjects added for this session yet. Add a subject on the left first.
              </p>
            )}
          </div>
          <button
            className="btn btn-primary w-full text-xs py-2"
            onClick={addMapping}
            disabled={papers.length === 0}
          >
            + Link Course Code to Subject
          </button>
        </div>
      </div>

      {/* ── Bulk Upload Card ──────────────────────────────────── */}
      <div className="card">
        <div className="font-semibold text-sm mb-1 text-gray-900">Bulk Upload Subjects for this Session</div>
        <p className="text-xs text-gray-500 mb-3.5">
          Upload a <code>.xlsx</code>, <code>.xls</code>, or <code>.csv</code> containing columns: <code>course_code</code>, <code>department</code>, <code>paper_name</code>.
          Subjects and mappings will be automatically created and linked to <b>this exam session</b>.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="form-input flex-1 min-w-0 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary-light file:text-primary-dark cursor-pointer text-xs"
            onChange={(e) => { setUploadFileObj(e.target.files[0] || null); setUploadResult(null); }}
          />
          <button className="btn btn-primary shrink-0 text-xs px-4 py-2" onClick={uploadFile} disabled={uploading || !uploadFileObj}>
            {uploading ? 'Uploading…' : 'Upload File to Session'}
          </button>
          <button className="btn shrink-0 border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs px-3 py-2" onClick={downloadTemplate}>
            ⬇ Download Template
          </button>
        </div>

        {uploadResult && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm mt-3">
            <div className="font-bold text-emerald-800 mb-1">Upload Successful for this Session</div>
            <ul className="text-emerald-700 text-xs space-y-0.5">
              <li>📄 Subjects created: <b>{uploadResult.papers_created}</b> | updated: <b>{uploadResult.papers_updated}</b></li>
              <li>🔗 Mappings linked to this session: <b>{uploadResult.mappings_created}</b></li>
            </ul>
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="mt-2 text-xs text-amber-700">
                <div className="font-semibold mb-0.5">Skipped rows:</div>
                {uploadResult.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Papers Table ──────────────────────────────────────── */}
      <div className="card">
        <div className="font-semibold text-sm mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Subjects in this Session</span>
            <span className="badge bg-indigo-50 text-indigo-700 font-bold">{papers.length}</span>
          </div>
        </div>
        {papers.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            No subjects created for this session yet. Add a subject above or use bulk upload.
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50/80 border-b border-gray-200">
                  <th className="py-2.5 px-3">Subject ID</th>
                  <th className="py-2.5 px-3">Subject Name</th>
                  <th className="py-2.5 px-3">Mapped Course Codes</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.paper_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 px-3"><code className="font-mono text-xs font-semibold text-indigo-600">{p.paper_id}</code></td>
                    <td className="py-2.5 px-3 font-medium text-gray-800">{p.paper_name}</td>
                    <td className="py-2.5 px-3">
                      {mappings.filter((m) => m.paper_id === p.paper_id).map((m) => (
                        <span key={m.course_code} className="badge bg-teal-light text-teal mr-1 text-xs">{m.course_code}</span>
                      ))}
                      {mappings.filter((m) => m.paper_id === p.paper_id).length === 0 && (
                        <span className="text-gray-400 text-xs italic">none mapped yet</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded px-2.5 py-1 transition"
                        title="Remove subject from this session"
                        onClick={() => removePaper(p.paper_id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Course Code Mappings Table ────────────────────────── */}
      <div className="card">
        <div className="font-semibold text-sm mb-3.5 flex items-center gap-2">
          <span>Course Code Mappings for this Session</span>
          <span className="badge bg-teal-50 text-teal-700 font-bold">{mappings.length}</span>
        </div>
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            No course code mappings configured for this session yet.
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50/80 border-b border-gray-200">
                  <th className="py-2.5 px-3">Course Code</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Resolved Subject</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.course_code} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 px-3"><code className="font-mono text-xs font-bold text-gray-900">{m.course_code}</code></td>
                    <td className="py-2.5 px-3 text-xs font-medium text-gray-600">{m.department || '—'}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-indigo-700">
                      {(papers.find((p) => p.paper_id === m.paper_id) || allCatalogPapers.find((p) => p.paper_id === m.paper_id) || {}).paper_name || m.paper_id}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded px-2.5 py-1 transition"
                        onClick={() => removeMapping(m.course_code)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
