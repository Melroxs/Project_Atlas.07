'use client'

import { useEffect, useMemo, useRef, useState, createContext, useContext } from 'react'
import {
  Sparkles, ArrowRight, Mail, Lock, Eye, EyeOff, Loader2, Check,
  Building2, Plus, LayoutDashboard, FolderOpen, FileStack, FileText,
  UserSquare2, Mic, ListChecks, Activity as ActivityIcon, Users, Search,
  Command, ArrowUpRight, Waves, MessageSquare, Send, Phone, MapPin, Mail as MailIcon,
  Calendar, Clock, Cloud, Flame, Droplets, Wind, MoreHorizontal, Download,
  ChevronRight, X, Volume2, MicOff, Pause, Play, StopCircle, Radio,
  FileSignature, CheckCircle2, AlertTriangle, ChevronLeft, Zap, Layers,
  Wand2, Fingerprint, TrendingUp, Home
} from 'lucide-react'

/* ================================================================== */
/*  SHARED PRIMITIVES                                                 */
/* ================================================================== */
export const AtlasLogo = ({ size = 24 }) => (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
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

export const Kbd = ({ children }) => <span className="kbd">{children}</span>

export const SectionLabel = ({ children, className = '' }) => (
  <div className={`text-[10px] font-semibold tracking-[0.18em] text-cyan-400/80 uppercase ${className}`}>
    {children}
  </div>
)

const STATUS_STYLES = {
  'In Progress':      { text: '#00E6FF' },
  'Pending Review':   { text: '#A855F7' },
  'Documentation':    { text: '#00E6FF' },
  'Carrier Response': { text: '#F59E0B' },
  'Approved':         { text: '#22C55E' },
  'Denied':           { text: '#EF4444' },
}
export const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES['In Progress']
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ color: s.text, background: `${s.text}12`, border: `1px solid ${s.text}40` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.text, boxShadow: `0 0 8px ${s.text}` }} />
      {status}
    </span>
  )
}

/* ================================================================== */
/*  AUTH FLOW                                                         */
/*  Sequence: login -> loading -> workspace -> welcome -> app         */
/* ================================================================== */
const AuthShell = ({ children }) => (
  <div className="relative min-h-screen w-full flex items-center justify-center px-6 overflow-hidden atlas-bg">
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -top-40 left-1/4 w-[700px] h-[700px] rounded-full blur-3xl opacity-30"
           style={{ background: 'radial-gradient(circle, rgba(0,230,255,0.35), transparent 60%)' }} />
      <div className="absolute -bottom-40 right-1/4 w-[600px] h-[600px] rounded-full blur-3xl opacity-25"
           style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.35), transparent 60%)' }} />
    </div>
    <div className="relative w-full max-w-[440px]">{children}</div>
  </div>
)

const LoginScreen = ({ onSubmit, onForgot }) => {
  const [email, setEmail] = useState('melissa@npproofing.com')
  const [password, setPassword] = useState('••••••••••')
  const [showPw, setShowPw] = useState(false)
  return (
    <AuthShell>
      <div className="flex items-center justify-center mb-8">
        <AtlasLogo size={44} />
      </div>
      <div className="text-center mb-8">
        <div className="text-[11px] font-semibold tracking-[0.22em] text-cyan-400/80 uppercase mb-3">
          Atlas Intelligence
        </div>
        <h1 className="text-[34px] font-semibold text-white tracking-[-0.02em] leading-[1.1]">
          Welcome back to <span className="gradient-text">Atlas</span>
        </h1>
        <p className="mt-3 text-[14px] text-white/50">
          The operating system for your restoration business.
        </p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-[11px] font-semibold tracking-[0.14em] text-white/50 uppercase">Email</label>
          <div className="relative mt-2">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={email} onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[13.5px] text-white outline-none focus:border-cyan-400/40 transition" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold tracking-[0.14em] text-white/50 uppercase">Password</label>
            <button onClick={onForgot} className="text-[11.5px] text-cyan-400 hover:text-cyan-300">
              Forgot?
            </button>
          </div>
          <div className="relative mt-2">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[13.5px] text-white outline-none focus:border-cyan-400/40 transition" />
            <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <button onClick={onSubmit}
          className="mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-semibold text-[13.5px] py-3.5 hover:opacity-90 transition flex items-center justify-center gap-2 glow-cyan">
          Sign in <ArrowRight size={14} />
        </button>

        <div className="flex items-center gap-3 py-1">
          <span className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[10.5px] tracking-[0.16em] uppercase text-white/35">or</span>
          <span className="flex-1 h-px bg-white/[0.06]" />
        </div>

        <button className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px] py-3 hover:bg-white/[0.06] transition flex items-center justify-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#fff" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8.1Z"/><path fill="#fff" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" opacity=".7"/><path fill="#fff" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" opacity=".5"/><path fill="#fff" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 12 1a11 11 0 0 0-9.9 6.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" opacity=".3"/></svg>
          Continue with Google
        </button>
      </div>

      <div className="text-center text-[12px] text-white/40 mt-6">
        By continuing you agree to Atlas's Terms and Privacy Policy.
      </div>
    </AuthShell>
  )
}

const ForgotScreen = ({ onBack, onSent }) => {
  const [sent, setSent] = useState(false)
  return (
    <AuthShell>
      <button onClick={onBack} className="absolute -top-14 left-0 text-[12.5px] text-white/50 hover:text-white flex items-center gap-1">
        <ChevronLeft size={14} /> Back to sign in
      </button>
      <div className="flex items-center justify-center mb-8"><AtlasLogo size={40} /></div>
      <div className="glass rounded-2xl p-8">
        {!sent ? (
          <>
            <h2 className="text-[24px] font-semibold text-white text-center">Reset your password</h2>
            <p className="text-center text-[13.5px] text-white/50 mt-2">
              We'll email you a secure link to set a new one.
            </p>
            <div className="mt-6">
              <label className="text-[11px] font-semibold tracking-[0.14em] text-white/50 uppercase">Email</label>
              <div className="relative mt-2">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input defaultValue="melissa@npproofing.com" className="w-full pl-10 pr-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[13.5px] text-white outline-none focus:border-cyan-400/40 transition" />
              </div>
            </div>
            <button onClick={() => { setSent(true); setTimeout(onSent, 1400) }}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-semibold text-[13.5px] py-3.5 hover:opacity-90 transition flex items-center justify-center gap-2">
              Send reset link <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
              <Check size={22} className="text-emerald-400" />
            </div>
            <div className="mt-5 text-[18px] font-semibold text-white">Check your inbox</div>
            <div className="mt-1.5 text-[13px] text-white/50">A reset link is on its way to your email.</div>
          </div>
        )}
      </div>
    </AuthShell>
  )
}

const LoadingScreen = ({ label = 'Authenticating…' }) => (
  <AuthShell>
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-32 h-32 rounded-full blur-2xl opacity-60 animate-atlas-pulse"
             style={{ background: 'radial-gradient(circle, rgba(0,230,255,0.6), transparent 60%)' }} />
        <div className="absolute w-24 h-24 rounded-full border border-cyan-400/30 animate-ping" />
        <AtlasLogo size={64} />
      </div>
      <div className="mt-10 text-[13px] font-medium tracking-[0.18em] text-cyan-400/90 uppercase">{label}</div>
      <div className="mt-2 text-[13px] text-white/50">Bringing your operation online</div>
    </div>
  </AuthShell>
)

const WORKSPACES = [
  { name: 'NPP Roofing & Restoration', role: 'Owner',      claims: 97, color: 'from-cyan-400 to-blue-500' },
  { name: 'Coastline Restoration Co.', role: 'Estimator',  claims: 42, color: 'from-purple-400 to-pink-500' },
  { name: 'Atlas Sandbox',             role: 'Admin',      claims: 12, color: 'from-emerald-400 to-teal-500' },
]
const WorkspaceScreen = ({ onPick }) => (
  <AuthShell>
    <div className="mb-8 text-center">
      <div className="flex items-center justify-center mb-6"><AtlasLogo size={38} /></div>
      <div className="text-[11px] font-semibold tracking-[0.22em] text-cyan-400/80 uppercase mb-3">
        Choose a workspace
      </div>
      <h1 className="text-[30px] font-semibold text-white tracking-[-0.02em]">
        Where would you like to work today?
      </h1>
    </div>
    <div className="space-y-3">
      {WORKSPACES.map(w => (
        <button key={w.name} onClick={() => onPick(w)}
          className="w-full text-left glass rounded-2xl p-5 hover:border-cyan-400/40 transition group flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${w.color} flex items-center justify-center text-black font-bold text-[14px]`}>
            {w.name.split(' ').map(x => x[0]).join('').slice(0,2)}
          </div>
          <div className="flex-1">
            <div className="text-[14.5px] font-semibold text-white">{w.name}</div>
            <div className="text-[12px] text-white/45 mt-0.5">{w.role} · {w.claims} active claims</div>
          </div>
          <ArrowRight size={16} className="text-white/30 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition" />
        </button>
      ))}
      <button className="w-full rounded-2xl border border-dashed border-white/10 text-white/50 p-4 hover:bg-white/[0.02] transition flex items-center justify-center gap-2 text-[13px]">
        <Plus size={14} /> Create a new workspace
      </button>
    </div>
  </AuthShell>
)

const WelcomeScreen = ({ onDone }) => {
  const [step, setStep] = useState(0)
  const steps = [
    {
      title: 'Welcome to Atlas',
      body: 'The intelligent operating system for insurance restoration. Atlas listens, reasons and moves your business forward.',
      icon: Sparkles,
    },
    {
      title: 'Ambient Intelligence',
      body: 'Atlas watches every claim, adjuster and document in your operation — and surfaces what matters, before you have to ask.',
      icon: Waves,
    },
    {
      title: "You're ready",
      body: "Your team, your claims, and your carriers are all here. Ask Atlas anything, anytime, from any screen.",
      icon: Check,
    },
  ]
  const S = steps[step]
  const Icon = S.icon
  return (
    <AuthShell>
      <div className="text-center">
        <div className="mx-auto mb-6 relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full blur-2xl opacity-70 animate-atlas-pulse"
               style={{ background: 'radial-gradient(circle, rgba(0,230,255,0.6), transparent 60%)' }} />
          <div className="relative w-24 h-24 rounded-full glass-strong border border-white/10 flex items-center justify-center">
            <Icon size={28} className="text-cyan-300" />
          </div>
        </div>
        <div className="text-[11px] font-semibold tracking-[0.22em] text-cyan-400/80 uppercase mb-3">
          Step {step + 1} of {steps.length}
        </div>
        <h1 className="text-[32px] font-semibold text-white tracking-[-0.02em] leading-[1.1]">
          {S.title.includes('Atlas') ? <>Welcome to <span className="gradient-text">Atlas</span></> : S.title}
        </h1>
        <p className="mt-4 text-[14.5px] text-white/55 leading-relaxed max-w-md mx-auto">
          {S.body}
        </p>
      </div>

      <div className="mt-10 flex items-center justify-center gap-2">
        {steps.map((_, i) => (
          <span key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-8 bg-cyan-400' : 'w-4 bg-white/10'}`} />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-3">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-[13px] text-white/70 hover:text-white hover:bg-white/[0.03]">
            Back
          </button>
        )}
        <button onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : onDone()}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-semibold text-[13px] flex items-center gap-2 glow-cyan">
          {step < steps.length - 1 ? 'Continue' : 'Enter Atlas'} <ArrowRight size={14} />
        </button>
      </div>
    </AuthShell>
  )
}

export const AuthFlow = ({ onComplete }) => {
  const [stage, setStage] = useState('login') // login | forgot | loading | workspace | welcome

  return (
    <>
      {stage === 'login' && (
        <LoginScreen
          onSubmit={() => { setStage('loading'); setTimeout(() => setStage('workspace'), 1400) }}
          onForgot={() => setStage('forgot')}
        />
      )}
      {stage === 'forgot' && (
        <ForgotScreen onBack={() => setStage('login')} onSent={() => setStage('login')} />
      )}
      {stage === 'loading' && <LoadingScreen />}
      {stage === 'workspace' && (
        <WorkspaceScreen onPick={() => { setStage('loading'); setTimeout(() => setStage('welcome'), 900) }} />
      )}
      {stage === 'welcome' && <WelcomeScreen onDone={onComplete} />}
    </>
  )
}

/* ================================================================== */
/*  VOICE MODE                                                        */
/* ================================================================== */
const VoiceOrb = ({ state }) => {
  // state: idle | listening | thinking | speaking
  const rings = state === 'listening' ? 4 : state === 'speaking' ? 3 : state === 'thinking' ? 6 : 2
  return (
    <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
      {Array.from({ length: rings }).map((_, i) => (
        <div key={i}
          className={`absolute rounded-full border ${state === 'listening' ? 'border-cyan-400/30' : state === 'speaking' ? 'border-purple-400/30' : 'border-white/10'} animate-ping`}
          style={{
            width: 200 + i * 40,
            height: 200 + i * 40,
            animationDuration: `${2 + i * 0.6}s`,
            animationDelay: `${i * 0.2}s`,
          }} />
      ))}
      <div className="absolute w-56 h-56 rounded-full blur-3xl opacity-70"
           style={{
             background: state === 'speaking'
               ? 'radial-gradient(circle, rgba(168,85,247,0.55), transparent 60%)'
               : state === 'thinking'
               ? 'radial-gradient(circle, rgba(59,130,246,0.55), transparent 60%)'
               : 'radial-gradient(circle, rgba(0,230,255,0.55), transparent 60%)',
           }} />
      <div className={`relative w-40 h-40 rounded-full glass-strong border border-white/10 flex items-center justify-center ${state === 'listening' ? 'animate-atlas-pulse' : ''}`}
           style={{
             background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), transparent 60%), linear-gradient(180deg, rgba(15,23,42,0.9), rgba(5,7,13,0.9))',
             boxShadow: `0 0 60px ${state === 'speaking' ? 'rgba(168,85,247,0.35)' : 'rgba(0,230,255,0.35)'}`,
           }}>
        <AtlasLogo size={64} />
      </div>
    </div>
  )
}

const VoiceWaveform = ({ active }) => (
  <div className="h-10 flex items-center justify-center gap-[3px]">
    {Array.from({ length: 32 }).map((_, i) => {
      const base = 4 + Math.abs(Math.sin(i * 0.7)) * 22
      return (
        <span key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-cyan-400 to-purple-400 transition-all"
          style={{
            height: active ? `${base}px` : '4px',
            animation: active ? `atlas-wave 1.2s ${i * 0.04}s ease-in-out infinite alternate` : 'none',
          }} />
      )
    })}
    <style>{`@keyframes atlas-wave { from { transform: scaleY(0.4); } to { transform: scaleY(1.4); } }`}</style>
  </div>
)

export const VoiceMode = ({ open, onClose }) => {
  const [state, setState] = useState('listening') // idle | listening | thinking | speaking
  const [mode, setMode] = useState('continuous')  // continuous | ptt
  const [transcript, setTranscript] = useState('')
  const [history, setHistory] = useState([
    { role: 'user',  text: 'How are my claims looking today?' },
    { role: 'atlas', text: 'You have 6 claims that need attention and $42,380 in potential revenue that\'s stuck. The most urgent is claim NPP-2026-0848 — a storm damage supplement worth $8,420.' },
  ])
  const targetText = 'Show me the highest value supplements this week'

  // Animate typing transcript
  useEffect(() => {
    if (!open) return
    setState('listening'); setTranscript('')
    let i = 0
    const iv = setInterval(() => {
      if (i >= targetText.length) {
        clearInterval(iv)
        setState('thinking')
        setTimeout(() => {
          setHistory(h => [
            ...h,
            { role: 'user', text: targetText },
            { role: 'atlas', text: 'Your top opportunities this week total $46,970 across 5 supplements. NPP-2026-0798 leads at $12,150, followed by ATL-2847 at $8,420 and NPP-2026-0791 at $7,290.' },
          ])
          setState('speaking')
          setTimeout(() => setState('listening'), 3400)
        }, 1200)
        return
      }
      setTranscript(t => t + targetText[i])
      i++
    }, 55)
    return () => clearInterval(iv)
  }, [open])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const stateLabel = { listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', idle: 'Ready' }[state]
  const stateColor = { listening: '#00E6FF', thinking: '#3B82F6', speaking: '#A855F7', idle: '#94A3B8' }[state]

  return (
    <div className="fixed inset-0 z-[60] atlas-bg flex flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/3 w-[700px] h-[700px] rounded-full blur-3xl opacity-30"
             style={{ background: 'radial-gradient(circle, rgba(0,230,255,0.35), transparent 60%)' }} />
        <div className="absolute -bottom-40 right-1/4 w-[600px] h-[600px] rounded-full blur-3xl opacity-25"
             style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.35), transparent 60%)' }} />
      </div>

      <div className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2.5">
          <AtlasLogo size={20} />
          <SectionLabel>Atlas Voice</SectionLabel>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded-full glass border border-white/[0.06]">
            <span className="w-1.5 h-1.5 rounded-full animate-atlas-pulse" style={{ background: stateColor, boxShadow: `0 0 10px ${stateColor}` }} />
            <span style={{ color: stateColor }}>{stateLabel.toUpperCase()}</span>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full glass border border-white/[0.06] hover:bg-white/[0.06] flex items-center justify-center">
            <X size={15} className="text-white/70" />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <VoiceOrb state={state} />
        <div className="mt-10 text-center max-w-2xl">
          <div className="text-[11px] font-semibold tracking-[0.22em] uppercase" style={{ color: stateColor }}>
            {state === 'listening' && 'You can speak now'}
            {state === 'thinking' && 'Atlas is thinking'}
            {state === 'speaking' && 'Atlas is speaking'}
          </div>
          <div className="mt-4 text-[22px] font-medium text-white/90 leading-relaxed min-h-[64px]">
            {state === 'listening' && (transcript || <span className="text-white/30">…</span>)}
            {state === 'thinking' && <span className="text-white/40">Analyzing 97 claims and 134 supplements…</span>}
            {state === 'speaking' && history[history.length - 1]?.text}
          </div>
          <div className="mt-6">
            <VoiceWaveform active={state === 'listening' || state === 'speaking'} />
          </div>
        </div>
      </div>

      {/* Conversation history */}
      <div className="relative z-10 mx-auto w-full max-w-3xl px-6">
        <div className="glass rounded-2xl p-5 max-h-[220px] overflow-y-auto space-y-3">
          <SectionLabel className="!text-white/40">Conversation</SectionLabel>
          {history.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {m.role === 'atlas' && <div className="pt-1"><AtlasLogo size={16} /></div>}
              <div className={`max-w-[80%] rounded-xl px-3.5 py-2 text-[13px] ${m.role === 'user' ? 'bg-white/[0.06] text-white/85 border border-white/[0.06]' : 'bg-cyan-400/[0.06] text-white/90 border border-cyan-400/20'}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 px-6 py-6 flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-full glass border border-white/[0.06]">
          <button onClick={() => setMode('continuous')}
            className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-medium transition ${mode === 'continuous' ? 'bg-white/[0.08] text-white' : 'text-white/50'}`}>
            Continuous
          </button>
          <button onClick={() => setMode('ptt')}
            className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-medium transition ${mode === 'ptt' ? 'bg-white/[0.08] text-white' : 'text-white/50'}`}>
            Push to talk
          </button>
        </div>

        <button className="w-12 h-12 rounded-full glass border border-white/10 hover:bg-white/[0.06] flex items-center justify-center">
          <MicOff size={16} className="text-white/70" />
        </button>
        <button onClick={() => setState('listening')}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-black glow-cyan hover:opacity-95 transition">
          <Mic size={22} />
        </button>
        <button className="w-12 h-12 rounded-full glass border border-white/10 hover:bg-white/[0.06] flex items-center justify-center">
          <Volume2 size={16} className="text-white/70" />
        </button>

        <div className="ml-4 relative w-72">
          <input placeholder="Or type instead…"
            className="w-full rounded-full bg-white/[0.03] border border-white/[0.08] px-4 py-3 pr-10 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-cyan-400/40" />
          <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-black">
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  GLOBAL SEARCH                                                     */
/* ================================================================== */
const SEARCH_INDEX = [
  { type: 'Claim',      icon: FolderOpen,   title: 'NPP-2026-0848 · Residential Storm Damage', sub: 'State Farm · $8,420 supplement · 2m ago',    match: ['storm','claim','state farm','npp'], id: 'NPP-2026-0848', kind: 'claim' },
  { type: 'Claim',      icon: FolderOpen,   title: 'NPP-2026-0837 · Wind Damage',              sub: 'Allstate · $6,780 supplement · 15m ago',      match: ['wind','allstate'], id: 'NPP-2026-0837', kind: 'claim' },
  { type: 'Property',   icon: Building2,    title: '2847 Willow Bend Ln',                       sub: 'Charlotte, NC · Storm / Hail · 2 claims',    match: ['willow','charlotte'], id: '2847 Willow Bend Ln', kind: 'property' },
  { type: 'Property',   icon: Building2,    title: '412 Harbor Point Dr',                       sub: 'Tampa, FL · Wind · 1 claim',                  match: ['harbor','tampa'], id: '412 Harbor Point Dr', kind: 'property' },
  { type: 'Adjuster',   icon: UserSquare2,  title: 'M. Reynolds',                               sub: 'Independent · Southeast · High doc scrutiny', match: ['reynolds','adjuster'], id: 'M. Reynolds', kind: 'adjuster' },
  { type: 'Adjuster',   icon: UserSquare2,  title: 'D. Alvarez',                                sub: 'Staff · Northeast · Fast approver',           match: ['alvarez'], id: 'D. Alvarez', kind: 'adjuster' },
  { type: 'Company',    icon: Layers,       title: 'State Farm',                                sub: '12 active claims · 68% approval · 6.1d avg',  match: ['state farm','carrier'], id: 'State Farm', kind: 'company' },
  { type: 'Document',   icon: FileText,     title: 'Roof Measurement Report.pdf',               sub: 'NPP-2026-0848 · 2.4 MB · Estimate',           match: ['roof','measurement'], id: 'Roof Measurement Report.pdf', kind: 'document' },
  { type: 'Document',   icon: FileText,     title: 'Xactimate Estimate v3.xml',                 sub: 'NPP-2026-0837 · 340 KB · Estimate',           match: ['xactimate','estimate'], id: 'Xactimate Estimate v3.xml', kind: 'document' },
  { type: 'Interview',  icon: Mic,          title: 'Homeowner intake — J. Robertson',           sub: 'INT-482 · 11:42 · today',                     match: ['robertson','interview'], id: 'INT-482', kind: 'interview' },
  { type: 'Note',       icon: MessageSquare,title: 'Follow-up notes on adjuster call',          sub: 'NPP-2026-0837 · 2h ago',                      match: ['note','follow'], id: 'note-1', kind: 'note' },
  { type: 'Task',       icon: ListChecks,   title: 'Upload roof measurement report',            sub: 'NPP-2026-0848 · Due today · High',            match: ['upload','task'], id: 'task-1', kind: 'task' },
  { type: 'Task',       icon: ListChecks,   title: 'Follow up with M. Reynolds',                sub: 'NPP-2026-0837 · Due today · High',            match: ['follow','reynolds'], id: 'task-2', kind: 'task' },
]

const TYPE_COLORS = {
  Claim: '#00E6FF', Property: '#22C55E', Adjuster: '#A855F7',
  Company: '#3B82F6', Document: '#F59E0B', Interview: '#EC4899',
  Note: '#94A3B8', Task: '#00E6FF',
}

export const GlobalSearch = ({ open, onClose, onOpenDetail }) => {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    if (open) { setQ(''); setCursor(0) }
  }, [open])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return SEARCH_INDEX
    return SEARCH_INDEX.filter(r =>
      r.title.toLowerCase().includes(s) ||
      r.sub.toLowerCase().includes(s) ||
      r.match.some(m => m.includes(s))
    )
  }, [q])

  const grouped = useMemo(() => {
    const g = {}
    results.forEach(r => { (g[r.type] = g[r.type] || []).push(r) })
    return g
  }, [results])

  useEffect(() => {
    const onKey = (e) => {
      if (!open) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
      if (e.key === 'Enter') {
        const r = results[cursor]
        if (r) { onOpenDetail?.(r); onClose() }
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, cursor, onOpenDetail, onClose])

  if (!open) return null
  let idx = -1

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center pt-[12vh] px-4 bg-black/70 backdrop-blur-lg" onClick={onClose}>
      <div className="w-full max-w-2xl glass-strong rounded-2xl border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <Search size={16} className="text-cyan-300" />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setCursor(0) }}
            placeholder="Search your entire company…"
            className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-white/30" />
          <div className="flex items-center gap-1.5 text-white/40">
            <Kbd>ESC</Kbd>
          </div>
        </div>

        {/* Ask Atlas prompt */}
        {q && (
          <button onClick={() => { onClose(); onOpenDetail?.({ askAtlas: q }) }}
            className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04] hover:bg-cyan-400/[0.04] transition text-left">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Sparkles size={13} className="text-black" />
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] text-white">Ask Atlas: <span className="text-cyan-300">"{q}"</span></div>
              <div className="text-[11px] text-white/40 mt-0.5">Reason across your entire operation</div>
            </div>
            <ArrowRight size={14} className="text-white/40" />
          </button>
        )}

        <div className="max-h-[54vh] overflow-y-auto">
          {results.length === 0 && (
            <div className="px-6 py-14 text-center text-white/40 text-[13px]">
              No results. Try a claim ID, address, adjuster name or carrier.
            </div>
          )}
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="py-2">
              <div className="px-5 py-1.5 text-[10px] tracking-[0.18em] uppercase font-semibold text-white/40 flex items-center gap-2">
                <span>{type}</span>
                <span className="text-white/25">·</span>
                <span className="text-white/30">{items.length}</span>
              </div>
              {items.map(r => {
                idx++
                const Ic = r.icon
                const active = idx === cursor
                const localIdx = idx
                return (
                  <button key={r.title} onMouseEnter={() => setCursor(localIdx)}
                    onClick={() => { onOpenDetail?.(r); onClose() }}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition ${active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center border"
                         style={{ background: `${TYPE_COLORS[r.type]}12`, borderColor: `${TYPE_COLORS[r.type]}30` }}>
                      <Ic size={14} style={{ color: TYPE_COLORS[r.type] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] text-white truncate">{r.title}</div>
                      <div className="text-[11.5px] text-white/45 truncate">{r.sub}</div>
                    </div>
                    {active && <ArrowRight size={13} className="text-cyan-400" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.06] text-[11px] text-white/40">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-atlas-pulse" /> Atlas Sonnet 4.2
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  CREATE MODAL SYSTEM (elegant placeholder for future backend flows)*/
/* ================================================================== */
const CreateContext = createContext(() => {})
export const useOpenCreate = () => useContext(CreateContext)

const CreateModal = ({ entity, icon: Icon = Sparkles, description, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/70 backdrop-blur-lg" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-2xl border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <AtlasLogo size={16} />
            <SectionLabel>Create · {entity}</SectionLabel>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center">
            <X size={14} className="text-white/60" />
          </button>
        </div>
        <div className="px-6 py-7">
          <div className="mx-auto w-16 h-16 rounded-2xl glass-strong border border-white/10 flex items-center justify-center mb-5 relative">
            <div className="absolute inset-0 rounded-2xl blur-xl opacity-60"
                 style={{ background: 'radial-gradient(circle, rgba(0,230,255,0.5), transparent 60%)' }} />
            <Icon size={22} className="text-cyan-300 relative" />
          </div>
          <h3 className="text-center text-[20px] font-semibold text-white tracking-[-0.01em]">
            New {entity}
          </h3>
          <p className="mt-2 text-center text-[13.5px] text-white/55 leading-relaxed">
            {description || `This flow will be connected to the Atlas backend.`}
          </p>
          <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
            <SectionLabel>Atlas is preparing this flow</SectionLabel>
            <div className="mt-1.5 text-[12.5px] text-white/70">
              Once connected, Atlas will guide you through creating a {entity.toLowerCase()} with intelligent suggestions and auto-filled fields based on your operation.
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex items-center gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-[13px] text-white/70 hover:bg-white/[0.03]">
            Cancel
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-[13px] font-semibold flex items-center gap-1.5 glow-cyan">
            Continue <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export const CreateModalHost = ({ children }) => {
  const [payload, setPayload] = useState(null)
  return (
    <CreateContext.Provider value={setPayload}>
      {children}
      {payload && <CreateModal {...payload} onClose={() => setPayload(null)} />}
    </CreateContext.Provider>
  )
}

/* ================================================================== */
/*  NOTIFICATIONS DRAWER                                              */
/* ================================================================== */
const NotificationsContext = createContext(() => {})
export const useOpenNotifications = () => useContext(NotificationsContext)

const NOTIFICATIONS = [
  {
    type: 'atlas',
    kind: 'Atlas Recommendation',
    title: 'Focus on 6 supplements above $4K first',
    body: 'Reviewing these unlocks an estimated $28,140 in recovery this week.',
    time: 'now',
    color: '#00E6FF',
    icon: Sparkles,
  },
  {
    type: 'risk',
    kind: 'High-risk claim detected',
    title: 'NPP-2026-0821 approaching carrier SLA',
    body: 'Farmers Insurance response is now 5 days overdue. Consider escalation.',
    time: '2m ago',
    color: '#EF4444',
    icon: AlertTriangle,
  },
  {
    type: 'adjuster',
    kind: 'Adjuster responded',
    title: 'M. Reynolds replied to your supplement',
    body: 'NPP-2026-0837 · Requesting additional ridge cap photos before review.',
    time: '18m ago',
    color: '#A855F7',
    icon: MessageSquare,
  },
  {
    type: 'approved',
    kind: 'Supplement approved',
    title: 'SUP-9085 approved at $6,120',
    body: 'Liberty Mutual has approved your supplement on NPP-2026-0776 in full.',
    time: '42m ago',
    color: '#22C55E',
    icon: CheckCircle2,
  },
  {
    type: 'doc',
    kind: 'Missing documentation',
    title: 'Roof measurement report needed',
    body: 'NPP-2026-0848 supplement submission is blocked until report is attached.',
    time: '1h ago',
    color: '#F59E0B',
    icon: FileSignature,
  },
  {
    type: 'revenue',
    kind: 'Revenue opportunity',
    title: '$12,150 supplement identified on NPP-2026-0798',
    body: 'Atlas detected 4 unsupported line items with 95% approval confidence.',
    time: '2h ago',
    color: '#00E6FF',
    icon: TrendingUp,
  },
  {
    type: 'interview',
    kind: 'Interview ready for review',
    title: 'Homeowner intake — J. Robertson',
    body: 'INT-482 transcribed and linked to NPP-2026-0848. 5 facts extracted.',
    time: '3h ago',
    color: '#EC4899',
    icon: Mic,
  },
  {
    type: 'atlas',
    kind: 'Atlas Recommendation',
    title: 'Weekly briefing refreshed',
    body: 'Revenue up $18,400 · 31 actions suggested · 14.2h reclaimed.',
    time: 'yesterday',
    color: '#00E6FF',
    icon: Waves,
  },
]

const NotificationsDrawer = ({ open, onClose }) => {
  const [filter, setFilter] = useState('All')
  const filters = ['All', 'Atlas', 'Claims', 'Adjusters', 'Documents']

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const items = filter === 'All' ? NOTIFICATIONS
    : filter === 'Atlas'    ? NOTIFICATIONS.filter(n => n.type === 'atlas' || n.type === 'revenue')
    : filter === 'Claims'   ? NOTIFICATIONS.filter(n => n.type === 'risk' || n.type === 'approved')
    : filter === 'Adjusters'? NOTIFICATIONS.filter(n => n.type === 'adjuster')
    : NOTIFICATIONS.filter(n => n.type === 'doc' || n.type === 'interview')

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[59] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[440px] glass-strong border-l border-white/[0.08] flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <AtlasLogo size={16} />
              <SectionLabel>Notifications</SectionLabel>
            </div>
            <div className="mt-1.5 text-[15px] font-semibold text-white">What Atlas noticed</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full glass border border-white/[0.06] hover:bg-white/[0.06] flex items-center justify-center">
            <X size={14} className="text-white/70" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-1 overflow-x-auto">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap transition ${
                filter === f ? 'bg-white/[0.06] text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="flex-1" />
          <button className="text-[11.5px] text-cyan-400 hover:text-cyan-300 pr-1">Mark all read</button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {items.map((n, i) => {
            const Ic = n.icon
            return (
              <button
                key={i}
                onClick={onClose}
                className="w-full text-left rounded-xl p-3.5 hover:bg-white/[0.03] transition group border border-transparent hover:border-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center border shrink-0"
                       style={{ background: `${n.color}12`, borderColor: `${n.color}30` }}>
                    <Ic size={14} style={{ color: n.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] tracking-[0.14em] uppercase font-semibold" style={{ color: n.color }}>
                        {n.kind}
                      </span>
                      <span className="text-[10.5px] text-white/35">·</span>
                      <span className="text-[10.5px] text-white/40">{n.time}</span>
                    </div>
                    <div className="mt-1 text-[13.5px] font-medium text-white leading-snug">{n.title}</div>
                    <div className="mt-1 text-[12.5px] text-white/55 leading-relaxed">{n.body}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-atlas-pulse" />
            Atlas is actively monitoring your operation
          </div>
          <span className="text-white/40 font-mono">{NOTIFICATIONS.length}</span>
        </div>
      </aside>
    </>
  )
}

export const NotificationsHost = ({ children }) => {
  const [open, setOpen] = useState(false)
  return (
    <NotificationsContext.Provider value={setOpen}>
      {children}
      <NotificationsDrawer open={open} onClose={() => setOpen(false)} />
    </NotificationsContext.Provider>
  )
}

/* ================================================================== */
/*  DETAIL VIEWS                                                      */
/* ================================================================== */
const DetailHeader = ({ eyebrow, title, meta, onBack, right }) => (
  <div className="flex items-start justify-between gap-6 pt-6 pb-6 border-b border-white/[0.06]">
    <div className="flex items-start gap-4">
      <button onClick={onBack} className="mt-1 w-9 h-9 rounded-full glass border border-white/[0.06] hover:bg-white/[0.06] flex items-center justify-center">
        <ChevronLeft size={16} className="text-white/70" />
      </button>
      <div>
        <SectionLabel>{eyebrow}</SectionLabel>
        <h1 className="mt-2 text-[30px] font-semibold text-white tracking-[-0.02em] leading-tight">{title}</h1>
        {meta && <div className="mt-2 text-[13px] text-white/50">{meta}</div>}
      </div>
    </div>
    <div className="flex items-center gap-2">{right}</div>
  </div>
)

const InfoRow = ({ label, value, mono }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-b-0">
    <div className="text-[11.5px] tracking-[0.14em] uppercase font-semibold text-white/40">{label}</div>
    <div className={`text-[13px] text-white/90 ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
)

const Timeline = ({ items }) => (
  <ol className="relative">
    <span className="absolute left-4 top-1 bottom-1 w-px bg-gradient-to-b from-cyan-400/40 via-white/10 to-transparent" />
    {items.map((a, i) => {
      const Ic = a.icon
      return (
        <li key={i} className="relative pl-12 py-3">
          <span className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border"
                style={{ background: `${a.color}15`, borderColor: `${a.color}40` }}>
            <Ic size={13} style={{ color: a.color }} />
          </span>
          <div className="text-[13.5px] text-white/90">
            <span className="font-medium">{a.who}</span>{' '}
            <span className="text-white/60">{a.act}</span>{' '}
            {a.target && <span className="font-mono text-cyan-400">{a.target}</span>}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">{a.t}</div>
        </li>
      )
    })}
  </ol>
)

const ClaimDetail = ({ id = 'NPP-2026-0848', onBack }) => {
  const [tab, setTab] = useState('Overview')
  const tabs = ['Overview','Timeline','Documents','Supplements','Photos','Notes']
  return (
    <>
      <DetailHeader
        eyebrow={`Claim · ${id}`}
        title="Residential Storm Damage"
        meta={<>State Farm · Filed 6 days ago · <span className="text-white/70">2847 Willow Bend Ln, Charlotte, NC</span></>}
        onBack={onBack}
        right={<>
          <StatusBadge status="In Progress" />
          <button className="px-3 py-2 rounded-lg glass border border-white/[0.06] text-[12.5px] text-white/70 hover:bg-white/[0.06] flex items-center gap-1.5"><Download size={13} /> Export</button>
          <button className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-[12.5px] font-semibold flex items-center gap-1.5"><Wand2 size={13} /> Ask Atlas</button>
        </>}
      />

      <div className="flex items-center gap-1 pt-5 pb-4">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-lg text-[12.5px] transition ${tab === t ? 'bg-white/[0.06] text-white' : 'text-white/50 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <SectionLabel>Atlas Claim Intelligence</SectionLabel>
                <div className="text-[11px] text-cyan-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-atlas-pulse" /> scanning
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[11px] tracking-[0.16em] uppercase text-white/40 font-semibold">Potential supplement</div>
                  <div className="text-[38px] font-semibold gradient-text leading-none mt-2">$8,420</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] tracking-[0.16em] uppercase text-white/40 font-semibold">Confidence</div>
                  <div className="text-[24px] font-semibold text-white mt-1">92%</div>
                </div>
              </div>
              <div className="mt-5">
                <SectionLabel className="!text-white/40">Signals</SectionLabel>
                <ul className="mt-3 space-y-2">
                  {['Missing documentation','Estimate discrepancy detected','Adjuster delay pattern','3 unsupported line items'].map((s,i) => (
                    <li key={i} className="flex items-center gap-3 text-[13.5px] text-white/85 rounded-lg px-3 py-2 bg-white/[0.02] border border-white/[0.04]">
                      <span className="w-1 h-1 rounded-full bg-cyan-400" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
                <SectionLabel>Recommended Action</SectionLabel>
                <div className="mt-1.5 text-[13.5px] text-white/85">Prepare documentation review before supplement submission.</div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <SectionLabel>Recent Activity</SectionLabel>
              <div className="mt-4">
                <Timeline items={[
                  { who: 'Atlas',          act: 'flagged supplement opportunity on', target: id, t: '2m ago',  color: '#00E6FF', icon: Sparkles },
                  { who: 'Melissa October',act: 'uploaded 12 photos to',             target: id, t: '9m ago',  color: '#A855F7', icon: FileText },
                  { who: 'M. Reynolds',    act: 'reviewed estimate on',              target: id, t: '2h ago',  color: '#22C55E', icon: CheckCircle2 },
                  { who: 'Atlas',          act: 'detected document gap on',          target: id, t: '5h ago',  color: '#F59E0B', icon: AlertTriangle },
                ]} />
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="glass rounded-2xl p-6">
              <SectionLabel>Claim Details</SectionLabel>
              <div className="mt-3">
                <InfoRow label="Carrier"    value="State Farm" />
                <InfoRow label="Policy #"   value="SF-448291-A" mono />
                <InfoRow label="Peril"      value="Storm / Hail" />
                <InfoRow label="Filed"      value="Jun 10, 2025" />
                <InfoRow label="Deductible" value="$2,500" mono />
                <InfoRow label="RCV"        value="$41,800" mono />
                <InfoRow label="ACV"        value="$36,120" mono />
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <SectionLabel>People</SectionLabel>
              <div className="mt-4 space-y-3">
                {[
                  { name: 'J. Robertson', role: 'Homeowner', color: 'from-purple-400 to-pink-500' },
                  { name: 'M. Reynolds',  role: 'Adjuster',  color: 'from-cyan-400 to-blue-500' },
                  { name: 'Melissa October', role: 'Owner',  color: 'from-emerald-400 to-teal-500' },
                ].map(p => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center text-[11px] font-bold text-black`}>
                      {p.name.split(' ').map(x => x[0]).join('').slice(0,2)}
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] text-white">{p.name}</div>
                      <div className="text-[11px] text-white/45">{p.role}</div>
                    </div>
                    <button className="w-7 h-7 rounded-md hover:bg-white/[0.04] flex items-center justify-center text-white/40"><Phone size={12} /></button>
                    <button className="w-7 h-7 rounded-md hover:bg-white/[0.04] flex items-center justify-center text-white/40"><MailIcon size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Timeline' && (
        <div className="glass rounded-2xl p-6">
          <Timeline items={[
            { who: 'Atlas',          act: 'flagged supplement opportunity on', target: id, t: '2m ago',  color: '#00E6FF', icon: Sparkles },
            { who: 'Melissa October',act: 'uploaded 12 photos to',             target: id, t: '9m ago',  color: '#A855F7', icon: FileText },
            { who: 'M. Reynolds',    act: 'responded to supplement on',        target: id, t: '18m ago', color: '#22C55E', icon: MessageSquare },
            { who: 'Atlas',          act: 'transcribed interview',             target: 'INT-482', t: '42m ago', color: '#00E6FF', icon: Mic },
            { who: 'Atlas',          act: 'detected document gap on',          target: id, t: '2h ago',  color: '#F59E0B', icon: AlertTriangle },
            { who: 'System',         act: 'filed claim',                        target: id, t: '6d ago',  color: '#94A3B8', icon: FileSignature },
          ]} />
        </div>
      )}

      {tab === 'Documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Roof Measurement Report.pdf', tag: 'Estimate' },
            { name: 'Adjuster Photos - East.zip',  tag: 'Photos' },
            { name: 'Xactimate Estimate v3.xml',   tag: 'Estimate' },
            { name: 'Weather Verification.pdf',    tag: 'Evidence' },
            { name: 'Signed AOB.pdf',              tag: 'Legal' },
          ].map(d => (
            <div key={d.name} className="glass rounded-2xl p-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/[0.06] flex items-center justify-center">
                <FileText size={18} className="text-cyan-300" />
              </div>
              <div className="mt-4 text-[13.5px] font-medium text-white">{d.name}</div>
              <div className="mt-3 text-[10px] tracking-[0.14em] uppercase font-semibold text-cyan-400/80 px-2 py-1 rounded-md bg-cyan-400/[0.06] border border-cyan-400/20 inline-block">{d.tag}</div>
            </div>
          ))}
        </div>
      )}

      {(tab === 'Supplements' || tab === 'Photos' || tab === 'Notes') && (
        <div className="glass rounded-2xl p-14 text-center">
          <SectionLabel className="!text-white/30 justify-center">{tab}</SectionLabel>
          <div className="mt-3 text-[15px] text-white/60">Ready to connect to your existing backend.</div>
        </div>
      )}
    </>
  )
}

const SupplementDetail = ({ id = 'SUP-9142', onBack }) => (
  <>
    <DetailHeader
      eyebrow={`Supplement · ${id}`}
      title="Roofing supplement — East slope"
      meta={<>Linked to <span className="text-cyan-400 font-mono">NPP-2026-0848</span> · State Farm · Submitted 12h ago</>}
      onBack={onBack}
      right={<StatusBadge status="Pending Review" />}
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-5">
      <div className="lg:col-span-2 glass rounded-2xl p-6">
        <SectionLabel>Line Items</SectionLabel>
        <table className="mt-4 w-full text-left">
          <thead>
            <tr className="text-[10px] tracking-[0.18em] uppercase text-white/35 font-semibold">
              <th className="pb-3">Line</th><th>Qty</th><th>Unit</th><th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Remove & replace ridge caps',    qty: 88,  unit: 12.4,  total: 1091.20 },
              { name: 'Underlayment upgrade',           qty: 22,  unit: 68.00, total: 1496.00 },
              { name: 'Drip edge (color-matched)',      qty: 140, unit: 4.75,  total: 665.00 },
              { name: 'Ice & water shield — valleys',   qty: 12,  unit: 89.00, total: 1068.00 },
              { name: 'Additional labor — steep pitch', qty: 1,   unit: 4100,  total: 4100.00 },
            ].map((r, i) => (
              <tr key={i} className="border-t border-white/[0.04]">
                <td className="py-3 text-[13.5px] text-white">{r.name}</td>
                <td className="py-3 text-[13px] text-white/70 font-mono">{r.qty}</td>
                <td className="py-3 text-[13px] text-white/70 font-mono">${r.unit.toFixed(2)}</td>
                <td className="py-3 text-[13px] text-cyan-400 font-mono text-right">${r.total.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="border-t border-white/[0.06]">
              <td colSpan={3} className="py-4 text-[11px] tracking-[0.16em] uppercase text-white/50 font-semibold">Total supplement</td>
              <td className="py-4 text-right text-[22px] font-semibold gradient-text font-mono">$8,420.20</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-5">
        <div className="glass rounded-2xl p-6" >
          <SectionLabel>Confidence</SectionLabel>
          <div className="mt-3 text-[42px] font-semibold gradient-text leading-none">92%</div>
          <div className="mt-2 text-[12.5px] text-white/50">Backed by 14 similar Atlas approvals across State Farm this year.</div>
        </div>
        <div className="glass rounded-2xl p-6" >
          <SectionLabel>Atlas Recommendation</SectionLabel>
          <div className="mt-2 text-[13.5px] text-white/85">Attach signed weather verification before adjuster review. Historically increases approval by 18%.</div>
        </div>
      </div>
    </div>
  </>
)

const DocumentDetail = ({ id = 'Roof Measurement Report.pdf', onBack }) => (
  <>
    <DetailHeader
      eyebrow="Document"
      title={id}
      meta={<>Linked to <span className="text-cyan-400 font-mono">NPP-2026-0848</span> · 2.4 MB · Uploaded 2m ago</>}
      onBack={onBack}
      right={<>
        <button className="px-3 py-2 rounded-lg glass border border-white/[0.06] text-[12.5px] text-white/70 flex items-center gap-1.5"><Download size={13} /> Download</button>
      </>}
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-5">
      <div className="lg:col-span-2 glass rounded-2xl p-4">
        <div className="aspect-[4/5] rounded-xl bg-gradient-to-br from-[#0b1220] to-[#050710] border border-white/[0.06] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20"
               style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="text-center relative">
            <FileText size={44} className="mx-auto text-cyan-300" />
            <div className="mt-4 text-[13px] text-white/70">Preview will render here when connected.</div>
          </div>
        </div>
      </div>
      <div className="space-y-5">
        <div className="glass rounded-2xl p-6">
          <SectionLabel>Metadata</SectionLabel>
          <div className="mt-3">
            <InfoRow label="Type" value="Estimate" />
            <InfoRow label="Format" value="PDF" mono />
            <InfoRow label="Pages" value="14" mono />
            <InfoRow label="Uploaded by" value="Melissa October" />
            <InfoRow label="Source" value="EagleView" />
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <SectionLabel>Atlas Extracted</SectionLabel>
          <ul className="mt-3 space-y-2 text-[13px] text-white/80">
            {['Roof area: 3,420 sqft','Predominant pitch: 8/12','Materials: architectural shingle','Ridge cap length: 88 lf','12 hip corners identified'].map((x,i) => (
              <li key={i} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-cyan-400" />{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </>
)

const AdjusterDetail = ({ id = 'M. Reynolds', onBack }) => (
  <>
    <DetailHeader
      eyebrow={`Adjuster · ${id}`}
      title="M. Reynolds"
      meta="Independent Adjuster · Southeast region · 14 historical claims"
      onBack={onBack}
      right={<>
        <button className="px-3 py-2 rounded-lg glass border border-white/[0.06] text-[12.5px] text-white/70 flex items-center gap-1.5"><Phone size={13} /> Call</button>
        <button className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-[12.5px] font-semibold flex items-center gap-1.5"><MailIcon size={13} /> Message</button>
      </>}
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-5">
      <div className="lg:col-span-2 space-y-5">
        <div className="glass rounded-2xl p-6 grid grid-cols-3 gap-3">
          {[
            { k: 'Avg response (d)', v: '6.1',  c: '#00E6FF' },
            { k: 'Approval rate',    v: '68%',  c: '#22C55E' },
            { k: 'Doc scrutiny',     v: 'High', c: '#A855F7' },
          ].map(x => (
            <div key={x.k} className="rounded-xl border border-white/[0.06] p-4 bg-white/[0.02]">
              <div className="text-[28px] font-semibold leading-none" style={{ color: x.c }}>{x.v}</div>
              <div className="mt-2 text-[10px] tracking-[0.14em] uppercase font-semibold text-white/40">{x.k}</div>
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-6">
          <SectionLabel>Historical Claims</SectionLabel>
          <table className="mt-4 w-full text-left">
            <thead><tr className="text-[10px] tracking-[0.18em] uppercase font-semibold text-white/35">
              <th className="pb-3">Claim</th><th>Outcome</th><th>Supplement</th><th>Days</th>
            </tr></thead>
            <tbody>
              {[
                { id: 'NPP-2025-0641', out: 'Approved', sup: 6420, d: 5 },
                { id: 'NPP-2025-0598', out: 'Approved', sup: 3820, d: 7 },
                { id: 'NPP-2025-0552', out: 'Partial',  sup: 2100, d: 9 },
                { id: 'NPP-2025-0509', out: 'Approved', sup: 8420, d: 6 },
                { id: 'NPP-2025-0468', out: 'Denied',   sup: 0,    d: 12 },
              ].map(r => (
                <tr key={r.id} className="border-t border-white/[0.04]">
                  <td className="py-3 text-[13px] text-white font-mono">{r.id}</td>
                  <td className="py-3"><StatusBadge status={r.out === 'Approved' ? 'Approved' : r.out === 'Denied' ? 'Denied' : 'Pending Review'} /></td>
                  <td className="py-3 text-[13px] font-mono text-cyan-400">${r.sup.toLocaleString()}</td>
                  <td className="py-3 text-[13px] text-white/60 font-mono">{r.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-5">
        <div className="glass rounded-2xl p-6" >
          <SectionLabel>Atlas Memory</SectionLabel>
          <div className="mt-2 text-[13.5px] text-white/85">Typically requests supplementary photos before approving roofing supplements over $4,000.</div>
        </div>
        <div className="glass rounded-2xl p-6">
          <SectionLabel>Contact</SectionLabel>
          <div className="mt-3">
            <InfoRow label="Email"  value="mreynolds@statefarm.com" />
            <InfoRow label="Phone"  value="(404) 555-0122" mono />
            <InfoRow label="Region" value="Southeast" />
          </div>
        </div>
      </div>
    </div>
  </>
)

const CompanyDetail = ({ id = 'State Farm', onBack }) => (
  <>
    <DetailHeader
      eyebrow="Carrier"
      title={id}
      meta="12 active claims · 68% approval · 6.1d average response"
      onBack={onBack}
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-5">
      <div className="lg:col-span-2 space-y-5">
        <div className="glass rounded-2xl p-6">
          <SectionLabel>Behavior Patterns</SectionLabel>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { k: 'Photo evidence', v: 'Required', c: '#F59E0B' },
              { k: 'Weather report', v: 'Preferred', c: '#3B82F6' },
              { k: 'Response SLA',   v: '5–7 days',  c: '#00E6FF' },
            ].map(x => (
              <div key={x.k} className="rounded-xl border border-white/[0.06] p-4 bg-white/[0.02]">
                <div className="text-[16px] font-semibold" style={{ color: x.c }}>{x.v}</div>
                <div className="mt-1.5 text-[10px] tracking-[0.14em] uppercase font-semibold text-white/40">{x.k}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <SectionLabel>Adjusters at {id}</SectionLabel>
          <div className="mt-4 space-y-3">
            {['M. Reynolds','J. Kowalski','K. Martins'].map(n => (
              <div key={n} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400/40 to-blue-500/40 flex items-center justify-center text-[11px] font-bold text-white">
                  {n.split(' ').map(x => x[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 text-[13px] text-white">{n}</div>
                <ChevronRight size={14} className="text-white/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass rounded-2xl p-6" >
        <SectionLabel>Atlas Insight</SectionLabel>
        <div className="mt-2 text-[13.5px] text-white/85">State Farm response latency has increased 22% this quarter. Consider filing supplements with full photo evidence upfront.</div>
      </div>
    </div>
  </>
)

const PropertyDetail = ({ id = '2847 Willow Bend Ln', onBack }) => (
  <>
    <DetailHeader
      eyebrow="Property"
      title={id}
      meta="Charlotte, NC 28210 · Residential · Built 1998"
      onBack={onBack}
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-5">
      <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
        <div className="aspect-video relative"
             style={{ background: 'radial-gradient(400px 200px at 30% 40%, rgba(0,230,255,0.18), transparent 60%), linear-gradient(135deg, #0b1220 0%, #050710 100%)' }}>
          <div className="absolute inset-0 opacity-20"
               style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute bottom-4 left-4 text-[11px] tracking-[0.14em] uppercase font-semibold text-cyan-300">Storm / Hail zone</div>
          <div className="absolute top-4 right-4 px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] text-[11px] text-white/70">Aerial preview</div>
        </div>
        <div className="p-5">
          <SectionLabel>Damage history</SectionLabel>
          <div className="mt-3 space-y-2">
            {[
              { d: 'Jun 4, 2025', e: 'Hail event · 1.5" avg', s: 'Verified' },
              { d: 'Mar 12, 2024', e: 'Wind gusts 62 mph',      s: 'Verified' },
              { d: 'Aug 21, 2023', e: 'Water — plumbing failure',s: 'Closed' },
            ].map((x, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center"><Cloud size={13} className="text-cyan-300" /></div>
                <div className="flex-1"><div className="text-[13px] text-white">{x.e}</div><div className="text-[11px] text-white/45">{x.d}</div></div>
                <span className="text-[10.5px] tracking-[0.14em] uppercase font-semibold text-emerald-400/80 px-2 py-1 rounded-md bg-emerald-400/[0.06] border border-emerald-400/20">{x.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-5">
        <div className="glass rounded-2xl p-6">
          <SectionLabel>Owner</SectionLabel>
          <div className="mt-3">
            <InfoRow label="Name"  value="James Robertson" />
            <InfoRow label="Phone" value="(704) 555-0142" mono />
            <InfoRow label="Email" value="james.r@gmail.com" />
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <SectionLabel>Active claims</SectionLabel>
          <div className="mt-3 space-y-2">
            {['NPP-2026-0848','NPP-2026-0703'].map(c => (
              <div key={c} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[13px] font-mono text-white">{c}</span>
                <ChevronRight size={13} className="text-white/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </>
)

const InterviewDetail = ({ id = 'INT-482', onBack }) => (
  <>
    <DetailHeader
      eyebrow={`Interview · ${id}`}
      title="Homeowner intake — J. Robertson"
      meta="Recorded today · 11:42 · Auto-linked to NPP-2026-0848"
      onBack={onBack}
      right={<>
        <button className="px-3 py-2 rounded-lg glass border border-white/[0.06] text-[12.5px] text-white/70 flex items-center gap-1.5"><Play size={13} /> Play</button>
        <button className="px-3 py-2 rounded-lg glass border border-white/[0.06] text-[12.5px] text-white/70 flex items-center gap-1.5"><Download size={13} /> Transcript</button>
      </>}
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-5">
      <div className="lg:col-span-2 space-y-5">
        <div className="glass rounded-2xl p-6">
          <div className="h-16 flex items-center gap-[3px]">
            {Array.from({ length: 88 }).map((_, k) => {
              const h = 6 + Math.abs(Math.sin(k * 0.4)) * 38
              return <span key={k} className="w-[3px] rounded-full bg-gradient-to-t from-cyan-400/60 to-purple-400/60" style={{ height: `${h}px` }} />
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-white/40 font-mono">
            <span>00:00</span><span>11:42</span>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <SectionLabel>Transcript</SectionLabel>
          <div className="mt-4 space-y-4 text-[13.5px]">
            {[
              { s: 'Melissa October', t: 'Hi James — I just want to walk through what happened last week during the storm. Are you okay with me recording this?', c: '#00E6FF' },
              { s: 'James Robertson', t: "Yeah of course. So the hail started around 4pm on Wednesday. It was maybe 20 minutes, but it was heavy. I've got video from the porch camera.", c: '#A855F7' },
              { s: 'Melissa October', t: "Perfect. Have you noticed any interior water damage since then — ceilings, upstairs bedrooms, anything?", c: '#00E6FF' },
              { s: 'James Robertson', t: 'One spot in the guest room near the north wall. Small stain but it wasn\'t there before the storm.', c: '#A855F7' },
            ].map((m, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-black"
                     style={{ background: `linear-gradient(135deg, ${m.c}, ${m.c}80)` }}>
                  {m.s.split(' ').map(x => x[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold" style={{ color: m.c }}>{m.s}</div>
                  <div className="text-white/85 mt-0.5 leading-relaxed">{m.t}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="glass rounded-2xl p-6">
          <SectionLabel>Atlas Extracted Facts</SectionLabel>
          <ul className="mt-3 space-y-2 text-[13px] text-white/80">
            {['Storm event: Jun 4, 4:00 PM','Duration: ~20 minutes','Porch camera footage exists','Interior stain — north guest room','No previous damage in that area'].map((f,i) => (
              <li key={i} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-cyan-400" />{f}</li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-2xl p-6" >
          <SectionLabel>Next best action</SectionLabel>
          <div className="mt-2 text-[13.5px] text-white/85">Request porch camera footage and schedule interior inspection.</div>
        </div>
      </div>
    </div>
  </>
)

const NoteDetail = ({ onBack }) => (
  <>
    <DetailHeader eyebrow="Note" title="Follow-up notes on adjuster call" meta="Linked to NPP-2026-0837 · 2h ago" onBack={onBack} />
    <div className="glass rounded-2xl p-6 mt-5 text-[14px] text-white/85 leading-relaxed">
      Called M. Reynolds regarding open supplement on NPP-2026-0837. He mentioned the missing weather verification document is holding up review. Committed to upload by EOD. He also confirmed a preference for higher-resolution ridge cap photos on future claims involving hail. Follow-up scheduled for tomorrow at 10 AM.
    </div>
  </>
)

const TaskDetail = ({ onBack }) => (
  <>
    <DetailHeader eyebrow="Task" title="Upload roof measurement report" meta="NPP-2026-0848 · Due today · High priority" onBack={onBack} />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-5">
      <div className="lg:col-span-2 glass rounded-2xl p-6">
        <SectionLabel>Description</SectionLabel>
        <div className="mt-3 text-[14px] text-white/85 leading-relaxed">
          The supplement submission for NPP-2026-0848 requires an updated EagleView roof measurement report before it can be reviewed by State Farm. Upload the latest report and Atlas will auto-link and tag it.
        </div>
        <div className="mt-6 flex items-center gap-2">
          <button className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-[13px] font-semibold flex items-center gap-1.5"><CheckCircle2 size={13} /> Mark complete</button>
          <button className="px-4 py-2.5 rounded-xl glass border border-white/[0.06] text-[13px] text-white/70">Snooze</button>
        </div>
      </div>
      <div className="glass rounded-2xl p-6">
        <InfoRow label="Priority" value="High" />
        <InfoRow label="Due"      value="Today" />
        <InfoRow label="Owner"    value="Melissa October" />
        <InfoRow label="Claim"    value="NPP-2026-0848" mono />
      </div>
    </div>
  </>
)

const AskAtlasDetail = ({ query = '', onBack }) => (
  <>
    <DetailHeader eyebrow="Ask Atlas" title={query || 'What can I help with?'} onBack={onBack} />
    <div className="glass rounded-2xl p-6 mt-5">
      <div className="flex items-start gap-3">
        <AtlasLogo size={22} />
        <div className="text-[14px] text-white/85 leading-relaxed">
          Analyzing your operation for <span className="text-cyan-300 font-medium">"{query}"</span>…
          Atlas will reason across all claims, adjusters, documents and interviews to answer that question.
          Connect your existing backend to unlock live results.
        </div>
      </div>
    </div>
  </>
)

/* Public entry point: renders the right detail view for a given target */
export const DetailView = ({ target, onBack }) => {
  if (!target) return null
  if (target.askAtlas) return <AskAtlasDetail query={target.askAtlas} onBack={onBack} />
  const map = {
    claim:      ClaimDetail,
    supplement: SupplementDetail,
    document:   DocumentDetail,
    adjuster:   AdjusterDetail,
    company:    CompanyDetail,
    property:   PropertyDetail,
    interview:  InterviewDetail,
    note:       NoteDetail,
    task:       TaskDetail,
  }
  const kind = target.kind || target.type?.toLowerCase() || 'claim'
  const Comp = map[kind] || ClaimDetail
  return <Comp id={target.id} onBack={onBack} />
}
