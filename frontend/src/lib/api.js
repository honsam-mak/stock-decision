const BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json();
}

export const api = {
  listDocs: (collection) => request(`/collections/${collection}`),

  getDoc: (collection, id) => request(`/collections/${collection}/${encodeURIComponent(id)}`),

  setDoc: (collection, id, data, merge = false) =>
    request(`/collections/${collection}/${encodeURIComponent(id)}?merge=${merge}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDoc: (collection, id) =>
    request(`/collections/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  batch: (operations) =>
    request('/batch', { method: 'POST', body: JSON.stringify(operations) }),

  history: (symbol, avKey = '') =>
    request(`/market/history?symbol=${encodeURIComponent(symbol)}&avKey=${encodeURIComponent(avKey)}`),

  quote: (symbol) => request(`/market/quote?symbol=${encodeURIComponent(symbol)}`),

  searchSymbols: (q) => request(`/market/search?q=${encodeURIComponent(q)}`),

  aiGenerate: (prompt) =>
    request('/ai/generate', { method: 'POST', body: JSON.stringify({ prompt }) }),

  aiChat: (messages, context, lang) =>
    request('/ai/chat', { method: 'POST', body: JSON.stringify({ messages, context, lang }) }),

  health: () => request('/health'),
};
