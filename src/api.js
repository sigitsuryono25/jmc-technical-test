const TOKEN_KEY = 'jmc_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function toQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });
  const result = search.toString();
  return result ? `?${result}` : '';
}

export async function api(path, options = {}) {
  const { method = 'GET', body, formData, params, raw } = options;
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // Vercel me-rewrite semua /api/* ke satu function, sehingga path asli
  // dititipkan lewat header ini agar router Express tetap menerima path benar.
  headers['X-Api-Path'] = `${path}${toQuery(params)}`;

  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`/api${path}${toQuery(params)}`, {
    method,
    headers,
    body: payload,
  });

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('jmc:unauthorized'));
  }

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let message = `Terjadi kesalahan (${response.status})`;
    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        message = data.message || message;
      } catch {
        /* ignore */
      }
    }
    throw new ApiError(message, response.status);
  }

  if (raw) return response;
  if (contentType.includes('application/json')) return response.json();
  return response.blob();
}

export async function downloadFile(path, params, filename) {
  const blob = await api(path, { params, raw: false });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
