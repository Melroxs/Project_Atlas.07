/**
 * Atlas Service Layer
 * ---------------------------------------------------------------
 * Thin, module-scoped client that the entire frontend uses to talk
 * to the Atlas backend. Today it returns mock data so the UI works
 * standalone; once the backend is wired, only this file changes.
 *
 * All requests go through /api/* which the Kubernetes ingress will
 * route to the existing Next.js backend automatically.
 *
 * Usage:
 *   import { atlas } from '@/lib/atlas-service'
 *   const claims = await atlas.claims.list()
 */

const BASE = '/api'

// Toggle to `true` once the backend is connected. When `false`, the
// service layer resolves with mock data so the UI stays interactive
// during design/QA cycles.
const USE_MOCK = true

async function request(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })
  if (!res.ok) {
    const err = new Error(`Atlas request failed: ${res.status}`)
    err.status = res.status
    try { err.payload = await res.json() } catch {}
    throw err
  }
  return res.json()
}

function mock(value, ms = 240) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/* -----------------------------------------------------------------
 * Resource-scoped helpers. Every method mirrors the shape the
 * backend is expected to expose. Swap `USE_MOCK` to `false` (or
 * remove the branches) once ready.
 * ---------------------------------------------------------------*/
export const atlas = {
  auth: {
    session:      () => USE_MOCK ? mock({ user: { name: 'Melissa October', email: 'melissa@npproofing.com' } }) : request('/auth/session'),
    login:        (payload) => USE_MOCK ? mock({ ok: true }) : request('/auth/login', { method: 'POST', body: payload }),
    logout:       () => USE_MOCK ? mock({ ok: true }) : request('/auth/logout', { method: 'POST' }),
    forgot:       (email) => USE_MOCK ? mock({ ok: true }) : request('/auth/forgot', { method: 'POST', body: { email } }),
  },

  workspaces: {
    list:         () => USE_MOCK ? mock([]) : request('/workspaces'),
    select:       (id) => USE_MOCK ? mock({ ok: true }) : request(`/workspaces/${id}/select`, { method: 'POST' }),
  },

  claims: {
    list:         (params) => USE_MOCK ? mock([]) : request(`/claims${qs(params)}`),
    get:          (id) => USE_MOCK ? mock(null) : request(`/claims/${id}`),
    create:       (payload) => USE_MOCK ? mock({ ok: true }) : request('/claims', { method: 'POST', body: payload }),
    update:       (id, payload) => USE_MOCK ? mock({ ok: true }) : request(`/claims/${id}`, { method: 'PATCH', body: payload }),
    timeline:     (id) => USE_MOCK ? mock([]) : request(`/claims/${id}/timeline`),
  },

  supplements: {
    list:         (params) => USE_MOCK ? mock([]) : request(`/supplements${qs(params)}`),
    get:          (id) => USE_MOCK ? mock(null) : request(`/supplements/${id}`),
    create:       (payload) => USE_MOCK ? mock({ ok: true }) : request('/supplements', { method: 'POST', body: payload }),
  },

  documents: {
    list:         (params) => USE_MOCK ? mock([]) : request(`/documents${qs(params)}`),
    get:          (id) => USE_MOCK ? mock(null) : request(`/documents/${id}`),
    upload:       (file, meta) => USE_MOCK ? mock({ ok: true }) : uploadFile('/documents', file, meta),
  },

  adjusters: {
    list:         () => USE_MOCK ? mock([]) : request('/adjusters'),
    get:          (id) => USE_MOCK ? mock(null) : request(`/adjusters/${encodeURIComponent(id)}`),
    history:      (id) => USE_MOCK ? mock([]) : request(`/adjusters/${encodeURIComponent(id)}/history`),
  },

  interviews: {
    list:         () => USE_MOCK ? mock([]) : request('/interviews'),
    get:          (id) => USE_MOCK ? mock(null) : request(`/interviews/${id}`),
    start:        (payload) => USE_MOCK ? mock({ id: 'INT-NEW' }) : request('/interviews', { method: 'POST', body: payload }),
    transcript:   (id) => USE_MOCK ? mock([]) : request(`/interviews/${id}/transcript`),
  },

  properties: {
    list:         () => USE_MOCK ? mock([]) : request('/properties'),
    get:          (id) => USE_MOCK ? mock(null) : request(`/properties/${encodeURIComponent(id)}`),
  },

  companies: {
    list:         () => USE_MOCK ? mock([]) : request('/companies'),
    get:          (id) => USE_MOCK ? mock(null) : request(`/companies/${encodeURIComponent(id)}`),
  },

  contacts: {
    list:         () => USE_MOCK ? mock([]) : request('/contacts'),
    get:          (id) => USE_MOCK ? mock(null) : request(`/contacts/${id}`),
  },

  tasks: {
    list:         () => USE_MOCK ? mock([]) : request('/tasks'),
    complete:     (id) => USE_MOCK ? mock({ ok: true }) : request(`/tasks/${id}/complete`, { method: 'POST' }),
  },

  notifications: {
    list:         () => USE_MOCK ? mock([]) : request('/notifications'),
    markRead:     (id) => USE_MOCK ? mock({ ok: true }) : request(`/notifications/${id}/read`, { method: 'POST' }),
    markAllRead:  () => USE_MOCK ? mock({ ok: true }) : request('/notifications/read-all', { method: 'POST' }),
  },

  intelligence: {
    briefing:     () => USE_MOCK ? mock(null) : request('/intelligence/briefing'),
    signals:      () => USE_MOCK ? mock([]) : request('/intelligence/signals'),
    ask:          (message, context) => USE_MOCK ? mock({ answer: '' }) : request('/intelligence/ask', { method: 'POST', body: { message, context } }),
  },

  search: {
    query:        (q) => USE_MOCK ? mock({ results: [] }) : request(`/search?q=${encodeURIComponent(q)}`),
  },
}

/* -----------------------------------------------------------------
 * Internal helpers
 * ---------------------------------------------------------------*/
function qs(params) {
  if (!params) return ''
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.set(k, v)
  })
  const str = s.toString()
  return str ? `?${str}` : ''
}

async function uploadFile(path, file, meta) {
  const fd = new FormData()
  fd.append('file', file)
  if (meta) fd.append('meta', JSON.stringify(meta))
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: fd, credentials: 'include' })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

export default atlas
