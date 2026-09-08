const API = '/api';

function normalizeError(data, fallbackMsg) {
  if (data && data.detail !== undefined) {
    if (typeof data.detail === 'string') return { error: data.detail };
    if (Array.isArray(data.detail)) return { error: data.detail.map((d) => d.msg || JSON.stringify(d)).join('; ') };
    if (data.detail && typeof data.detail === 'object' && data.detail.error) {
      return { error: data.detail.error, hint: data.detail.hint };
    }
    return data.detail;
  }
  if (data && data.error) return data;
  return { error: fallbackMsg || 'Request failed' };
}

export async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`);
  return data;
}

export async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`);
  return data;
}

export async function apiPut(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`);
  return data;
}

export async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`);
  return data;
}

export async function apiUpload(path, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API}${path}`, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw normalizeError(data, `Server returned ${res.status}: ${res.statusText || 'Error'}`);
  return data;
}

export function exportUrl(examId) {
  return `${API}/export/${examId}`;
}
