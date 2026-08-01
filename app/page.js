'use client'

import { useMemo, useState, useEffect, useRef, createContext, useContext } from 'react'

const DetailContext = createContext(() => {})
const useOpenDetail = () => useContext(DetailContext)
import {
  LayoutDashboard, Sparkles, FolderOpen, FileText, FileStack, UserSquare2,
  Mic, Building2, ListChecks, Activity as ActivityIcon, Briefcase, Users,
  UserCog, Settings, Search, Bell, ChevronDown, ChevronRight, ArrowUpRight,
  Send, Plus, MoreHorizontal, Filter, Command, Zap, ShieldCheck, Waves,
  ArrowRight, Calendar, Clock, MapPin, Phone, Mail, Download, Eye,
  CheckCircle2, AlertTriangle, Circle, Home, Cloud, Flame, Droplets,
  Wind, ArrowUp, ArrowDown, TrendingUp, MessageSquare, PhoneCall,
  Play, Pause, FileSignature, ChevronLeft, Layers, Cpu, GaugeCircle,
  Radio, Fingerprint, BarChart3, Bot, Wand2
} from 'lucide-react'
import { AuthFlow, VoiceMode, GlobalSearch, DetailView, CreateModalHost, useOpenCreate, NotificationsHost, useOpenNotifications } from '@/components/atlas-features'

/* ------------------------------------------------------------------ */
/*  ATLAS LOGO                                                        */
/* ------------------------------------------------------------------ */
const AtlasLogo = ({ size = 24 }) => (
  <div
    className="relative flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <img
      src="/atlas-logo.png"
      alt="Atlas"
      style={{ width: size, height: size }}
      className="relative z-10 object-contain"
      draggable={false}
    />
    <div className="absolute inset-0 blur-xl opacity-40 rounded-full"
         style={{ background: 'radial-gradient(circle, #00E6FF, transparent 70%)' }} />
  </div>
)

/* ------------------------------------------------------------------ */
/*  MOCK DATA (realistic restoration industry data)                   */
/* ------------------------------------------------------------------ */
const ROUTES = [
  { key: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { key: 'intelligence',label: 'Intelligence', icon: Sparkles },
  { key: 'claims',      label: 'Claims',       icon: FolderOpen },
  { key: 'supplements', label: 'Supplements',  icon: FileStack },
  { key: 'documents',   label: 'Documents',    icon: FileText },
  { key: 'adjusters',   label: 'Adjusters',    icon: UserSquare2 },
  { key: 'interviews',  label: 'Interviews',   icon: Mic },
  { key: 'properties',  label: 'Properties',   icon: Building2 },
  { key: 'tasks',       label: 'Tasks',        icon: ListChecks },
  { key: 'activity',    label: 'Activity',     icon: ActivityIcon },
  { key: 'companies',   label: 'Companies',    icon: Briefcase },
  { key: 'contacts',    label: 'Contacts',     icon: Users },
  { key: 'users',       label: 'Users',        icon: UserCog },
  { key: 'settings',    label: 'Settings',     icon: Settings },
]

const RECENT_CLAIMS = [
  { id: 'NPP-2026-0848', carrier: 'State Farm',        status: 'In Progress',      revenue: 5200, supplement: 8420, updated: '2m ago' },
  { id: 'NPP-2026-0837', carrier: 'Allstate',          status: 'Pending Review',   revenue: 3150, supplement: 6780, updated: '15m ago' },
  { id: 'NPP-2026-0821', carrier: 'Farmers Insurance', status: 'Documentation',    revenue: 2940, supplement: 4120, updated: '1h ago' },
  { id: 'NPP-2026-0815', carrier: 'USAA',              status: 'Carrier Response', revenue: 1850, supplement: 3210, updated: '2h ago' },
  { id: 'NPP-2026-0803', carrier: 'Liberty Mutual',    status: 'Approved',         revenue: 0,    supplement: 0,    updated: '1d ago' },
  { id: 'NPP-2026-0798', carrier: 'Nationwide',        status: 'In Progress',      revenue: 7420, supplement: 12150, updated: '1d ago' },
  { id: 'NPP-2026-0791', carrier: 'Travelers',         status: 'Pending Review',   revenue: 4680, supplement: 7290,  updated: '2d ago' },
  { id: 'NPP-2026-0786', carrier: 'Progressive',       status: 'Documentation',    revenue: 2100, supplement: 3540,  updated: '2d ago' },
]

const STATUS_STYLES = {
  'In Progress':      { text: '#00E6FF', ring: 'rgba(0,230,255,0.25)' },
  'Pending Review':   { text: '#A855F7', ring: 'rgba(168,85,247,0.25)' },
  'Documentation':    { text: '#00E6FF', ring: 'rgba(0,230,255,0.25)' },
  'Carrier Response': { text: '#F59E0B', ring: 'rgba(245,158,11,0.25)' },
  'Approved':         { text: '#22C55E', ring: 'rgba(34,197,94,0.25)' },
  'Denied':           { text: '#EF4444', ring: 'rgba(239,68,68,0.25)' },
  'Draft':            { text: '#94A3B8', ring: 'rgba(148,163,184,0.25)' },
}

const CARRIERS = ['State Farm','Allstate','Farmers Insurance','USAA','Liberty Mutual','Nationwide','Travelers','Progressive','American Family']

const DAMAGE_TYPES = [
  { type: 'Storm / Hail',   icon: Cloud,    color: '#00E6FF' },
  { type: 'Fire',           icon: Flame,    color: '#F59E0B' },
  { type: 'Water',          icon: Droplets, color: '#3B82F6' },
  { type: 'Wind',           icon: Wind,     color: '#A855F7' },
]

/* ------------------------------------------------------------------ */
/*  PRIMITIVE UI                                                      */
/* ------------------------------------------------------------------ */
const GlassCard = ({ children, className = '', tone, onClick, ...rest }) => {
  const toneClass =
    tone === 'cyan'   ? 'glow-cyan' :
    tone === 'purple' ? 'glow-purple' :
    tone === 'green'  ? 'glow-green' : ''
  return (
    <div onClick={onClick} className={`glass rounded-2xl ${toneClass} ${onClick ? 'cursor-pointer' : ''} ${className}`} {...rest}>{children}</div>
  )
}

const Sparkline = ({ color = '#00E6FF', seed = 1, className = '' }) => {
  // deterministic pseudo sparkline
  const pts = useMemo(() => {
    const n = 40
    const arr = []
    let v = 20 + (seed * 7) % 15
    for (let i = 0; i < n; i++) {
      v += Math.sin(i * 0.5 + seed) * 3 + ((i * seed) % 5) - 2
      arr.push(Math.max(5, Math.min(45, v)))
    }
    return arr
  }, [seed])
  const path = pts.map((y, i) => `${i === 0 ? 'M' : 'L'} ${(i / (pts.length - 1)) * 200} ${50 - y}`).join(' ')
  const areaPath = `${path} L 200 50 L 0 50 Z`
  const id = `spk-${seed}-${color.replace('#','')}`
  return (
    <svg viewBox="0 0 200 50" className={`w-full h-14 ${className}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES['Draft']
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide"
      style={{
        color: s.text,
        background: `${s.text}12`,
        border: `1px solid ${s.ring}`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.text, boxShadow: `0 0 8px ${s.text}` }} />
      {status}
    </span>
  )
}

const Kbd = ({ children }) => <span className="kbd">{children}</span>

const SectionLabel = ({ children, className = '' }) => (
  <div className={`text-[10px] font-semibold tracking-[0.18em] text-cyan-400/80 uppercase ${className}`}>
    {children}
  </div>
)

/* ------------------------------------------------------------------ */
/*  SIDEBAR + TOPBAR SHELL                                            */
/* ------------------------------------------------------------------ */
const Sidebar = ({ active, setActive, mobileOpen, onCloseMobile }) => (
  <>
    {/* Mobile backdrop */}
    <div
      onClick={onCloseMobile}
      className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    />
    <aside className={`
      w-[260px] shrink-0 h-screen border-r border-white/5 bg-[#05070d]/95 backdrop-blur-xl flex flex-col
      fixed lg:sticky top-0 z-50 transition-transform duration-300
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
    `}>
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <AtlasLogo size={26} />
        <div className="text-[13px] font-semibold tracking-[0.22em] text-white/90">
          ATLAS <span className="text-white/40 font-medium">INTELLIGENCE</span>
        </div>
      </div>

      <div className="px-3 mt-2 flex-1 overflow-y-auto">
        <nav className="space-y-0.5">
          {ROUTES.map(({ key, label, icon: Icon }) => {
            const isActive = key === active
            return (
              <button
                key={key}
                onClick={() => { setActive(key); onCloseMobile?.() }}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] transition-all relative ${
                  isActive
                    ? 'text-white bg-white/[0.04] border border-white/[0.06]'
                    : 'text-white/55 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-gradient-to-b from-cyan-400 to-blue-500" />
                )}
                <Icon
                  size={17}
                  strokeWidth={1.75}
                  className={isActive ? 'text-cyan-400' : 'text-white/45 group-hover:text-white/80'}
                />
                <span className="font-medium">{label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-white/5">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
            <Building2 size={15} className="text-cyan-300" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12.5px] font-medium text-white leading-tight">NPP Roofing &amp; Restoration</div>
            <div className="text-[10.5px] text-white/40">Company</div>
          </div>
          <ChevronDown size={14} className="text-white/40" />
        </button>
      </div>
    </aside>
  </>
)

const TopBar = ({ title, subtitle, eyebrow, create }) => {
  const openCreate = useOpenCreate()
  const openNotif = useOpenNotifications()
  const onOpenSidebar = useOpenSidebar()
  return (
  <div className="flex items-start justify-between gap-4 pt-6 lg:pt-8 pb-6 flex-wrap">
    <div className="max-w-3xl flex items-start gap-3 min-w-0">
      <button
        onClick={onOpenSidebar}
        className="lg:hidden mt-1 w-9 h-9 rounded-full glass border border-white/[0.06] flex items-center justify-center shrink-0"
        aria-label="Open menu"
      >
        <Layers size={15} className="text-white/70" />
      </button>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[13px] font-medium mb-2 lg:mb-3 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-wide">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[26px] sm:text-[32px] lg:text-[38px] leading-[1.1] font-semibold text-white tracking-[-0.02em]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 lg:mt-3 text-[13.5px] lg:text-[15px] text-white/50 max-w-2xl">{subtitle}</p>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 lg:gap-3 pt-1 flex-wrap">
      {create && (
        <button
          onClick={() => openCreate(create)}
          className="px-3.5 py-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-semibold text-[13px] flex items-center gap-1.5 glow-cyan hover:opacity-90 transition"
        >
          <Plus size={14} strokeWidth={2.5} /> {create.label || `New ${create.entity}`}
        </button>
      )}
      <button className="w-9 h-9 rounded-full glass flex items-center justify-center hover:bg-white/[0.06] transition">
        <Search size={16} className="text-white/70" />
      </button>
      <button
        onClick={() => openNotif(true)}
        className="w-9 h-9 rounded-full glass flex items-center justify-center hover:bg-white/[0.06] transition relative"
      >
        <Bell size={16} className="text-white/70" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-atlas-pulse" />
      </button>
      <div className="flex items-center gap-2.5 pl-2">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-[11px] font-bold text-black">
          MR
        </div>
        <div className="hidden md:block leading-tight">
          <div className="text-[13px] font-medium text-white">Melissa October</div>
          <div className="text-[11px] text-white/40">NPP Roofing &amp; Restor…</div>
        </div>
        <ChevronDown size={14} className="text-white/40 hidden md:block" />
      </div>
    </div>
  </div>
  )
}

/* ------------------------------------------------------------------ */
/*  DASHBOARD                                                         */
/* ------------------------------------------------------------------ */
const StatCard = ({ label, value, color, seed, valueClass = '' }) => (
  <GlassCard className="p-5">
    <div className="text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
      {label}
    </div>
    <div className={`mt-3 text-[36px] leading-none font-semibold tracking-tight ${valueClass}`}
         style={{ color }}>
      {value}
    </div>
    <div className="mt-4">
      <Sparkline color={color} seed={seed} />
    </div>
  </GlassCard>
)

const ClaimIntelligenceCard = () => (
  <GlassCard className="p-6 relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none opacity-60"
         style={{ background: 'radial-gradient(600px 200px at 0% 0%, rgba(0,230,255,0.06), transparent 60%)' }} />
    <div className="flex items-center justify-between relative">
      <div className="flex items-center gap-2">
        <AtlasLogo size={16} />
        <SectionLabel>Claim Intelligence</SectionLabel>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-cyan-400">
        <span className="relative flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-cyan-400 opacity-60 animate-atlas-pulse" />
          <span className="relative rounded-full bg-cyan-400 w-2 h-2" />
        </span>
        scanning
      </div>
    </div>

    <div className="mt-6 relative">
      <div className="flex items-center justify-between text-[10px] tracking-[0.18em] text-white/40 font-semibold uppercase">
        <span>Claim #ATL-2847</span>
        <span>Potential Supplement</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="text-[28px] font-semibold text-white tracking-tight leading-tight">
          Residential Storm Damage
        </div>
        <div className="text-[32px] font-semibold gradient-text leading-none">$8,420</div>
      </div>
    </div>

    <div className="mt-6">
      <SectionLabel className="text-white/40">Signals</SectionLabel>
      <ul className="mt-3 space-y-2">
        {['Missing documentation','Estimate discrepancy detected','Adjuster delay pattern','3 unsupported line items'].map((s,i) => (
          <li key={i} className="flex items-center gap-3 text-[13.5px] text-white/80 rounded-lg px-3 py-2 bg-white/[0.02] border border-white/[0.04]">
            <span className="w-1 h-1 rounded-full bg-cyan-400" />
            {s}
          </li>
        ))}
      </ul>
    </div>

    <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
      <SectionLabel>Recommended Action</SectionLabel>
      <div className="mt-1.5 text-[13.5px] text-white/85">
        Prepare documentation review before supplement submission.
      </div>
    </div>
  </GlassCard>
)

const AskAtlasCard = () => {
  const [input, setInput] = useState('')
  return (
    <GlassCard className="p-6 relative overflow-hidden flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AtlasLogo size={16} />
          <SectionLabel>Ask Atlas</SectionLabel>
        </div>
        <div className="text-[11px] text-white/40 font-mono">
          context: 97 claims · 134 supplements
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="rounded-2xl rounded-tr-md bg-white/[0.04] border border-white/[0.06] px-4 py-2.5 text-[13.5px] text-white/90 max-w-[75%]">
          Where is revenue getting stuck?
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <div className="mt-1 shrink-0"><AtlasLogo size={20} /></div>
        <div className="text-[14px] text-white/85 leading-relaxed">
          <span className="text-cyan-400 font-semibold">$42,380</span> in potential revenue is currently associated with <span className="text-white font-medium">18 unresolved supplement opportunities.</span>
          <div className="mt-4">
            <SectionLabel>Primary Patterns Detected</SectionLabel>
            <ul className="mt-2 space-y-1.5 text-[13.5px] text-white/75">
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-cyan-400" />Missing documentation</li>
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-cyan-400" />Estimate discrepancies</li>
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-cyan-400" />Repeated adjuster delays</li>
            </ul>
          </div>
          <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
            <SectionLabel>Recommended Action</SectionLabel>
            <div className="mt-1.5 text-[13.5px] text-white">Review the 6 highest-value claims first.</div>
          </div>
        </div>
      </div>

      <div className="mt-5 relative">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Atlas anything…"
          className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3.5 pr-12 text-[13.5px] text-white placeholder:text-white/30 outline-none focus:border-cyan-400/40 transition"
        />
        <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-black hover:opacity-90">
          <Send size={14} />
        </button>
      </div>
    </GlassCard>
  )
}

const RecentClaims = () => {
  const openDetail = useOpenDetail()
  return (
  <GlassCard className="p-6">
    <div className="flex items-center justify-between">
      <SectionLabel className="text-white/40">Recent Claims</SectionLabel>
      <button className="text-[12px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
        View all claims <ArrowRight size={12} />
      </button>
    </div>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] tracking-[0.18em] text-white/35 uppercase">
            <th className="py-2 font-semibold">Claim</th>
            <th className="py-2 font-semibold">Status</th>
            <th className="py-2 font-semibold">Revenue at Risk</th>
            <th className="py-2 font-semibold">Potential Supplement</th>
            <th className="py-2 font-semibold">Updated</th>
            <th className="py-2 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {RECENT_CLAIMS.slice(0,5).map((c, i) => (
            <tr key={c.id}
                onClick={() => openDetail({ kind: 'claim', id: c.id })}
                className="border-t border-white/[0.04] hover:bg-white/[0.02] transition cursor-pointer">
              <td className="py-3.5">
                <div className="text-[13px] font-medium text-white">{c.id}</div>
                <div className="text-[11px] text-white/40">{c.carrier}</div>
              </td>
              <td className="py-3.5"><StatusBadge status={c.status} /></td>
              <td className="py-3.5 text-[13px] text-white/85 font-mono">${c.revenue.toLocaleString()}</td>
              <td className="py-3.5 text-[13px] font-mono text-cyan-400">${c.supplement.toLocaleString()}</td>
              <td className="py-3.5 text-[12px] text-white/50">{c.updated}</td>
              <td className="py-3.5 text-right">
                <button className="text-white/40 hover:text-white"><MoreHorizontal size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </GlassCard>
  )
}

const DashboardPage = () => (
  <>
    <TopBar
      eyebrow="Executive Intelligence"
      title="This week’s operational signal"
      subtitle="AI-powered insights across your claims and supplements"
    />
    <div className="flex items-center gap-3 -mt-2 mb-6 text-[11px] text-white/50">
      <span>Updated 2m ago</span>
      <span className="w-1 h-1 rounded-full bg-white/20" />
      <span className="flex items-center gap-1.5 text-cyan-400">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-atlas-pulse" /> LIVE
      </span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      <StatCard label="Revenue at Risk"        value="$42,380"  color="#00E6FF" seed={2} />
      <StatCard label="Supplements Pending"    value="18"       color="#A855F7" seed={5} />
      <StatCard label="Claims Need Attention"  value="6"        color="#00E6FF" seed={8} />
      <StatCard label="Recovered Opportunity"  value="$127,500" color="#22C55E" seed={11} />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
      <ClaimIntelligenceCard />
      <AskAtlasCard />
    </div>

    <div className="mt-5">
      <RecentClaims />
    </div>
    <div className="h-16" />
  </>
)

/* ------------------------------------------------------------------ */
/*  INTELLIGENCE PAGE                                                 */
/* ------------------------------------------------------------------ */
const IntelligencePage = () => {
  const insights = [
    { title: 'Supplement approval trending up', body: 'Approval rate improved 12% week over week across carrier responses.', color: '#22C55E', icon: TrendingUp },
    { title: 'State Farm response latency', body: 'Average response time increased to 6.4 days. 3 claims exceed SLA.', color: '#F59E0B', icon: Clock },
    { title: 'Document gap detected', body: '4 claims are missing roof measurement reports before submission.', color: '#00E6FF', icon: FileSignature },
    { title: 'Adjuster pattern insight', body: 'M. Reynolds typically requests supplementary photos before approval.', color: '#A855F7', icon: Fingerprint },
  ]
  return (
    <>
      <TopBar
        eyebrow="Atlas Intelligence"
        title="Ambient signal from your operation"
        subtitle="Live reasoning across claims, adjusters, documents and carrier behavior."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <GlassCard className="p-6">
            <div className="flex items-center gap-2">
              <AtlasLogo size={16} />
              <SectionLabel>Weekly Briefing</SectionLabel>
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-white tracking-tight">
              Your revenue is <span className="gradient-text">accelerating</span>, but 6 claims are silently drifting.
            </h3>
            <p className="mt-3 text-[14px] text-white/60 leading-relaxed max-w-2xl">
              Atlas analyzed 97 active claims and detected consistent adjuster response latency
              from three carriers. Recovered opportunity is up <span className="text-emerald-400">$18,400</span> this
              week, while <span className="text-cyan-400">$42,380</span> remains blocked by documentation gaps.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { k: 'Signals processed', v: '2,847' },
                { k: 'Actions suggested', v: '31' },
                { k: 'Time reclaimed', v: '14.2h' },
              ].map(x => (
                <div key={x.k} className="rounded-xl border border-white/[0.06] p-4 bg-white/[0.02]">
                  <div className="text-[10px] tracking-[0.18em] text-white/40 uppercase">{x.k}</div>
                  <div className="mt-2 text-2xl font-semibold gradient-text-soft">{x.v}</div>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {insights.map(i => {
              const Ic = i.icon
              return (
                <GlassCard key={i.title} className="p-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                         style={{ background: `${i.color}18`, border: `1px solid ${i.color}30` }}>
                      <Ic size={15} style={{ color: i.color }} />
                    </div>
                    <SectionLabel className="!text-white/40">Insight</SectionLabel>
                  </div>
                  <div className="mt-3 text-[15px] font-semibold text-white">{i.title}</div>
                  <div className="mt-1.5 text-[13px] text-white/55 leading-relaxed">{i.body}</div>
                </GlassCard>
              )
            })}
          </div>
        </div>

        <div className="space-y-5">
          <GlassCard className="p-6" tone="cyan">
            <SectionLabel>Atlas Focus</SectionLabel>
            <div className="mt-3 text-[15px] text-white/90 leading-relaxed">
              Focus on <span className="text-cyan-400 font-semibold">6 supplements above $4K</span> to unlock the biggest recovered opportunity this week.
            </div>
            <button className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-semibold text-[13px] py-3 hover:opacity-90 transition flex items-center justify-center gap-2">
              Start focus session <ArrowRight size={14} />
            </button>
          </GlassCard>

          <GlassCard className="p-6">
            <SectionLabel>Live signal</SectionLabel>
            <div className="mt-4 space-y-3">
              {[
                { t: 'New estimate uploaded', s: 'ATL-2847', c: '#00E6FF' },
                { t: 'Adjuster replied to supplement', s: 'ATL-2841', c: '#22C55E' },
                { t: 'Document mismatch flagged', s: 'ATL-2839', c: '#F59E0B' },
                { t: 'Photo evidence added', s: 'ATL-2836', c: '#A855F7' },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full animate-atlas-pulse" style={{ background: r.c, boxShadow: `0 0 8px ${r.c}` }} />
                  <div className="flex-1">
                    <div className="text-[13px] text-white/85">{r.t}</div>
                    <div className="text-[11px] text-white/40 font-mono">{r.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
      <div className="h-16" />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  CLAIMS PAGE                                                       */
/* ------------------------------------------------------------------ */
const CLAIM_FILTERS = ['All','In Progress','Pending Review','Documentation','Carrier Response','Approved']
const CLAIMS_FULL = [
  ...RECENT_CLAIMS,
  { id: 'NPP-2026-0780', carrier: 'American Family', status: 'In Progress',    revenue: 3820, supplement: 5640, updated: '3d ago' },
  { id: 'NPP-2026-0774', carrier: 'State Farm',      status: 'Approved',       revenue: 0,    supplement: 0,    updated: '4d ago' },
  { id: 'NPP-2026-0768', carrier: 'Allstate',        status: 'Denied',         revenue: 6120, supplement: 9800, updated: '5d ago' },
]
const ClaimsPage = () => {
  const [filter, setFilter] = useState('All')
  const openDetail = useOpenDetail()
  const filtered = filter === 'All' ? CLAIMS_FULL : CLAIMS_FULL.filter(c => c.status === filter)
  return (
    <>
      <TopBar eyebrow="Claims" title="All active claims" subtitle="97 open · 34 in review · $312,480 total revenue at risk" create={{ entity: 'Claim', label: 'New Claim', icon: FolderOpen }} />

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-1.5 p-1 rounded-xl glass">
          {CLAIM_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] transition ${
                filter === f ? 'bg-white/[0.06] text-white' : 'text-white/50 hover:text-white'
              }`}>{f}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input placeholder="Search claims…" className="pl-9 pr-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[13px] outline-none focus:border-cyan-400/40 w-64" />
          </div>
          <button className="px-3 py-2 rounded-lg glass text-[13px] text-white/70 flex items-center gap-2">
            <Filter size={13} /> Filters
          </button>
        </div>
      </div>

      <GlassCard className="p-2">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] tracking-[0.18em] text-white/35 uppercase">
              <th className="p-4 font-semibold">Claim</th>
              <th className="p-4 font-semibold">Carrier</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Revenue at Risk</th>
              <th className="p-4 font-semibold">Supplement</th>
              <th className="p-4 font-semibold">Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}
                  onClick={() => openDetail({ kind: 'claim', id: c.id })}
                  className="border-t border-white/[0.04] hover:bg-white/[0.02] transition cursor-pointer">
                <td className="p-4">
                  <div className="text-[13.5px] font-medium text-white font-mono">{c.id}</div>
                </td>
                <td className="p-4 text-[13px] text-white/70">{c.carrier}</td>
                <td className="p-4"><StatusBadge status={c.status} /></td>
                <td className="p-4 text-[13px] font-mono text-white/85">${c.revenue.toLocaleString()}</td>
                <td className="p-4 text-[13px] font-mono text-cyan-400">${c.supplement.toLocaleString()}</td>
                <td className="p-4 text-[12px] text-white/50">{c.updated}</td>
                <td className="p-4 text-right"><ChevronRight size={16} className="text-white/30" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
      <div className="h-16" />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  SUPPLEMENTS PAGE                                                  */
/* ------------------------------------------------------------------ */
const SUPPLEMENTS = [
  { id: 'SUP-9142', claim: 'NPP-2026-0848', amount: 8420, status: 'Pending Review',   confidence: 92, carrier: 'State Farm' },
  { id: 'SUP-9138', claim: 'NPP-2026-0837', amount: 6780, status: 'In Progress',      confidence: 88, carrier: 'Allstate' },
  { id: 'SUP-9131', claim: 'NPP-2026-0821', amount: 4120, status: 'Documentation',    confidence: 74, carrier: 'Farmers Insurance' },
  { id: 'SUP-9126', claim: 'NPP-2026-0815', amount: 3210, status: 'Carrier Response', confidence: 81, carrier: 'USAA' },
  { id: 'SUP-9120', claim: 'NPP-2026-0798', amount: 12150,status: 'In Progress',      confidence: 95, carrier: 'Nationwide' },
  { id: 'SUP-9115', claim: 'NPP-2026-0791', amount: 7290, status: 'Pending Review',   confidence: 87, carrier: 'Travelers' },
]
const SupplementsPage = () => {
  const openDetail = useOpenDetail()
  return (
  <>
    <TopBar eyebrow="Supplements" title="Recovery opportunities" subtitle="18 pending · $127,500 recovered · 87% avg confidence" create={{ entity: 'Supplement', label: 'Create Supplement', icon: FileStack }} />

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
      <StatCard label="Total Pending"     value="18"        color="#A855F7" seed={3} />
      <StatCard label="Avg Confidence"    value="87%"       color="#00E6FF" seed={6} />
      <StatCard label="Recovered YTD"     value="$412,900"  color="#22C55E" seed={9} />
    </div>

    <GlassCard className="p-2">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] tracking-[0.18em] text-white/35 uppercase">
            <th className="p-4 font-semibold">Supplement</th>
            <th className="p-4 font-semibold">Linked Claim</th>
            <th className="p-4 font-semibold">Carrier</th>
            <th className="p-4 font-semibold">Amount</th>
            <th className="p-4 font-semibold">Confidence</th>
            <th className="p-4 font-semibold">Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {SUPPLEMENTS.map(s => (
            <tr key={s.id}
                onClick={() => openDetail({ kind: 'supplement', id: s.id })}
                className="border-t border-white/[0.04] hover:bg-white/[0.02] transition cursor-pointer">
              <td className="p-4 text-[13px] font-mono text-white">{s.id}</td>
              <td className="p-4 text-[13px] font-mono text-white/70">{s.claim}</td>
              <td className="p-4 text-[13px] text-white/70">{s.carrier}</td>
              <td className="p-4 text-[13px] font-mono gradient-text font-semibold">${s.amount.toLocaleString()}</td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${s.confidence}%` }} />
                  </div>
                  <span className="text-[12px] text-white/60 font-mono">{s.confidence}%</span>
                </div>
              </td>
              <td className="p-4"><StatusBadge status={s.status} /></td>
              <td className="p-4 text-right"><ChevronRight size={16} className="text-white/30" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
    <div className="h-16" />
  </>
  )
}

/* ------------------------------------------------------------------ */
/*  DOCUMENTS PAGE                                                    */
/* ------------------------------------------------------------------ */
const DOCUMENTS = [
  { name: 'Roof Measurement Report.pdf', size: '2.4 MB', tag: 'Estimate',       claim: 'NPP-2026-0848', ago: '2m' },
  { name: 'Adjuster Photos - East.zip',  size: '48.2 MB',tag: 'Photo Evidence', claim: 'NPP-2026-0848', ago: '18m' },
  { name: 'Xactimate Estimate v3.xml',   size: '340 KB', tag: 'Estimate',       claim: 'NPP-2026-0837', ago: '1h' },
  { name: 'Carrier Response Letter.pdf', size: '180 KB', tag: 'Correspondence', claim: 'NPP-2026-0821', ago: '3h' },
  { name: 'Signed AOB.pdf',              size: '90 KB',  tag: 'Legal',          claim: 'NPP-2026-0815', ago: '5h' },
  { name: 'Weather Verification.pdf',    size: '220 KB', tag: 'Evidence',       claim: 'NPP-2026-0798', ago: '1d' },
]
const DocumentsPage = () => {
  const openDetail = useOpenDetail()
  return (
  <>
    <TopBar eyebrow="Documents" title="Everything your claims need" subtitle="Automatically indexed, tagged, and linked to the right claim." create={{ entity: 'Document', label: 'Upload Document', icon: FileText }} />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {DOCUMENTS.map(d => (
        <GlassCard key={d.name}
          onClick={() => openDetail({ kind: 'document', id: d.name })}
          className="p-5 hover:bg-white/[0.03] transition group cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/[0.06] flex items-center justify-center">
              <FileText size={18} className="text-cyan-300" />
            </div>
            <button className="text-white/40 opacity-0 group-hover:opacity-100 transition"><MoreHorizontal size={16} /></button>
          </div>
          <div className="mt-4 text-[14px] font-medium text-white">{d.name}</div>
          <div className="mt-1 text-[12px] text-white/40 font-mono">{d.claim} · {d.size}</div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[10px] tracking-[0.14em] uppercase font-semibold text-cyan-400/80 px-2 py-1 rounded-md bg-cyan-400/[0.06] border border-cyan-400/20">{d.tag}</span>
            <div className="flex items-center gap-1.5 text-white/40">
              <button className="w-7 h-7 rounded-md hover:bg-white/[0.04] flex items-center justify-center"><Eye size={13} /></button>
              <button className="w-7 h-7 rounded-md hover:bg-white/[0.04] flex items-center justify-center"><Download size={13} /></button>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-white/35">{d.ago} ago</div>
        </GlassCard>
      ))}
    </div>
    <div className="h-16" />
  </>
  )
}

/* ------------------------------------------------------------------ */
/*  ADJUSTERS PAGE                                                    */
/* ------------------------------------------------------------------ */
const ADJUSTERS = [
  { name: 'M. Reynolds',    type: 'Independent Adjuster', region: 'Southeast region', response: 6.1, approval: 68, scrutiny: 'High',   claims: 14 },
  { name: 'J. Kowalski',    type: 'Staff Adjuster',       region: 'Midwest region',   response: 3.4, approval: 82, scrutiny: 'Medium', claims: 22 },
  { name: 'A. Chen',        type: 'Independent Adjuster', region: 'West region',      response: 4.2, approval: 71, scrutiny: 'Medium', claims: 18 },
  { name: 'D. Alvarez',     type: 'Staff Adjuster',       region: 'Northeast region', response: 2.8, approval: 88, scrutiny: 'Low',    claims: 27 },
  { name: 'S. Patel',       type: 'Independent Adjuster', region: 'Southwest region', response: 7.6, approval: 61, scrutiny: 'High',   claims: 11 },
  { name: 'K. Martins',     type: 'Staff Adjuster',       region: 'Southeast region', response: 3.1, approval: 79, scrutiny: 'Medium', claims: 19 },
]
const AdjusterCard = ({ a }) => {
  const openDetail = useOpenDetail()
  const scrutinyColor = a.scrutiny === 'High' ? '#A855F7' : a.scrutiny === 'Medium' ? '#F59E0B' : '#22C55E'
  return (
    <GlassCard onClick={() => openDetail({ kind: 'adjuster', id: a.name })} className="p-6 hover:bg-white/[0.03] transition">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AtlasLogo size={16} />
          <SectionLabel>Adjuster Intelligence</SectionLabel>
        </div>
        <div className="text-[11px] text-white/40 font-mono">{a.claims} historical claims</div>
      </div>
      <div className="mt-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400/40 to-blue-500/40 flex items-center justify-center text-[13px] font-bold text-white border border-white/10">
          {a.name.split(' ').map(n => n[0]).join('').slice(0,2)}
        </div>
        <div>
          <div className="text-[22px] font-semibold text-white leading-tight">{a.name}</div>
          <div className="text-[12.5px] text-white/50">{a.type} · {a.region}</div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.06] p-3 bg-white/[0.02]">
          <div className="text-[26px] font-semibold text-cyan-400 leading-none">{a.response}</div>
          <div className="mt-2 text-[10px] tracking-[0.14em] uppercase font-semibold text-white/40">Avg response (d)</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-3 bg-white/[0.02]">
          <div className="text-[26px] font-semibold text-emerald-400 leading-none">{a.approval}%</div>
          <div className="mt-2 text-[10px] tracking-[0.14em] uppercase font-semibold text-white/40">Approval rate</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-3 bg-white/[0.02]">
          <div className="text-[22px] font-semibold leading-none" style={{ color: scrutinyColor }}>{a.scrutiny}</div>
          <div className="mt-2 text-[10px] tracking-[0.14em] uppercase font-semibold text-white/40">Doc scrutiny</div>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
        <SectionLabel>Atlas Memory</SectionLabel>
        <div className="mt-1.5 text-[13.5px] text-white/85 leading-relaxed">
          {a.scrutiny === 'High'
            ? 'Typically requests supplementary photos before approving roofing supplements over $4,000.'
            : a.scrutiny === 'Medium'
            ? 'Prefers documented weather verification for hail claims — attach report early.'
            : 'Fast approver on well-documented claims. Focus on clean estimates and photos.'}
        </div>
      </div>
    </GlassCard>
  )
}
const AdjustersPage = () => (
  <>
    <TopBar eyebrow="Adjusters" title="Know every adjuster before you call" subtitle="Atlas learns each adjuster's approval patterns from your history." create={{ entity: 'Adjuster', label: 'Add Adjuster', icon: UserSquare2 }} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {ADJUSTERS.map(a => <AdjusterCard key={a.name} a={a} />)}
    </div>
    <div className="h-16" />
  </>
)

/* ------------------------------------------------------------------ */
/*  INTERVIEWS PAGE                                                   */
/* ------------------------------------------------------------------ */
const INTERVIEWS = [
  { id: 'INT-482', name: 'Homeowner intake — J. Robertson', duration: '11:42', ago: 'today', status: 'Transcribed', tags: ['Storm','Roof'] },
  { id: 'INT-481', name: 'Adjuster call — M. Reynolds',     duration: '18:03', ago: 'today', status: 'Analyzing',   tags: ['Supplement'] },
  { id: 'INT-480', name: 'Property walkthrough — 214 Oak',  duration: '24:17', ago: 'yesterday', status: 'Complete', tags: ['Photos','Notes'] },
  { id: 'INT-479', name: 'Homeowner intake — S. Bianchi',   duration: '09:28', ago: '2d ago', status: 'Complete', tags: ['Water'] },
]
const InterviewsPage = () => {
  const openDetail = useOpenDetail()
  return (
  <>
    <TopBar eyebrow="Interviews" title="Recorded conversations, understood" subtitle="Atlas transcribes, extracts facts, and flags what matters — automatically." create={{ entity: 'Interview', label: 'Start Interview', icon: Mic }} />

    <GlassCard className="p-6 mb-5">
      <div className="flex items-center gap-4">
        <button className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center hover:opacity-90 transition glow-cyan">
          <Mic size={20} className="text-black" />
        </button>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-white">Start a new interview</div>
          <div className="text-[12.5px] text-white/50">Atlas will transcribe, tag, and link findings to the correct claim.</div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-cyan-400 px-3 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.04]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-atlas-pulse" />
          Ready
        </div>
      </div>
    </GlassCard>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {INTERVIEWS.map(i => (
        <GlassCard key={i.id}
          onClick={() => openDetail({ kind: 'interview', id: i.id })}
          className="p-5 hover:bg-white/[0.03] transition">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <button className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <Play size={13} className="text-cyan-300 ml-0.5" />
              </button>
              <div>
                <div className="text-[14px] font-medium text-white">{i.name}</div>
                <div className="text-[11.5px] text-white/40 font-mono mt-0.5">{i.id} · {i.duration} · {i.ago}</div>
              </div>
            </div>
            <StatusBadge status={i.status === 'Complete' ? 'Approved' : i.status === 'Analyzing' ? 'In Progress' : 'Documentation'} />
          </div>
          <div className="mt-4 h-12 flex items-center gap-[3px]">
            {Array.from({ length: 48 }).map((_, k) => {
              const h = 6 + Math.abs(Math.sin(k * (i.id.charCodeAt(4) || 4))) * 30
              return <span key={k} className="w-[3px] rounded-full bg-gradient-to-t from-cyan-400/60 to-blue-500/60" style={{ height: `${h}px` }} />
            })}
          </div>
          <div className="mt-4 flex items-center gap-2">
            {i.tags.map(t => (
              <span key={t} className="text-[10.5px] tracking-[0.14em] uppercase font-semibold text-white/50 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">{t}</span>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
    <div className="h-16" />
  </>
  )
}

/* ------------------------------------------------------------------ */
/*  PROPERTIES PAGE                                                   */
/* ------------------------------------------------------------------ */
const PROPERTIES = [
  { addr: '2847 Willow Bend Ln',   city: 'Charlotte, NC',   type: 'Residential', damage: 'Storm / Hail', claims: 2, value: 8420 },
  { addr: '412 Harbor Point Dr',   city: 'Tampa, FL',       type: 'Residential', damage: 'Wind',         claims: 1, value: 6780 },
  { addr: '1180 Mountain Vista Rd',city: 'Asheville, NC',   type: 'Commercial',  damage: 'Water',        claims: 3, value: 4120 },
  { addr: '89 Cedar Falls Way',    city: 'Raleigh, NC',     type: 'Residential', damage: 'Fire',         claims: 1, value: 12150 },
  { addr: '3401 Riverside Blvd',   city: 'Nashville, TN',   type: 'Residential', damage: 'Storm / Hail', claims: 1, value: 3210 },
  { addr: '650 Innovation Pkwy',   city: 'Atlanta, GA',     type: 'Commercial',  damage: 'Wind',         claims: 2, value: 7290 },
]
const PropertiesPage = () => {
  const openDetail = useOpenDetail()
  return (
  <>
    <TopBar eyebrow="Properties" title="Every roof under your care" subtitle="Cross-referenced with claim history, weather events, and inspection notes." create={{ entity: 'Property', label: 'Add Property', icon: Building2 }} />
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {PROPERTIES.map((p, i) => {
        const dt = DAMAGE_TYPES.find(d => d.type === p.damage) || DAMAGE_TYPES[0]
        const DIcon = dt.icon
        return (
          <GlassCard key={p.addr}
            onClick={() => openDetail({ kind: 'property', id: p.addr })}
            className="overflow-hidden group hover:bg-white/[0.03] transition">
            <div className="h-32 relative"
                 style={{ background: `radial-gradient(400px 120px at 30% 50%, ${dt.color}22, transparent 70%), linear-gradient(135deg, #0b1220 0%, #050710 100%)` }}>
              <div className="absolute inset-0 opacity-25"
                   style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${dt.color}20`, border: `1px solid ${dt.color}40` }}>
                  <DIcon size={16} style={{ color: dt.color }} />
                </div>
                <div className="text-[10px] tracking-[0.16em] uppercase font-semibold" style={{ color: dt.color }}>{p.damage}</div>
              </div>
              <div className="absolute top-4 right-4 text-[10.5px] tracking-[0.14em] uppercase font-semibold px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] text-white/70">
                {p.type}
              </div>
            </div>
            <div className="p-5">
              <div className="text-[15px] font-semibold text-white">{p.addr}</div>
              <div className="text-[12.5px] text-white/50 flex items-center gap-1.5 mt-1"><MapPin size={11} />{p.city}</div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-white/40">Active claims</div>
                  <div className="text-[18px] font-semibold text-white mt-0.5">{p.claims}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-white/40">Est. supplement</div>
                  <div className="text-[18px] font-semibold gradient-text mt-0.5">${p.value.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </GlassCard>
        )
      })}
    </div>
    <div className="h-16" />
  </>
  )
}

/* ------------------------------------------------------------------ */
/*  TASKS PAGE                                                        */
/* ------------------------------------------------------------------ */
const TASKS = [
  { title: 'Upload roof measurement report',      claim: 'NPP-2026-0848', due: 'Today',    priority: 'High',   done: false },
  { title: 'Follow up with M. Reynolds',          claim: 'NPP-2026-0837', due: 'Today',    priority: 'High',   done: false },
  { title: 'Attach weather verification',         claim: 'NPP-2026-0821', due: 'Tomorrow', priority: 'Medium', done: false },
  { title: 'Submit supplement SUP-9126',          claim: 'NPP-2026-0815', due: 'This week',priority: 'High',   done: false },
  { title: 'Review carrier response letter',      claim: 'NPP-2026-0798', due: 'This week',priority: 'Medium', done: true },
  { title: 'Verify signed AOB is on file',        claim: 'NPP-2026-0791', due: 'Next week',priority: 'Low',    done: true },
]
const priColor = { High: '#EF4444', Medium: '#F59E0B', Low: '#22C55E' }
const TasksPage = () => {
  const openDetail = useOpenDetail()
  return (
  <>
    <TopBar eyebrow="Tasks" title="What Atlas thinks you should do next" subtitle="Ordered by revenue impact and carrier deadlines." create={{ entity: 'Task', label: 'New Task', icon: ListChecks }} />
    <GlassCard className="divide-y divide-white/[0.04]">
      {TASKS.map((t, i) => (
        <div key={i}
          onClick={() => openDetail({ kind: 'task', id: `task-${i}` })}
          className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition cursor-pointer ${t.done ? 'opacity-45' : ''}`}>
          <button className={`w-5 h-5 rounded-full border flex items-center justify-center ${t.done ? 'bg-cyan-400/20 border-cyan-400' : 'border-white/20'}`}>
            {t.done && <CheckCircle2 size={12} className="text-cyan-400" />}
          </button>
          <div className="flex-1">
            <div className={`text-[14px] font-medium ${t.done ? 'line-through text-white/60' : 'text-white'}`}>{t.title}</div>
            <div className="text-[11.5px] text-white/40 mt-0.5 font-mono">{t.claim}</div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-md" style={{ background: `${priColor[t.priority]}18`, color: priColor[t.priority], border: `1px solid ${priColor[t.priority]}30` }}>{t.priority}</span>
            <span className="text-white/50 flex items-center gap-1"><Clock size={11} />{t.due}</span>
          </div>
        </div>
      ))}
    </GlassCard>
    <div className="h-16" />
  </>
  )
}

/* ------------------------------------------------------------------ */
/*  ACTIVITY PAGE                                                     */
/* ------------------------------------------------------------------ */
const ACTIVITY = [
  { t: '2m ago',  who: 'Atlas',        act: 'flagged supplement opportunity on', target: 'NPP-2026-0848', color: '#00E6FF', icon: Sparkles },
  { t: '9m ago',  who: 'Melissa October', act: 'uploaded 12 photos to',           target: 'NPP-2026-0848', color: '#A855F7', icon: FileText },
  { t: '18m ago', who: 'M. Reynolds',  act: 'responded to supplement on',        target: 'NPP-2026-0837', color: '#22C55E', icon: MessageSquare },
  { t: '42m ago', who: 'Atlas',        act: 'transcribed interview',             target: 'INT-482',       color: '#00E6FF', icon: Mic },
  { t: '1h ago',  who: 'D. Alvarez',   act: 'approved claim',                    target: 'NPP-2026-0803', color: '#22C55E', icon: CheckCircle2 },
  { t: '2h ago',  who: 'Atlas',        act: 'detected document gap on',          target: 'NPP-2026-0821', color: '#F59E0B', icon: AlertTriangle },
  { t: '3h ago',  who: 'J. Kowalski',  act: 'requested additional evidence for', target: 'NPP-2026-0791', color: '#A855F7', icon: FileSignature },
  { t: 'Yesterday', who: 'Atlas',      act: 'refreshed weekly briefing',          target: 'Dashboard',    color: '#00E6FF', icon: Waves },
]
const ActivityPage = () => (
  <>
    <TopBar eyebrow="Activity" title="Everything happening in your operation" subtitle="A calm, continuous timeline of what people and Atlas are doing." />
    <GlassCard className="p-6">
      <ol className="relative">
        <span className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400/40 via-white/10 to-transparent" />
        {ACTIVITY.map((a, i) => {
          const Ic = a.icon
          return (
            <li key={i} className="relative pl-12 py-4 flex items-start gap-3">
              <span className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border" style={{ background: `${a.color}15`, borderColor: `${a.color}40` }}>
                <Ic size={13} style={{ color: a.color }} />
              </span>
              <div className="flex-1">
                <div className="text-[13.5px] text-white/90">
                  <span className="font-medium">{a.who}</span>{' '}
                  <span className="text-white/60">{a.act}</span>{' '}
                  <span className="font-mono text-cyan-400">{a.target}</span>
                </div>
                <div className="text-[11px] text-white/40 mt-0.5">{a.t}</div>
              </div>
            </li>
          )
        })}
      </ol>
    </GlassCard>
    <div className="h-16" />
  </>
)

/* ------------------------------------------------------------------ */
/*  COMPANIES / CONTACTS / USERS                                      */
/* ------------------------------------------------------------------ */
const COMPANIES = CARRIERS.map((c, i) => ({
  name: c,
  claims: 12 - (i % 7),
  approval: 60 + ((i * 13) % 35),
  responseDays: 2 + ((i * 3) % 6),
}))

const CompaniesPage = () => {
  const openDetail = useOpenDetail()
  return (
  <>
    <TopBar eyebrow="Companies" title="Carriers you work with" subtitle="Cross-carrier behavior tracked automatically." create={{ entity: 'Company', label: 'Add Company', icon: Briefcase }} />
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {COMPANIES.map(c => (
        <GlassCard key={c.name}
          onClick={() => openDetail({ kind: 'company', id: c.name })}
          className="p-6 hover:bg-white/[0.03] transition">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-[12px] font-bold text-white">
              {c.name.split(' ').map(n => n[0]).join('').slice(0,2)}
            </div>
            <div>
              <div className="text-[14.5px] font-semibold text-white">{c.name}</div>
              <div className="text-[11.5px] text-white/40">{c.claims} active claims</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/[0.06] p-3 bg-white/[0.02]">
              <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-white/40">Approval</div>
              <div className="text-[20px] font-semibold text-emerald-400 mt-1">{c.approval}%</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] p-3 bg-white/[0.02]">
              <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-white/40">Avg response</div>
              <div className="text-[20px] font-semibold text-cyan-400 mt-1">{c.responseDays}d</div>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
    <div className="h-16" />
  </>
  )
}

const CONTACTS = [
  { name: 'James Robertson', role: 'Homeowner',      email: 'james.r@gmail.com',      phone: '(704) 555-0142', city: 'Charlotte, NC' },
  { name: 'Sarah Bianchi',   role: 'Homeowner',      email: 'sbianchi@outlook.com',   phone: '(919) 555-0198', city: 'Raleigh, NC' },
  { name: 'M. Reynolds',     role: 'Adjuster',       email: 'mreynolds@statefarm.com',phone: '(404) 555-0122', city: 'Atlanta, GA' },
  { name: 'J. Kowalski',     role: 'Adjuster',       email: 'jkowalski@allstate.com', phone: '(312) 555-0177', city: 'Chicago, IL' },
  { name: 'Priya Anand',     role: 'Public Adjuster',email: 'priya@advocateclaims.co',phone: '(813) 555-0119', city: 'Tampa, FL' },
  { name: 'Diego Alvarez',   role: 'Adjuster',       email: 'dalvarez@usaa.com',      phone: '(210) 555-0155', city: 'San Antonio, TX' },
]
const ContactsPage = () => (
  <>
    <TopBar eyebrow="Contacts" title="Everyone in your orbit" subtitle="Homeowners, adjusters, public adjusters — unified." create={{ entity: 'Contact', label: 'Add Contact', icon: Users }} />
    <GlassCard className="p-2">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] tracking-[0.18em] text-white/35 uppercase">
            <th className="p-4 font-semibold">Name</th>
            <th className="p-4 font-semibold">Role</th>
            <th className="p-4 font-semibold">Email</th>
            <th className="p-4 font-semibold">Phone</th>
            <th className="p-4 font-semibold">Location</th>
          </tr>
        </thead>
        <tbody>
          {CONTACTS.map(c => (
            <tr key={c.email} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition">
              <td className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400/40 to-purple-500/40 flex items-center justify-center text-[10px] font-bold text-white">
                  {c.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <span className="text-[13px] text-white">{c.name}</span>
              </td>
              <td className="p-4 text-[12px] text-white/60">{c.role}</td>
              <td className="p-4 text-[12px] text-white/70">{c.email}</td>
              <td className="p-4 text-[12px] text-white/70 font-mono">{c.phone}</td>
              <td className="p-4 text-[12px] text-white/60">{c.city}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
    <div className="h-16" />
  </>
)

const USERS = [
  { name: 'Melissa October', role: 'Owner',         email: 'melissa@npproofing.com',  last: 'now' },
  { name: 'Devon Blake',     role: 'Operations',    email: 'devon@npproofing.com',    last: '12m ago' },
  { name: 'Aria Chen',       role: 'Estimator',     email: 'aria@npproofing.com',     last: '1h ago' },
  { name: 'Kai Martins',     role: 'Field Rep',     email: 'kai@npproofing.com',      last: '3h ago' },
  { name: 'Nadia Sokolova',  role: 'Admin',         email: 'nadia@npproofing.com',    last: 'yesterday' },
]
const UsersPage = () => (
  <>
    <TopBar eyebrow="Users" title="Your Atlas team" subtitle="5 seats · unlimited claims · unlimited intelligence." create={{ entity: 'User', label: 'Invite User', icon: UserCog }} />
    <GlassCard className="p-2">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] tracking-[0.18em] text-white/35 uppercase">
            <th className="p-4 font-semibold">Member</th>
            <th className="p-4 font-semibold">Role</th>
            <th className="p-4 font-semibold">Email</th>
            <th className="p-4 font-semibold">Last active</th>
          </tr>
        </thead>
        <tbody>
          {USERS.map(u => (
            <tr key={u.email} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition">
              <td className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-[10px] font-bold text-black">
                  {u.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <span className="text-[13px] text-white">{u.name}</span>
              </td>
              <td className="p-4"><span className="text-[11px] px-2 py-1 rounded-md bg-cyan-400/[0.06] border border-cyan-400/20 text-cyan-300">{u.role}</span></td>
              <td className="p-4 text-[12px] text-white/70">{u.email}</td>
              <td className="p-4 text-[12px] text-white/50">{u.last}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
    <div className="h-16" />
  </>
)

/* ------------------------------------------------------------------ */
/*  SETTINGS PAGE                                                     */
/* ------------------------------------------------------------------ */
const SettingsPage = () => {
  const [notif, setNotif] = useState(true)
  const [autoFile, setAutoFile] = useState(true)
  const [voice, setVoice] = useState(false)
  return (
    <>
      <TopBar eyebrow="Settings" title="Tune your operating system" subtitle="Preferences for notifications, automation, and appearance." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-6 lg:col-span-2 space-y-6">
          <div>
            <SectionLabel>Company</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-white/40 mb-1">Company name</div>
                <input defaultValue="NPP Roofing &amp; Restoration" className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-[13px] text-white outline-none focus:border-cyan-400/40" />
              </div>
              <div>
                <div className="text-[11px] text-white/40 mb-1">License #</div>
                <input defaultValue="NC-RES-4820" className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-[13px] text-white font-mono outline-none focus:border-cyan-400/40" />
              </div>
            </div>
          </div>
          <div className="divider-gradient" />
          <div>
            <SectionLabel>Preferences</SectionLabel>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Real-time intelligence notifications', val: notif, set: setNotif, desc: 'Get notified when Atlas surfaces a new signal.' },
                { label: 'Auto-file supporting documents',       val: autoFile, set: setAutoFile, desc: 'Atlas tags and links uploads to the correct claim.' },
                { label: 'Enable voice mode',                    val: voice, set: setVoice, desc: 'Talk to Atlas out loud from any screen.' },
              ].map(o => (
                <div key={o.label} className="flex items-center justify-between rounded-xl border border-white/[0.06] p-4 bg-white/[0.02]">
                  <div className="pr-6">
                    <div className="text-[13.5px] font-medium text-white">{o.label}</div>
                    <div className="text-[12px] text-white/45 mt-0.5">{o.desc}</div>
                  </div>
                  <button onClick={() => o.set(!o.val)} className={`w-10 h-6 rounded-full transition relative ${o.val ? 'bg-gradient-to-r from-cyan-400 to-blue-500' : 'bg-white/[0.08]'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${o.val ? 'left-[19px]' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6" tone="cyan">
          <SectionLabel>Atlas Model</SectionLabel>
          <div className="mt-4 text-[16px] font-semibold text-white">Atlas Sonnet 4.2</div>
          <div className="text-[12px] text-white/50 mt-1">Latest reasoning model, tuned for restoration.</div>
          <div className="mt-5 space-y-3">
            {['Reasoning depth','Document parsing','Voice fidelity'].map((k,i) => (
              <div key={k}>
                <div className="flex justify-between text-[11.5px] text-white/50">
                  <span>{k}</span><span className="font-mono">{[96,92,88][i]}%</span>
                </div>
                <div className="mt-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${[96,92,88][i]}%` }} />
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full rounded-xl bg-white/[0.05] border border-white/[0.08] py-2.5 text-[13px] text-white hover:bg-white/[0.08] transition flex items-center justify-center gap-2">
            <Cpu size={13} /> Manage model
          </button>
        </GlassCard>
      </div>
      <div className="h-16" />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  COMMAND PALETTE (Ask Atlas — floating)                            */
/* ------------------------------------------------------------------ */
const CommandPalette = ({ open, onClose }) => {
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => { if (open) setTimeout(() => ref.current?.focus(), 50) }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-2xl glass-strong rounded-2xl border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <AtlasLogo size={18} />
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Ask Atlas anything…" className="flex-1 bg-transparent outline-none text-[14.5px] text-white placeholder:text-white/30" />
          <Kbd>ESC</Kbd>
        </div>
        <div className="p-2 max-h-[52vh] overflow-y-auto">
          {[
            { l: 'Where is revenue getting stuck?',    i: Sparkles },
            { l: 'Which adjusters delay approvals?',   i: UserSquare2 },
            { l: 'Show my highest-value supplements',  i: FileStack },
            { l: 'Draft follow-up for M. Reynolds',    i: Wand2 },
            { l: 'Summarize today\'s activity',        i: ActivityIcon },
          ].map((r, i) => {
            const I = r.i
            return (
              <button key={i} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.04] text-left transition">
                <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <I size={14} className="text-cyan-300" />
                </div>
                <div className="text-[13.5px] text-white/85 flex-1">{r.l}</div>
                <ArrowRight size={13} className="text-white/30" />
              </button>
            )
          })}
        </div>
        <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/40">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-1"><Kbd>↵</Kbd> ask</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-atlas-pulse" /> Atlas Sonnet 4.2
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  APP SHELL                                                         */
/* ------------------------------------------------------------------ */
const PAGES = {
  dashboard:    DashboardPage,
  intelligence: IntelligencePage,
  claims:       ClaimsPage,
  supplements:  SupplementsPage,
  documents:    DocumentsPage,
  adjusters:    AdjustersPage,
  interviews:   InterviewsPage,
  properties:   PropertiesPage,
  tasks:        TasksPage,
  activity:     ActivityPage,
  companies:    CompaniesPage,
  contacts:     ContactsPage,
  users:        UsersPage,
  settings:     SettingsPage,
}

const AppInner = () => {
  const [active, setActive] = useState('dashboard')
  const [searchOpen, setSearchOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setVoiceOpen(v => !v)
      }
      if (e.key === 'Escape') { setSearchOpen(false); setMobileNav(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const PageComponent = PAGES[active] || DashboardPage

  return (
    <DetailContext.Provider value={setDetail}>
    <div className="flex atlas-bg min-h-screen">
      <Sidebar
        active={active}
        setActive={(k) => { setActive(k); setDetail(null) }}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />

      <main className="flex-1 min-w-0 relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl opacity-30"
               style={{ background: 'radial-gradient(circle, rgba(0,230,255,0.25), transparent 60%)' }} />
          <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-25"
               style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.25), transparent 60%)' }} />
        </div>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <TopBarInjector onOpenSidebar={() => setMobileNav(true)}>
            {detail
              ? <DetailView target={detail} onBack={() => setDetail(null)} />
              : <PageComponent />}
          </TopBarInjector>
        </div>

        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2">
          <button
            onClick={() => setVoiceOpen(true)}
            className="group flex items-center gap-2 pl-3 pr-3 sm:pr-4 py-2.5 rounded-full glass-strong border border-white/10 hover:border-purple-400/40 transition shadow-2xl"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
              <Mic size={12} className="text-black" />
            </div>
            <span className="hidden sm:inline text-[13px] text-white/80">Voice</span>
            <span className="hidden sm:inline"><Kbd>⌘J</Kbd></span>
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="group flex items-center gap-2.5 pl-3 pr-3 sm:pr-4 py-2.5 rounded-full glass-strong border border-white/10 hover:border-cyan-400/40 transition shadow-2xl"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Sparkles size={12} className="text-black" />
            </div>
            <span className="hidden sm:inline text-[13px] text-white/80">Ask Atlas</span>
            <span className="hidden sm:inline"><Kbd>⌘K</Kbd></span>
          </button>
        </div>
      </main>

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenDetail={(t) => setDetail(t)}
      />
      <VoiceMode open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
    </DetailContext.Provider>
  )
}

// Provides onOpenSidebar down to whichever TopBar the page renders.
// The pages use TopBar directly, so we make onOpenSidebar available via React.cloneElement is complex;
// instead, we expose a global via a simple context.
const SidebarToggleContext = createContext(() => {})
const useOpenSidebar = () => useContext(SidebarToggleContext)
const TopBarInjector = ({ children, onOpenSidebar }) => (
  <SidebarToggleContext.Provider value={onOpenSidebar}>{children}</SidebarToggleContext.Provider>
)

const App = () => {
  const [authed, setAuthed] = useState(false)
  if (!authed) return <AuthFlow onComplete={() => setAuthed(true)} />
  return (
    <CreateModalHost>
      <NotificationsHost>
        <AppInner />
      </NotificationsHost>
    </CreateModalHost>
  )
}

export default App
