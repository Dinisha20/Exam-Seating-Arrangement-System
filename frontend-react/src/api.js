const API = '/api';

function normalizeError(data, fallbackMsg, status) {
  let err;
  if (data && data.detail !== undefined) {
    if (typeof data.detail === 'string') err = { error: data.detail };
    else if (Array.isArray(data.detail)) err = { error: data.detail.map((d) => d.msg || JSON.stringify(d)).join('; ') };
    else if (data.detail && typeof data.detail === 'object' && data.detail.error) {
      err = { error: data.detail.error, hint: data.detail.hint };
    } else {
      err = data.detail;
    }
  } else if (data && data.error) {
    err = data;
  } else {
    err = { error: fallbackMsg || 'Request failed' };
  }
  if (status !== undefined) err = { ...err, status };
  return err;
}

export async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`, res.status);
  return data;
}

export async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`, res.status);
  return data;
}

export async function apiPut(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`, res.status);
  return data;
}

export async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`, res.status);
  return data;
}

export async function apiUpload(path, file, extraFields) {
  const formData = new FormData();
  formData.append('file', file);
  // Append any extra form fields (e.g. exam_id for session-specific uploads)
  if (extraFields) {
    Object.entries(extraFields).forEach(([k, v]) => formData.append(k, v));
  }
  const res = await fetch(`${API}${path}`, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`, res.status);
  return data;
}


export function exportUrl(examId) {
  return `${API}/export/${examId}`;
}
