import React, { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, apiDelete, apiUpload } from '../api.js';
import { useToast } from '../components/Toast.jsx';


export default function Papers({ onDataChanged }) {
  const showToast = useToast();
  const [papers, setPapers] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [paperId, setPaperId] = useState('');
  const [paperName, setPaperName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [dept, setDept] = useState('');
  const [selectedPaper, setSelectedPaper] = useState('');

  // Bulk upload state
  const fileInputRef = useRef(null);
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const load = async () => {
    const data = await apiGet('/papers');
    setPapers(data.papers);
    setMappings(data.mappings);
  };

  useEffect(() => {
    load();
  }, []);

  const addPaper = async () => {
    if (!paperId.trim() || !paperName.trim()) return showToast('Enter both a paper ID and name', true);
    try {
      await apiPost('/papers', { paper_id: paperId.trim(), paper_name: paperName.trim() });
      showToast('Paper added');
      setPaperId('');
      setPaperName('');
      load();
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to add paper', true);
    }
  };

  const addMapping = async () => {
    if (!courseCode.trim() || !selectedPaper) return showToast('Enter a course code and select a paper', true);
    try {
      await apiPost('/course-mapping', { course_code: courseCode.trim(), department: dept.trim(), paper_id: selectedPaper });
      showToast('Mapping added');
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
      await apiDelete(`/course-mapping/${encodeURIComponent(code)}`);
      showToast('Mapping removed');
      load();
      onDataChanged();
    } catch (e) {
      showToast(e.error || 'Failed to remove', true);
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

  const uploadCSV = async () => {
    if (!csvFile) return showToast('Select a CSV file first', true);
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await apiUpload('/papers/bulk-upload', csvFile);
      setUploadResult(result);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
      onDataChanged();
      showToast(`Done — ${result.papers_created} paper(s) created, ${result.mappings_created} mapping(s) added`);
    } catch (e) {
      showToast(e.error || 'Upload failed', true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-semibold text-sm mb-1">Add a paper</div>
          <p className="text-xs text-gray-500 mb-3.5">
            A paper is the actual exam subject. Different departments may use different course codes for
            the same paper — map them all to one paper below.
          </p>
          <div className="mb-3.5">
            <label className="form-label">Paper ID</label>
            <input className="form-input" placeholder="e.g. PAPER_DBMS" value={paperId} onChange={(e) => setPaperId(e.target.value)} />
          </div>
          <div className="mb-3.5">
            <label className="form-label">Paper name</label>
            <input className="form-input" placeholder="e.g. Database Management Systems" value={paperName} onChange={(e) => setPaperName(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={addPaper}>Add paper</button>
        </div>

        <div className="card">
          <div className="font-semibold text-sm mb-1">Map a course code to a paper</div>
          <p className="text-xs text-gray-500 mb-3.5">
            Every course code used during import must resolve to a paper before seating can be generated.
          </p>
          <div className="mb-3.5">
            <label className="form-label">Course code</label>
            <input className="form-input" placeholder="e.g. CS301" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
          </div>
          <div className="mb-3.5">
            <label className="form-label">Department</label>
            <input className="form-input" placeholder="e.g. CSE" value={dept} onChange={(e) => setDept(e.target.value)} />
          </div>
          <div className="mb-3.5">
            <label className="form-label">Paper</label>
            <select className="form-input" value={selectedPaper} onChange={(e) => setSelectedPaper(e.target.value)}>
              <option value="">Select a paper…</option>
              {papers.map((p) => (
                <option key={p.paper_id} value={p.paper_id}>{p.paper_name} ({p.paper_id})</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={addMapping}>Add mapping</button>
        </div>
      </div>

      {/* ── Bulk upload card ───────────────────────────── */}
      <div className="card mt-6">
        <div className="font-semibold text-sm mb-1">Bulk upload subjects via CSV</div>
        <p className="text-xs text-gray-500 mb-3.5">
          Upload a CSV with columns <code>course_code</code>, <code>department</code>, <code>paper_name</code>.
          Papers with the same name are automatically merged into one. Existing entries are updated, not duplicated.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="form-input flex-1 min-w-0 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary-light file:text-primary-dark cursor-pointer"
            onChange={(e) => { setCsvFile(e.target.files[0] || null); setUploadResult(null); }}
          />
          <button className="btn btn-primary shrink-0" onClick={uploadCSV} disabled={uploading || !csvFile}>
            {uploading ? 'Uploading…' : 'Upload CSV'}
          </button>
          <button className="btn shrink-0 border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs px-3 py-1.5" onClick={downloadTemplate}>
            ⬇ Download template
          </button>
        </div>

        {uploadResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
            <div className="font-semibold text-green-800 mb-1">Upload successful</div>
            <ul className="text-green-700 text-xs space-y-0.5">
              <li>📄 Papers created: <b>{uploadResult.papers_created}</b> &nbsp;|&nbsp; updated: <b>{uploadResult.papers_updated}</b></li>
              <li>🔗 Mappings created: <b>{uploadResult.mappings_created}</b> &nbsp;|&nbsp; updated: <b>{uploadResult.mappings_updated}</b></li>
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

      <div className="card mt-6">
        <div className="font-semibold text-sm mb-3.5 flex items-center gap-2">
          Papers <span className="badge bg-primary-light text-primary-dark">{papers.length}</span>
        </div>
        {papers.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No papers yet — add one above</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="py-2 px-2">Paper ID</th>
                  <th className="py-2 px-2">Paper name</th>
                  <th className="py-2 px-2">Course codes mapped</th>
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.paper_id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 px-2"><code>{p.paper_id}</code></td>
                    <td className="py-2 px-2">{p.paper_name}</td>
                    <td className="py-2 px-2">
                      {mappings.filter((m) => m.paper_id === p.paper_id).map((m) => (
                        <span key={m.course_code} className="badge bg-teal-light text-teal mr-1">{m.course_code}</span>
                      ))}
                      {mappings.filter((m) => m.paper_id === p.paper_id).length === 0 && (
                        <span className="text-gray-400">none</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-6">
        <div className="font-semibold text-sm mb-3.5 flex items-center gap-2">
          Course code mappings <span className="badge bg-primary-light text-primary-dark">{mappings.length}</span>
        </div>
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No mappings yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="py-2 px-2">Course code</th>
                  <th className="py-2 px-2">Department</th>
                  <th className="py-2 px-2">Paper</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.course_code} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 px-2"><code>{m.course_code}</code></td>
                    <td className="py-2 px-2">{m.department || '—'}</td>
                    <td className="py-2 px-2">{(papers.find((p) => p.paper_id === m.paper_id) || {}).paper_name || m.paper_id}</td>
                    <td className="py-2 px-2">
                      <button className="btn btn-danger px-2.5 py-1 text-xs" onClick={() => removeMapping(m.course_code)}>Remove</button>
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
