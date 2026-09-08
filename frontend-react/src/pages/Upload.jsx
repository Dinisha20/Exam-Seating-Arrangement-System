import React, { useState, useRef } from 'react';
import { useToast } from '../components/Toast.jsx';

const API = '/api';

export default function Upload({ currentExamId, onDataChanged }) {
  const showToast = useToast();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [availableSheets, setAvailableSheets] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState(new Set());
  const fileInputRef = useRef(null);

  if (!currentExamId) {
    return <div className="alert alert-info">Create an exam session first (Exam Sessions tab), then come back here to upload students for it.</div>;
  }

  const reset = () => {
    setPendingFile(null);
    setAvailableSheets(null);
    setSelectedSheets(new Set());
  };

  // Step 1: inspect the workbook to find which sheets it contains. A single
  // file (like a real COE export) can bundle multiple sessions' sheets
  // together — we don't want to blindly import all of them into whichever
  // one exam session you're currently uploading to.
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
        // Only one sheet — nothing to choose, import it directly.
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

  // Step 2: import only the selected sheet(s).
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
      showToast('Upload complete');
      onDataChanged();
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

  return (
    <div className="card">
      <div className="font-semibold text-sm mb-1">Upload Hall Plan Excel</div>
      <p className="text-xs text-gray-500 mb-3.5">
        Accepts the COE hall plan format — columns: Year, Class, Course Code, Register Nos., etc.
        Register number ranges like "001 - 015, 020 - 025" are expanded automatically.
        Students are only imported if their course code is already mapped to a paper.
        If the file has more than one sheet, you'll be asked which one(s) belong to this session.
      </p>

      {availableSheets ? (
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
          <div className="text-sm font-semibold mb-1">This file has {availableSheets.length} sheets</div>
          <p className="text-xs text-gray-500 mb-3">
            Select only the sheet(s) that belong to <b>this</b> exam session — the others won't be imported.
          </p>
          {availableSheets.map((name) => (
            <div key={name} className="flex items-center gap-2 py-1.5">
              <input
                type="checkbox"
                id={`sheet_${name}`}
                checked={selectedSheets.has(name)}
                onChange={() => toggleSheet(name)}
              />
              <label htmlFor={`sheet_${name}`} className="text-sm">{name}</label>
            </div>
          ))}
          <div className="flex gap-2 mt-3.5">
            <button className="btn btn-primary" disabled={busy} onClick={confirmImport}>
              {busy ? 'Importing…' : 'Import selected sheet(s)'}
            </button>
            <button className="btn btn-outline" disabled={busy} onClick={reset}>Cancel</button>
          </div>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-xl p-9 text-center cursor-pointer transition ${
            dragging ? 'border-primary bg-primary-light' : 'border-gray-200 bg-gray-50 hover:border-primary'
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
          <div className="text-gray-500 text-sm">
            {busy ? 'Reading file…' : 'Drag & drop the Excel file here, or click to browse'}
          </div>
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
            <>
              <div className="alert alert-success">
                Imported {result.data.imported} of {result.data.total_parsed} parsed students for this exam session.
              </div>
              {result.data.unmapped_course_codes?.length > 0 && (
                <div className="alert alert-error">
                  These course codes have no paper mapping yet, so their students were skipped:{' '}
                  <b>{result.data.unmapped_course_codes.join(', ')}</b>. Add mappings on the Papers &amp; Mapping tab,
                  then re-upload.
                </div>
              )}
              {result.data.parse_errors?.length > 0 && (
                <div className="alert alert-info">
                  {result.data.parse_errors.length} row(s) could not be parsed (see browser console for details).
                </div>
              )}
            </>
          ) : (
            <div className="alert alert-error">{result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}