/**
 * Atlas Service Layer
 * ---------------------------------------------------------------
 * Integration client that connects the Emergent dashboard UI to
 * the existing Atlas Next.js API routes. It reuses apiFetch from
 * the existing web app so auth/session/cookies are handled the
 * same way as the rest of the application.
 *
 * Endpoints that already exist in apps/web/src/app/api are wired
 * to the real backend; endpoints that do not yet have a matching
 * route fall back to mock data so the UI stays interactive while
 * the backend is extended.
 *
 * Usage:
 *   import { atlas } from '@/lib/atlas-service'
 *   const claims = await atlas.dashboard.claims()
 */

import { apiFetch } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

function mock(value, ms = 240) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function request(path, { method = 'GET', body } = {}) {
  const options = { method }
  if (body) options.body = JSON.stringify(body)
  return apiFetch(`${path}`, options)
}

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
  const baseUrl = '/api'
  const fd = new FormData()
  fd.append('file', file)
  if (meta) fd.append('meta', JSON.stringify(meta))
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', body: fd, credentials: 'include' })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

/* ------------------------------------------------------------------
 * UI mapping helpers
 * ------------------------------------------------------------------ */
function rel(date) {
  if (!date) return '—'
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }) } catch { return '—' }
}

function money(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function title(s = '') {
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const CLAIM_STATUS = {
  new: 'In Progress',
  in_progress: 'In Progress',
  pending_review: 'Pending Review',
  documentation: 'Documentation',
  carrier_response: 'Carrier Response',
  approved: 'Approved',
  denied: 'Denied',
  draft: 'Draft',
}

const SUPPLEMENT_STATUS = {
  draft: 'Draft',
  ready_for_review: 'Pending Review',
  submitted: 'In Progress',
  waiting_for_carrier: 'Carrier Response',
  needs_revision: 'Documentation',
  partially_approved: 'Approved',
  approved: 'Approved',
  denied: 'Denied',
  closed: 'Approved',
}

const TASK_STATUS = {
  open: 'In Progress',
  in_progress: 'In Progress',
  completed: 'Approved',
  closed: 'Approved',
}

const INTERVIEW_STATUS = {
  draft: 'Documentation',
  in_progress: 'In Progress',
  transcribed: 'Pending Review',
  analyzing: 'Pending Review',
  complete: 'Approved',
}

function claimStatus(s) { return CLAIM_STATUS[s?.toLowerCase()] || title(s) || 'Draft' }
function supplementStatus(s) { return SUPPLEMENT_STATUS[s?.toLowerCase()] || title(s) || 'Draft' }
function taskStatus(s) { return TASK_STATUS[s?.toLowerCase()] || title(s) || 'In Progress' }
function interviewStatus(s) { return INTERVIEW_STATUS[s?.toLowerCase()] || title(s) || 'Documentation' }

/* ------------------------------------------------------------------
 * Generic CRUD namespaces (raw backend shape)
 * ------------------------------------------------------------------ */
export const atlas = {
  auth: {
    session:  () => mock({ user: { name: '', email: '' } }),
    login:    () => mock({ ok: true }),
    logout:   () => mock({ ok: true }),
    forgot:   () => mock({ ok: true }),
  },

  workspaces: {
    list:   () => mock([]),
    select: (id) => mock({ ok: true }),
  },

  claims: {
    list:     (params) => request(`/claims${qs(params)}`),
    get:      (id) => request(`/claims/${id}`),
    create:   (payload) => request('/claims', { method: 'POST', body: payload }),
    update:   (id, payload) => request(`/claims/${id}`, { method: 'PATCH', body: payload }),
    timeline: (id) => mock([]),
    dashboardStats: () => request('/claims/dashboard/stats'),
  },

  supplements: {
    list:   (params) => request(`/supplements${qs(params)}`),
    get:    (id) => request(`/supplements/${id}`),
    create: (payload) => request('/supplements', { method: 'POST', body: payload }),
    dashboardStats: () => request('/supplements/dashboard/stats'),
  },

  documents: {
    list:   (params) => request(`/documents${qs(params)}`),
    get:    (id) => request(`/documents/${id}`),
    upload: (file, meta) => uploadFile('/documents/upload', file, meta),
  },

  adjusters: {
    list:    () => request('/adjusters'),
    get:     (id) => request(`/adjusters/${encodeURIComponent(id)}`),
    history: (id) => mock([]),
  },

  interviews: {
    list:       () => request('/interviews'),
    get:        (id) => request(`/interviews/${id}`),
    start:      (payload) => request('/interviews', { method: 'POST', body: payload }),
    transcript: (id) => mock([]),
  },

  properties: {
    list: () => request('/properties'),
    get:  (id) => request(`/properties/${encodeURIComponent(id)}`),
  },

  companies: {
    list: () => request('/companies'),
    get:  (id) => request(`/companies/${encodeURIComponent(id)}`),
  },

  contacts: {
    list: () => request('/contacts'),
    get:  (id) => request(`/contacts/${id}`),
  },

  tasks: {
    list:     () => request('/tasks'),
    get:      (id) => request(`/tasks/${id}`),
    complete: (id) => request(`/tasks/${id}`, { method: 'PATCH', body: { status: 'completed' } }),
  },

  users: {
    list: () => mock([
      { name: 'Melissa October', role: 'Owner', email: 'melissa@npproofing.com', last: 'now' },
      { name: 'Devon Blake', role: 'Operations', email: 'devon@npproofing.com', last: '12m ago' },
      { name: 'Aria Chen', role: 'Estimator', email: 'aria@npproofing.com', last: '1h ago' },
      { name: 'Kai Martins', role: 'Field Rep', email: 'kai@npproofing.com', last: '3h ago' },
      { name: 'Nadia Sokolova', role: 'Admin', email: 'nadia@npproofing.com', last: 'yesterday' },
    ]),
  },

  notifications: {
    list:        () => mock([]),
    markRead:    (id) => mock({ ok: true }),
    markAllRead: () => mock({ ok: true }),
  },

  intelligence: {
    briefing: () => mock(null),
    signals:  () => mock([]),
    ask:      (message, context) => request('/ai-supplements', { method: 'POST', body: { message, context } }).catch(() => ({ answer: '' })),
  },

  search: {
    query: (q) => mock({ results: [] }),
  },

  /* ------------------------------------------------------------------
   * Dashboard namespace (UI-shaped data)
   * ------------------------------------------------------------------ */
  dashboard: {
    claims: async (params) => {
      const raw = await atlas.claims.list(params)
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map(c => ({
        id: c.id,
        claimNumber: c.claimNumber || c.id,
        carrier: c.insuranceCompany || 'Unknown',
        status: claimStatus(c.status),
        revenue: money(c.estimatedValue),
        supplement: money(c.approvedValue),
        updated: rel(c.updatedAt),
        raw: c,
      }))
    },

    supplements: async (params) => {
      const raw = await atlas.supplements.list(params)
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map(s => ({
        id: s.id,
        supplementNumber: s.supplementNumber || s.id,
        claim: s.claimNumber || s.claimId || '—',
        amount: money(s.requestedAmount || s.difference),
        status: supplementStatus(s.status),
        confidence: s.confidence || 85,
        carrier: s.carrier || 'Unknown',
        raw: s,
      }))
    },

    documents: async (params) => {
      const raw = await atlas.documents.list(params)
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map(d => ({
        id: d.id,
        name: d.fileName || 'Untitled',
        size: d.size ? `${d.size}` : d.mimeType || 'Document',
        tag: d.tag || 'Document',
        claim: d.claimNumber || d.claimId || '—',
        ago: rel(d.createdAt),
        raw: d,
      }))
    },

    adjusters: async () => {
      const raw = await atlas.adjusters.list()
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map(a => ({
        id: a.id,
        name: a.fullName || 'Adjuster',
        type: a.insuranceCompany || a.type || 'Adjuster',
        region: a.territory || a.office || '—',
        response: Number(a.responseTime) || 4.0,
        approval: Number(a.approvalRate) || 75,
        scrutiny: a.scrutiny || 'Medium',
        claims: Number(a.claimsCount) || 0,
        raw: a,
      }))
    },

    interviews: async () => {
      const raw = await atlas.interviews.list()
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map(i => ({
        id: i.id,
        interviewNumber: i.interviewNumber || i.id,
        name: i.templateName || i.name || 'Interview',
        duration: i.duration || '—',
        ago: rel(i.createdAt),
        status: interviewStatus(i.status),
        tags: Array.isArray(i.tags) ? i.tags : (i.metadata?.tags || []),
        raw: i,
      }))
    },

    properties: async () => {
      const raw = await atlas.properties.list()
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map(p => ({
        id: p.id,
        addr: p.address || '—',
        city: [p.city, p.state].filter(Boolean).join(', ') || '—',
        type: p.type || 'Residential',
        damage: p.damageType || 'Storm / Hail',
        claims: Number(p.claimsCount) || 0,
        value: money(p.estimatedValue),
        raw: p,
      }))
    },

    companies: async () => {
      const raw = await atlas.companies.list()
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map(c => ({
        id: c.id,
        name: c.name || 'Company',
        claims: Number(c.activeClaims) || 0,
        approval: Number(c.approvalRate) || 0,
        responseDays: Number(c.avgResponseDays) || 0,
        raw: c,
      }))
    },

    contacts: async () => {
      const raw = await atlas.contacts.list()
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map(c => ({
        id: c.id,
        name: c.name || '—',
        role: c.role || 'Contact',
        email: c.email || '—',
        phone: c.phone || '—',
        city: c.city || '—',
        raw: c,
      }))
    },

    tasks: async () => {
      const raw = await atlas.tasks.list()
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map(t => ({
        id: t.id,
        title: t.title || '—',
        claim: t.claimNumber || t.claimId || '—',
        due: rel(t.dueDate) || t.dueDate || '—',
        priority: title(t.priority) || 'Medium',
        done: t.status?.toLowerCase() === 'completed' || t.status?.toLowerCase() === 'closed',
        raw: t,
      }))
    },

    activity: async () => {
      const raw = await request('/activity')
      const arr = Array.isArray(raw) ? raw : raw?.data || []
      return arr.map((a, idx) => ({
        id: a.id || idx,
        t: rel(a.createdAt),
        who: a.userName || a.userId || 'Atlas',
        act: a.action || 'updated',
        target: a.entityName || a.entityId || '—',
        color: '#00E6FF',
        icon: null,
        raw: a,
      }))
    },

    stats: async () => {
      const [claimStats, suppStats] = await Promise.all([
        atlas.claims.dashboardStats().catch(() => ({ totalClaims: 0, byStatus: {}, recentClaims: [] })),
        atlas.supplements.dashboardStats().catch(() => ({ totalSupplements: 0, byStatus: {}, totalRequested: '0', totalApproved: '0', recentSupplements: [] })),
      ])
      return { claimStats, suppStats }
    },
  },
}

export default atlas
