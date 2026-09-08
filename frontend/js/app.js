// app.js — Exam Seating Arrangement System frontend (vanilla JS, no build step)

const API = '/api';
let state = {
  exams: [],
  currentExamId: null,
  halls: [],
  papers: [],
  mappings: [],
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
function normalizeError(data) {
  if (data && data.detail !== undefined) {
    if (typeof data.detail === 'string') return { error: data.detail };
    if (Array.isArray(data.detail)) return { error: data.detail.map(d => d.msg || JSON.stringify(d)).join('; ') };
    return data.detail; // already a dict like { error, hint, ... }
  }
  return data;
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data);
  return data;
}
async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data);
  return data;
}
async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data);
  return data;
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = isError ? '#dc2626' : '#1a1d29';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  papers: 'Papers & Course Code Mapping',
  halls: 'Halls & Benches',
  exams: 'Exam Sessions',
  upload: 'Upload Students (Hall Plan Excel)',
  generate: 'Generate Seating',
  seatmap: 'Seat Map',
  lookup: 'Student Seat Lookup',
};

async function navigate(view) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('viewTitle').textContent = VIEW_TITLES[view] || view;
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    switch (view) {
      case 'dashboard': await renderDashboard(content); break;
      case 'papers': await renderPapers(content); break;
      case 'halls': await renderHalls(content); break;
      case 'exams': await renderExams(content); break;
      case 'upload': await renderUpload(content); break;
      case 'generate': await renderGenerate(content); break;
      case 'seatmap': await renderSeatmap(content); break;
      case 'lookup': await renderLookup(content); break;
    }
  } catch (e) {
    content.innerHTML = `<div class="alert alert-error">${esc(e.error || 'Something went wrong')}</div>`;
  }
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.view));
});

// ---------------------------------------------------------------------------
// Exam session selector (top bar)
// ---------------------------------------------------------------------------
async function refreshExamSelector() {
  state.exams = await apiGet('/exams');
  const sel = document.getElementById('examSelect');
  sel.innerHTML = state.exams
    .map((e) => `<option value="${e.exam_id}">${esc(e.exam_name)} — ${esc(e.exam_date || '')} (${esc(e.session_type)})</option>`)
    .join('') || '<option value="">No exam sessions yet</option>';
  if (state.exams.length && !state.currentExamId) state.currentExamId = state.exams[0].exam_id;
  if (state.currentExamId) sel.value = state.currentExamId;
}
document.getElementById('examSelect').addEventListener('change', (e) => {
  state.currentExamId = e.target.value;
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
(async function init() {
  await refreshExamSelector();
  navigate('dashboard');
})();

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------
async function renderDashboard(content) {
  const halls = await apiGet('/halls');
  const exams = state.exams;
  const { papers, mappings } = await apiGet('/papers');
  const totalCapacity = halls.reduce((s, h) => s + h.capacity, 0);

  let allocatedCount = 0;
  if (state.currentExamId) {
    try {
      const alloc = await apiGet(`/allocation/${state.currentExamId}`);
      allocatedCount = alloc.length;
    } catch (e) { /* no allocation yet */ }
  }

  content.innerHTML = `
    <div class="grid grid-4">
      <div class="stat-card">
        <div class="stat-label">Halls configured</div>
        <div class="stat-value">${halls.length}</div>
        <div class="stat-sub">${totalCapacity} total seats</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Exam sessions</div>
        <div class="stat-value">${exams.length}</div>
        <div class="stat-sub">${state.currentExamId ? 'Active: ' + esc((exams.find(e=>e.exam_id==state.currentExamId)||{}).exam_name || '') : 'None selected'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Papers mapped</div>
        <div class="stat-value">${papers.length}</div>
        <div class="stat-sub">${mappings.length} course codes linked</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Seats allocated</div>
        <div class="stat-value">${allocatedCount}</div>
        <div class="stat-sub">for the active exam session</div>
      </div>
    </div>

    <div class="grid grid-2 section-gap">
      <div class="card">
        <div class="card-title">Getting started</div>
        <ol style="margin:0;padding-left:18px;line-height:2;color:var(--text-muted);font-size:13px">
          <li>Define <b>papers</b> and map course codes to them (Papers &amp; Mapping)</li>
          <li>Set up your <b>halls and benches</b> (Halls &amp; Benches)</li>
          <li>Create an <b>exam session</b> (Exam Sessions)</li>
          <li><b>Upload</b> the Hall Plan Excel for that session</li>
          <li><b>Generate</b> the seating arrangement</li>
          <li>View the <b>seat map</b> or look up a student's seat</li>
        </ol>
      </div>
      <div class="card">
        <div class="card-title">Hall capacity overview</div>
        ${halls.length === 0 ? '<div class="empty-state">No halls configured yet</div>' : halls.map(h => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
              <span><b>${esc(h.hall_name)}</b> <span style="color:var(--text-faint)">(${esc(h.block||'')})</span></span>
              <span style="color:var(--text-muted)">${h.capacity} seats</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// PAPERS & COURSE CODE MAPPING
// ---------------------------------------------------------------------------
async function renderPapers(content) {
  const { papers, mappings } = await apiGet('/papers');
  state.papers = papers;
  state.mappings = mappings;

  content.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">Add a paper</div>
        <p style="font-size:12.5px;color:var(--text-muted);margin-top:-8px">
          A paper is the actual exam subject. Different departments may use different
          course codes for the same paper — map them all to one paper below.
        </p>
        <div class="form-row">
          <label>Paper ID</label>
          <input id="paperIdInput" placeholder="e.g. PAPER_DBMS" />
        </div>
        <div class="form-row">
          <label>Paper name</label>
          <input id="paperNameInput" placeholder="e.g. Database Management Systems" />
        </div>
        <button class="btn btn-primary" id="addPaperBtn">Add paper</button>
      </div>

      <div class="card">
        <div class="card-title">Map a course code to a paper</div>
        <p style="font-size:12.5px;color:var(--text-muted);margin-top:-8px">
          Every course code used during import must resolve to a paper before
          seating can be generated.
        </p>
        <div class="form-row">
          <label>Course code</label>
          <input id="courseCodeInput" placeholder="e.g. CS301" />
        </div>
        <div class="form-row">
          <label>Department</label>
          <input id="deptInput" placeholder="e.g. CSE" />
        </div>
        <div class="form-row">
          <label>Paper</label>
          <select id="paperSelectInput">
            <option value="">Select a paper…</option>
            ${papers.map(p => `<option value="${esc(p.paper_id)}">${esc(p.paper_name)} (${esc(p.paper_id)})</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" id="addMappingBtn">Add mapping</button>
      </div>
    </div>

    <div class="card section-gap">
      <div class="card-title">Papers <span class="badge badge-primary">${papers.length}</span></div>
      ${papers.length === 0 ? '<div class="empty-state">No papers yet — add one above</div>' : `
        <table>
          <thead><tr><th>Paper ID</th><th>Paper name</th><th>Course codes mapped</th></tr></thead>
          <tbody>
            ${papers.map(p => `
              <tr>
                <td><code>${esc(p.paper_id)}</code></td>
                <td>${esc(p.paper_name)}</td>
                <td>${mappings.filter(m => m.paper_id === p.paper_id).map(m => `<span class="badge badge-teal" style="margin-right:4px">${esc(m.course_code)}</span>`).join('') || '<span style="color:var(--text-faint)">none</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <div class="card section-gap">
      <div class="card-title">Course code mappings <span class="badge badge-primary">${mappings.length}</span></div>
      ${mappings.length === 0 ? '<div class="empty-state">No mappings yet</div>' : `
        <table>
          <thead><tr><th>Course code</th><th>Department</th><th>Paper</th><th></th></tr></thead>
          <tbody>
            ${mappings.map(m => `
              <tr>
                <td><code>${esc(m.course_code)}</code></td>
                <td>${esc(m.department || '—')}</td>
                <td>${esc((papers.find(p=>p.paper_id===m.paper_id)||{}).paper_name || m.paper_id)}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteMapping('${esc(m.course_code)}')">Remove</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  document.getElementById('addPaperBtn').addEventListener('click', async () => {
    const paper_id = document.getElementById('paperIdInput').value.trim();
    const paper_name = document.getElementById('paperNameInput').value.trim();
    if (!paper_id || !paper_name) return showToast('Enter both a paper ID and name', true);
    try {
      await apiPost('/papers', { paper_id, paper_name });
      showToast('Paper added');
      navigate('papers');
    } catch (e) { showToast(e.error || 'Failed to add paper', true); }
  });

  document.getElementById('addMappingBtn').addEventListener('click', async () => {
    const course_code = document.getElementById('courseCodeInput').value.trim();
    const department = document.getElementById('deptInput').value.trim();
    const paper_id = document.getElementById('paperSelectInput').value;
    if (!course_code || !paper_id) return showToast('Enter a course code and select a paper', true);
    try {
      await apiPost('/course-mapping', { course_code, department, paper_id });
      showToast('Mapping added');
      navigate('papers');
    } catch (e) { showToast(e.error || 'Failed to add mapping', true); }
  });
}

async function deleteMapping(code) {
  try {
    await apiDelete(`/course-mapping/${encodeURIComponent(code)}`);
    showToast('Mapping removed');
    navigate('papers');
  } catch (e) { showToast(e.error || 'Failed to remove', true); }
}

// ---------------------------------------------------------------------------
// HALLS & BENCHES
// ---------------------------------------------------------------------------
async function renderHalls(content) {
  const halls = await apiGet('/halls');
  state.halls = halls;

  content.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">Add a hall</div>
        <div class="form-row">
          <label>Hall name</label>
          <input id="hallNameInput" placeholder="e.g. B426" />
        </div>
        <div class="form-row">
          <label>Block</label>
          <input id="blockInput" placeholder="e.g. B-Workshop" />
        </div>
        <div class="form-inline">
          <div class="form-row">
            <label>Rows</label>
            <input id="rowsInput" type="number" min="1" value="4" />
          </div>
          <div class="form-row">
            <label>Benches per row</label>
            <input id="colsInput" type="number" min="1" value="5" />
          </div>
          <div class="form-row">
            <label>Seats per bench</label>
            <input id="spbInput" type="number" min="1" max="4" value="2" />
          </div>
        </div>
        <button class="btn btn-primary" id="addHallBtn" style="margin-top:6px">Add hall</button>
      </div>

      <div class="card">
        <div class="card-title">Configured halls <span class="badge badge-primary">${halls.length}</span></div>
        ${halls.length === 0 ? '<div class="empty-state">No halls yet — add one to the left</div>' :
          halls.map(h => `
            <div class="hall-list-item">
              <div>
                <div><b>${esc(h.hall_name)}</b> <span style="color:var(--text-faint)">${esc(h.block||'')}</span></div>
                <div class="meta">${h.rows_count} rows &times; ${h.cols_count} benches &middot; ${h.seats_per_bench} seats/bench &middot; ${h.capacity} total seats</div>
              </div>
              <button class="btn btn-sm btn-danger" onclick="deleteHall(${h.hall_id})">Remove</button>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;

  document.getElementById('addHallBtn').addEventListener('click', async () => {
    const hall_name = document.getElementById('hallNameInput').value.trim();
    const block = document.getElementById('blockInput').value.trim();
    const rows_count = parseInt(document.getElementById('rowsInput').value, 10);
    const cols_count = parseInt(document.getElementById('colsInput').value, 10);
    const seats_per_bench = parseInt(document.getElementById('spbInput').value, 10);
    if (!hall_name || !rows_count || !cols_count) return showToast('Fill in all required fields', true);
    try {
      await apiPost('/halls', { hall_name, block, rows_count, cols_count, seats_per_bench });
      showToast('Hall added');
      navigate('halls');
    } catch (e) { showToast(e.error || 'Failed to add hall', true); }
  });
}

async function deleteHall(id) {
  if (!confirm('Remove this hall and all its benches?')) return;
  try {
    await apiDelete(`/halls/${id}`);
    showToast('Hall removed');
    navigate('halls');
  } catch (e) { showToast(e.error || 'Failed to remove hall', true); }
}

// ---------------------------------------------------------------------------
// EXAM SESSIONS
// ---------------------------------------------------------------------------
async function renderExams(content) {
  const exams = await apiGet('/exams');

  content.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">Create an exam session</div>
        <div class="form-row">
          <label>Exam name</label>
          <input id="examNameInput" placeholder="e.g. CAT-I" />
        </div>
        <div class="form-inline">
          <div class="form-row">
            <label>Date</label>
            <input id="examDateInput" type="date" />
          </div>
          <div class="form-row">
            <label>Session</label>
            <select id="sessionTypeInput">
              <option value="FN">Forenoon (FN)</option>
              <option value="AN">Afternoon (AN)</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary" id="addExamBtn" style="margin-top:6px">Create session</button>
      </div>

      <div class="card">
        <div class="card-title">Exam sessions <span class="badge badge-primary">${exams.length}</span></div>
        ${exams.length === 0 ? '<div class="empty-state">No exam sessions yet</div>' : `
          <table>
            <thead><tr><th>Name</th><th>Date</th><th>Session</th></tr></thead>
            <tbody>
              ${exams.map(e => `<tr><td><b>${esc(e.exam_name)}</b></td><td>${esc(e.exam_date||'—')}</td><td><span class="badge badge-teal">${esc(e.session_type)}</span></td></tr>`).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;

  document.getElementById('addExamBtn').addEventListener('click', async () => {
    const exam_name = document.getElementById('examNameInput').value.trim();
    const exam_date = document.getElementById('examDateInput').value;
    const session_type = document.getElementById('sessionTypeInput').value;
    if (!exam_name) return showToast('Enter an exam name', true);
    try {
      const result = await apiPost('/exams', { exam_name, exam_date, session_type });
      showToast('Exam session created');
      state.currentExamId = result.exam_id;
      await refreshExamSelector();
      navigate('exams');
    } catch (e) { showToast(e.error || 'Failed to create session', true); }
  });
}

// ---------------------------------------------------------------------------
// UPLOAD STUDENTS (Hall Plan Excel)
// ---------------------------------------------------------------------------
async function renderUpload(content) {
  if (!state.currentExamId) {
    content.innerHTML = '<div class="alert alert-info">Create an exam session first (Exam Sessions tab), then come back here to upload students for it.</div>';
    return;
  }

  content.innerHTML = `
    <div class="card">
      <div class="card-title">Upload Hall Plan Excel</div>
      <p style="font-size:12.5px;color:var(--text-muted);margin-top:-8px">
        Accepts the COE hall plan format — columns: Year, Class, Course Code, Register Nos., etc.
        Register number ranges like "001 - 015, 020 - 025" are expanded automatically.
        Students are only imported if their course code is already mapped to a paper.
      </p>
      <div class="dropzone" id="dropzone">
        <div id="dropzoneText">Drag &amp; drop the Excel file here, or click to browse</div>
        <input type="file" id="fileInput" accept=".xlsx,.xls" style="display:none" />
      </div>
      <div id="uploadResult" class="section-gap"></div>
    </div>
  `;

  const dz = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  dz.addEventListener('click', () => fileInput.click());
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('drag');
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleUpload(e.target.files[0]);
  });
}

async function handleUpload(file) {
  document.getElementById('dropzoneText').textContent = `Uploading "${file.name}"…`;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${API}/upload/${state.currentExamId}`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw data;

    document.getElementById('dropzoneText').textContent = 'Drag & drop the Excel file here, or click to browse';
    const resultDiv = document.getElementById('uploadResult');
    let html = `<div class="alert alert-success">Imported ${data.imported} of ${data.total_parsed} parsed students for this exam session.</div>`;
    if (data.unmapped_course_codes && data.unmapped_course_codes.length) {
      html += `<div class="alert alert-error">These course codes have no paper mapping yet, so their students were skipped: <b>${data.unmapped_course_codes.map(esc).join(', ')}</b>. Add mappings on the Papers &amp; Mapping tab, then re-upload.</div>`;
    }
    if (data.parse_errors && data.parse_errors.length) {
      html += `<div class="alert alert-info">${data.parse_errors.length} row(s) could not be parsed (see console for details).</div>`;
      console.warn('Parse errors:', data.parse_errors);
    }
    resultDiv.innerHTML = html;
    showToast('Upload complete');
  } catch (e) {
    document.getElementById('dropzoneText').textContent = 'Drag & drop the Excel file here, or click to browse';
    document.getElementById('uploadResult').innerHTML = `<div class="alert alert-error">${esc(e.error || 'Upload failed')}</div>`;
  }
}

// ---------------------------------------------------------------------------
// GENERATE SEATING
// ---------------------------------------------------------------------------
async function renderGenerate(content) {
  if (!state.currentExamId) {
    content.innerHTML = '<div class="alert alert-info">Create an exam session first.</div>';
    return;
  }
  const halls = await apiGet('/halls');

  content.innerHTML = `
    <div class="card">
      <div class="card-title">Select halls to use for this session</div>
      ${halls.length === 0 ? '<div class="empty-state">No halls configured — add halls first</div>' : halls.map(h => `
        <div class="checkbox-row">
          <input type="checkbox" class="hallCheckbox" value="${h.hall_id}" id="hall_${h.hall_id}" checked />
          <label for="hall_${h.hall_id}"><b>${esc(h.hall_name)}</b> — ${h.capacity} seats (${h.rows_count}&times;${h.cols_count}, ${h.seats_per_bench}/bench)</label>
        </div>
      `).join('')}
      <button class="btn btn-primary" id="generateBtn" style="margin-top:14px" ${halls.length===0?'disabled':''}>Generate seating</button>
      <div id="generateResult" class="section-gap"></div>
    </div>
  `;

  const btn = document.getElementById('generateBtn');
  if (btn) btn.addEventListener('click', async () => {
    const hall_ids = [...document.querySelectorAll('.hallCheckbox:checked')].map(cb => parseInt(cb.value, 10));
    if (hall_ids.length === 0) return showToast('Select at least one hall', true);
    btn.disabled = true;
    btn.textContent = 'Generating…';
    try {
      const result = await apiPost(`/generate/${state.currentExamId}`, { hall_ids });
      document.getElementById('generateResult').innerHTML = `
        <div class="alert alert-success">
          Seated ${result.students_seated} students across ${result.total_seats} available seats.
          No two students writing the same paper share or sit adjacent to a bench.
        </div>
        <button class="btn btn-outline" onclick="navigate('seatmap')">View seat map</button>
      `;
      showToast('Seating generated successfully');
    } catch (e) {
      let msg = e.error || 'Generation failed';
      if (e.hint) msg += ` — ${e.hint}`;
      document.getElementById('generateResult').innerHTML = `<div class="alert alert-error">${esc(msg)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate seating';
    }
  });
}

// ---------------------------------------------------------------------------
// SEAT MAP
// ---------------------------------------------------------------------------
const PAPER_COLORS = ['#4f46e5', '#0f9d8c', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#db2777'];
function colorForPaper(paperId, paperList) {
  const idx = paperList.indexOf(paperId);
  return PAPER_COLORS[idx % PAPER_COLORS.length];
}

async function renderSeatmap(content) {
  if (!state.currentExamId) {
    content.innerHTML = '<div class="alert alert-info">Select or create an exam session first.</div>';
    return;
  }

  let alloc;
  try {
    alloc = await apiGet(`/allocation/${state.currentExamId}`);
  } catch (e) {
    alloc = [];
  }

  if (alloc.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        No seating generated yet for this exam session.
        <div style="margin-top:14px"><button class="btn btn-primary" onclick="navigate('generate')">Go to Generate Seating</button></div>
      </div>`;
    return;
  }

  const halls = await apiGet('/halls');
  const paperIds = [...new Set(alloc.map(a => a.paper_id).filter(Boolean))];

  // Build hall -> row -> col -> seats structure
  const byHall = {};
  for (const h of halls) byHall[h.hall_id] = { name: h.hall_name, rows: h.rows_count, cols: h.cols_count, spb: h.seats_per_bench, seatMap: {} };
  for (const a of alloc) {
    if (!byHall[a.hall_id]) continue;
    const key = `${a.row_number}:${a.column_number}`;
    if (!byHall[a.hall_id].seatMap[key]) byHall[a.hall_id].seatMap[key] = {};
    byHall[a.hall_id].seatMap[key][a.seat_label] = a;
  }

  let html = `
    <div class="legend">
      ${paperIds.map(p => `<div class="legend-item"><span class="legend-swatch" style="background:${colorForPaper(p, paperIds)}"></span>${esc(p)}</div>`).join('')}
      <div class="legend-item"><span class="legend-swatch" style="background:#e3e5ea"></span>Empty (buffer)</div>
    </div>
  `;

  for (const hallId of Object.keys(byHall)) {
    const h = byHall[hallId];
    const hasAnySeat = Object.keys(h.seatMap).length > 0;
    if (!hasAnySeat) continue;
    html += `<div class="hall-block"><h3>${esc(h.name)} <span class="badge badge-primary">${Object.values(h.seatMap).reduce((s,b)=>s+Object.keys(b).length,0)} seated</span></h3>`;
    for (let r = 1; r <= h.rows; r++) {
      html += `<div class="seat-row">`;
      for (let c = 1; c <= h.cols; c++) {
        const bench = h.seatMap[`${r}:${c}`] || {};
        html += `<div class="bench">`;
        const labels = h.spb === 1 ? ['A'] : h.spb === 2 ? ['A','B'] : Array.from({length:h.spb},(_,i)=>String.fromCharCode(65+i));
        for (const label of labels) {
          const seat = bench[label];
          if (seat) {
            const color = colorForPaper(seat.paper_id, paperIds);
            html += `<div class="seat" style="background:${color}22;color:${color};border-right:1px solid var(--border)" title="${esc(seat.register_no)} — ${esc(seat.course_code)}">${esc(seat.register_no.slice(-4))}</div>`;
          } else {
            html += `<div class="seat seat-empty">—</div>`;
          }
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  html += `<button class="btn btn-outline" onclick="exportSeating()">Export to Excel</button>`;

  content.innerHTML = html;
}

async function exportSeating() {
  if (!state.currentExamId) return;
  window.location.href = `${API}/export/${state.currentExamId}`;
}

// ---------------------------------------------------------------------------
// STUDENT LOOKUP
// ---------------------------------------------------------------------------
async function renderLookup(content) {
  if (!state.currentExamId) {
    content.innerHTML = '<div class="alert alert-info">Select or create an exam session first.</div>';
    return;
  }

  content.innerHTML = `
    <div class="card" style="max-width:480px">
      <div class="card-title">Find your seat</div>
      <div class="form-row">
        <label>Register number</label>
        <input id="regNoInput" placeholder="e.g. CSE21CS001" />
      </div>
      <button class="btn btn-primary" id="lookupBtn">Search</button>
      <div id="lookupResult" class="section-gap"></div>
    </div>
  `;

  const doLookup = async () => {
    const regNo = document.getElementById('regNoInput').value.trim();
    if (!regNo) return showToast('Enter a register number', true);
    try {
      const seat = await apiGet(`/seat-lookup/${state.currentExamId}/${encodeURIComponent(regNo)}`);
      document.getElementById('lookupResult').innerHTML = `
        <div class="seat-slip">
          <div class="seat-slip-label">Register number</div>
          <div class="seat-slip-value">${esc(seat.register_no)}</div>
          <div class="seat-slip-grid">
            <div><div class="seat-slip-label">Hall</div><div style="font-weight:600">${esc(seat.hall_name)}</div></div>
            <div><div class="seat-slip-label">Block</div><div style="font-weight:600">${esc(seat.block||'—')}</div></div>
            <div><div class="seat-slip-label">Row / Bench</div><div style="font-weight:600">${seat.row_number} / ${seat.column_number}</div></div>
            <div><div class="seat-slip-label">Seat</div><div style="font-weight:600">${esc(seat.seat_label)}</div></div>
            <div><div class="seat-slip-label">Class</div><div style="font-weight:600">${esc(seat.class_name||'—')}</div></div>
            <div><div class="seat-slip-label">Course code</div><div style="font-weight:600">${esc(seat.course_code||'—')}</div></div>
          </div>
        </div>
      `;
    } catch (e) {
      document.getElementById('lookupResult').innerHTML = `<div class="alert alert-error">${esc(e.error || 'Seat not found')}</div>`;
    }
  };

  document.getElementById('lookupBtn').addEventListener('click', doLookup);
  document.getElementById('regNoInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLookup(); });
}
