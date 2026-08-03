'use client';

/**
 * Floating Atlas Assistant — the global voice UI.
 *
 * Visible throughout the application. Collapsible, draggable, always
 * available. Handles mic input, live transcript, AI reply streaming,
 * connection indicator, mute, push-to-talk, wake word, keyboard shortcuts,
 * waveform animation, volume, voice settings and analytics.
 * Reuses existing Atlas design tokens.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoice, shouldReduceMotion } from '@project-atlas/voice';
import { useDemoToast } from '@/components/demo/DemoToast';
import { trackVoiceAnalytics } from '@/lib/voice-analytics';

type PanelState = 'closed' | 'compact' | 'expanded';
type TabId = 'chat' | 'history' | 'settings' | 'analytics';

const VOICE_PRESETS = [
  { label: 'Default', value: '' },
  { label: 'Female (EN)', value: 'en-female' },
  { label: 'Male (EN)', value: 'en-male' },
];

const LANGUAGES = [
  { label: 'English (US)', value: 'en-US' },
  { label: 'English (UK)', value: 'en-GB' },
  { label: 'Spanish', value: 'es-ES' },
  { label: 'French', value: 'fr-FR' },
  { label: 'German', value: 'de-DE' },
];

export default function AtlasAssistant() {
  const { state, actions } = useVoice();
  const toast = useDemoToast();
  const [panel, setPanel] = useState<PanelState>('closed');
  const [typing, setTyping] = useState('');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragEl = useRef({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [alwaysListening, setAlwaysListening] = useState(false);
  const [expandedTab, setExpandedTab] = useState<TabId>('chat');
  const [wave, setWave] = useState<number[]>(Array.from({ length: 24 }, () => 6));

  const prefs = state.preferences;

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, state.segments]);

  // Waveform animation while listening / speaking / thinking
  // (static gentle bars under prefers-reduced-motion)
  useEffect(() => {
    const reduced = shouldReduceMotion();
    if (state.status !== 'listening' && state.status !== 'speaking' && state.status !== 'thinking') {
      setWave(Array.from({ length: 24 }, () => 4));
      return;
    }
    if (reduced) {
      setWave(Array.from({ length: 24 }, (_, i) => 6 + (i % 5) * 2));
      return;
    }
    const id = setInterval(() => {
      setWave(Array.from({ length: 24 }, () => Math.floor(4 + Math.random() * 22)));
    }, 140);
    return () => clearInterval(id);
  }, [state.status]);

  // Focus the text input whenever the panel opens
  useEffect(() => {
    if (panel !== 'closed' && expandedTab === 'chat') {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [panel, expandedTab]);

  // Always-listening mode — restarts STT when it ends
  useEffect(() => {
    if (!alwaysListening && !prefs.autoListen) return;
    if (panel === 'closed') return;
    if (state.status === 'idle' && state.supported.stt) {
      const timer = setTimeout(() => actions.startListening(), 600);
      return () => clearTimeout(timer);
    }
  }, [alwaysListening, prefs.autoListen, state.status, state.supported.stt, panel, actions]);

  // Keyboard shortcuts: Ctrl/Cmd+K toggles the panel, Spacebar toggles mic,
  // Escape closes the panel (only when not focused in an input/textarea).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typingField = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      // Escape closes the assistant panel
      if (e.key === 'Escape' && panel !== 'closed') {
        setPanel('closed');
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPanel((p) => {
          const next = p === 'closed' ? 'compact' : 'closed';
          if (next !== 'closed') trackVoiceAnalytics({ type: 'assistant', command: 'shortcut-open' });
          return next;
        });
        return;
      }

      if (e.code === 'Space' && !typingField && panel !== 'closed' && state.supported.stt) {
        if (prefs.pushToTalk) {
          e.preventDefault();
          actions.pushToTalkStart();
          window.addEventListener('keyup', () => actions.pushToTalkEnd(), { once: true });
        } else {
          e.preventDefault();
          if (state.status === 'listening') actions.stopListening();
          else actions.startListening();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, state.supported.stt, prefs.pushToTalk, state.status, actions]);

  // Send typed message
  const sendTyped = useCallback(() => {
    const text = typing.trim();
    if (!text) return;
    setTyping('');
    if (text.length < 2) return;
    trackVoiceAnalytics({ type: 'command', command: 'typed' });
    actions.runCommand(text);
  }, [typing, actions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTyped();
    }
  };

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (panel !== 'closed') return;
    setDragging(true);
    dragStart.current = { x: e.clientX - dragEl.current.x, y: e.clientY - dragEl.current.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const x = Math.max(-window.innerWidth + 80, Math.min(window.innerWidth - 80, e.clientX - dragStart.current.x));
    const y = Math.max(-window.innerHeight + 80, Math.min(window.innerHeight - 80, e.clientY - dragStart.current.y));
    dragEl.current = { x, y };
    setDragOffset({ x, y });
  };

  const onPointerUp = () => setDragging(false);

  // Connection / status indicator
  const statusColor = (): string => {
    if (state.status === 'connecting') return 'bg-yellow-400';
    if (state.status === 'listening') return 'bg-green-400';
    if (state.status === 'thinking') return 'bg-[var(--brand-purple)]';
    if (state.status === 'speaking') return 'bg-[var(--brand-cyan)]';
    if (state.status === 'error') return 'bg-[var(--color-error)]';
    if (state.tier === 'livekit') return 'bg-green-500';
    return 'bg-[var(--neutral-gray-400)]';
  };

  const statusText = (): string => {
    if (state.status === 'connecting') return 'Connecting…';
    if (state.status === 'listening') return 'Listening…';
    if (state.status === 'thinking') return 'Thinking…';
    if (state.status === 'speaking') return 'Speaking…';
    if (state.status === 'error') return state.error || 'Error';
    if (state.muted) return 'Muted';
    if (state.tier === 'livekit') return 'LiveKit';
    return prefs.wakeWord ? 'Wake word: "Atlas"' : 'Idle';
  };

  // Mic animation pulse class
  const micPulse = state.status === 'listening' ? 'animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.5)]' : '';

  // Close panel
  const close = () => {
    if (state.status === 'listening') actions.stopListening();
    setPanel('closed');
    setAlwaysListening(false);
  };

  const toggleMic = () => {
    if (state.status === 'listening') {
      actions.stopListening();
      trackVoiceAnalytics({ type: 'stop' });
    } else {
      actions.startListening();
      trackVoiceAnalytics({ type: 'start' });
    }
  };

  const interrupt = () => {
    actions.interrupt();
    toast.info('Interrupted — say or type something else.');
  };

  const setPref = (key: keyof typeof prefs, value: boolean | string | number) => {
    actions.updatePreferences({ [key]: value } as Partial<typeof prefs>);
  };

  return (
    <>
      {/* Floating trigger button */}
      <div
        className="fixed z-50"
        style={{
          right: 24 + dragOffset.x,
          bottom: 24 + dragOffset.y,
        }}
      >
        {/* Draggable mic button */}
        {panel === 'closed' && (
          <button
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={() => {
              setPanel('compact');
              trackVoiceAnalytics({ type: 'assistant', command: 'open' });
            }}
            className={`relative w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-lg transition-all duration-200 cursor-grab active:cursor-grabbing
              ${micPulse}
              ${state.status === 'thinking' || state.status === 'speaking'
                ? 'bg-gradient-to-br from-[var(--brand-purple)] to-[var(--brand-cyan)]'
                : 'bg-[var(--surface)] border border-[var(--neutral-gray-300)] hover:border-[var(--brand-purple)]'
              }
            `}
            aria-label="Open Atlas Voice"
            title="Atlas Voice (Ctrl+K)"
          >
            <span className="text-2xl">
              {state.status === 'listening' ? '🎤' : state.status === 'thinking' ? '🤔' : state.status === 'speaking' ? '🗣️' : '🎙️'}
            </span>
            {/* Status dot */}
            <span className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface)] ${statusColor()}`} />
            {/* Wake word badge */}
            {prefs.wakeWord && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-[var(--brand-purple)] text-white rounded-full px-1.5 py-0.5">
                ATLAS
              </span>
            )}
          </button>
        )}

        {/* Compact / Expanded panel */}
        {panel !== 'closed' && (
          <div
            role="dialog"
            aria-label="Atlas Voice Assistant"
            className={`bg-[var(--surface)] border border-[var(--neutral-gray-200)] rounded-xl shadow-2xl flex flex-col transition-all duration-200
              ${panel === 'compact' ? 'w-80 h-96' : 'w-[28rem] h-[34rem]'}
              max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)]
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--neutral-gray-200)] shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${statusColor()}`} />
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {statusText()}
                  {state.tier === 'livekit' && <span className="ml-1 text-[10px] text-[var(--brand-cyan)]">⚡</span>}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPanel(panel === 'compact' ? 'expanded' : 'compact')}
                  className="px-2 py-1 text-xs text-[var(--neutral-gray-500)] hover:text-[var(--foreground)]"
                  aria-label={panel === 'compact' ? 'Expand' : 'Compact'}
                >
                  {panel === 'compact' ? '⤢' : '⤡'}
                </button>
                <button
                  onClick={() => setAlwaysListening((v) => !v)}
                  className={`px-2 py-1 text-xs rounded ${
                    alwaysListening
                      ? 'bg-[var(--brand-purple)]/20 text-[var(--brand-purple)]'
                      : 'text-[var(--neutral-gray-500)]'
                  }`}
                  aria-label="Always listening"
                  title="Always listening"
                >
                  🔄
                </button>
                <button
                  onClick={() => actions.toggleMute()}
                  className={`px-2 py-1 text-xs ${state.muted ? 'text-[var(--color-error)]' : 'text-[var(--neutral-gray-500)]'}`}
                  aria-label="Toggle mute"
                >
                  {state.muted ? '🔇' : '🔊'}
                </button>
                <button
                  onClick={close}
                  className="px-2 py-1 text-xs text-[var(--neutral-gray-500)] hover:text-[var(--color-error)]"
                  aria-label="Close assistant"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tab bar (expanded only) */}
            {panel === 'expanded' && (
              <div className="flex border-b border-[var(--neutral-gray-200)] px-2">
                {(['chat', 'history', 'settings', 'analytics'] as TabId[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setExpandedTab(tab)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize ${
                      expandedTab === tab
                        ? 'text-[var(--brand-purple)] border-b-2 border-[var(--brand-purple)]'
                        : 'text-[var(--neutral-gray-500)]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            {/* Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {/* Chat tab */}
              {expandedTab === 'chat' ? (
                <>
                  {/* Waveform */}
                  {(state.status === 'listening' || state.status === 'speaking' || state.status === 'thinking') && (
                    <div className="flex items-end justify-center gap-[3px] h-8 mb-1" aria-hidden>
                      {wave.map((h, i) => (
                        <span
                          key={i}
                          className={`w-[3px] rounded-full transition-all duration-150 ${
                            state.status === 'listening' ? 'bg-green-400' : state.status === 'speaking' ? 'bg-[var(--brand-cyan)]' : 'bg-[var(--brand-purple)]'
                          }`}
                          style={{ height: `${h}px` }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Live transcript segments */}
                  {state.segments.slice(-4).map((seg) => (
                    <div key={seg.id} className="flex justify-end">
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                        seg.final
                          ? 'bg-[var(--brand-cyan)]/20 text-[var(--foreground)]'
                          : 'bg-[var(--background-alt)] border border-dashed border-[var(--neutral-gray-300)] text-[var(--neutral-gray-500)] italic'
                      }`}>
                        {seg.text}
                        {!seg.final && <span className="animate-pulse">▍</span>}
                      </div>
                    </div>
                  ))}

                  {/* Conversation messages */}
                  {state.messages.slice(-12).map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-[var(--brand-purple)]/20 text-[var(--foreground)]'
                          : 'bg-[var(--background-alt)] border border-[var(--neutral-gray-200)] text-[var(--foreground)]'
                      }`}>
                        {msg.role === 'assistant' && (
                          <span className="text-[10px] font-semibold text-[var(--brand-purple)] block mb-0.5">ATLAS</span>
                        )}
                        {msg.text || (msg.streaming && <span className="animate-pulse">▍</span>)}
                        {!msg.text && !msg.streaming && <span className="italic text-[var(--neutral-gray-400)]">(empty)</span>}
                      </div>
                    </div>
                  ))}

                  {/* Thinking indicator */}
                  {state.status === 'thinking' && state.reasoning.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-[var(--neutral-gray-500)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-purple)] animate-pulse" />
                      {state.reasoning[state.reasoning.length - 1]}
                    </div>
                  )}
                </>
              ) : expandedTab === 'history' ? (
                /* History tab */
                <div className="space-y-1.5">
                  {state.messages.length === 0 && (
                    <p className="text-xs text-[var(--neutral-gray-400)] italic">No conversation history yet.</p>
                  )}
                  {state.messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2 text-xs">
                      <span className={`shrink-0 mt-0.5 ${msg.role === 'user' ? 'text-[var(--brand-cyan)]' : 'text-[var(--brand-purple)]'}`}>
                        {msg.role === 'user' ? '→' : '←'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--foreground)] truncate">{msg.text || '(empty)'}</p>
                        <span className="text-[10px] text-[var(--neutral-gray-400)]">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {state.messages.length > 0 && (
                    <button
                      onClick={() => actions.clearConversation()}
                      className="w-full mt-2 px-2 py-1 text-xs text-[var(--neutral-gray-500)] hover:text-[var(--color-error)]"
                    >
                      Clear history
                    </button>
                  )}
                </div>
              ) : expandedTab === 'settings' ? (
                /* Settings tab */
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--neutral-gray-500)] mb-1">Voice</label>
                    <div className="flex flex-wrap gap-1.5">
                      {VOICE_PRESETS.map((v) => (
                        <button
                          key={v.value}
                          onClick={() => setPref('voice', v.value)}
                          className={`px-2 py-1 rounded text-xs border ${
                            prefs.voice === v.value
                              ? 'border-[var(--brand-purple)] text-[var(--brand-purple)] bg-[var(--brand-purple)]/10'
                              : 'border-[var(--neutral-gray-300)] text-[var(--neutral-gray-500)]'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--neutral-gray-500)] mb-1">Language</label>
                    <select
                      value={prefs.language}
                      onChange={(e) => setPref('language', e.target.value)}
                      className="w-full bg-[var(--background-alt)] border border-[var(--neutral-gray-300)] rounded-lg px-2 py-1.5 text-xs text-[var(--foreground)]"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[var(--neutral-gray-500)] mb-1">
                      <span>Speed</span><span>{prefs.rate.toFixed(2)}×</span>
                    </div>
                    <input
                      type="range" min={0.5} max={2} step={0.05} value={prefs.rate}
                      onChange={(e) => setPref('rate', Number(e.target.value))}
                      className="w-full accent-[var(--brand-purple)]"
                      aria-label="Speech speed"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[var(--neutral-gray-500)] mb-1">
                      <span>Pitch</span><span>{prefs.pitch.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min={0} max={2} step={0.1} value={prefs.pitch}
                      onChange={(e) => setPref('pitch', Number(e.target.value))}
                      className="w-full accent-[var(--brand-purple)]"
                      aria-label="Speech pitch"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[var(--neutral-gray-500)] mb-1">
                      <span>Volume</span><span>{Math.round(prefs.volume * 100)}%</span>
                    </div>
                    <input
                      type="range" min={0} max={1} step={0.05} value={prefs.volume}
                      onChange={(e) => setPref('volume', Number(e.target.value))}
                      className="w-full accent-[var(--brand-purple)]"
                      aria-label="Output volume"
                    />
                  </div>

                  <div className="space-y-2">
                    {([
                      ['wakeWord', 'Wake word ("Atlas")', 'Start hands-free by saying "Atlas"'],
                      ['autoListen', 'Auto-listen', 'Restart listening after each response'],
                      ['pushToTalk', 'Push-to-talk', 'Hold Spacebar to talk instead of toggle'],
                      ['continuous', 'Continuous conversation', 'Keep the mic hot between turns'],
                    ] as Array<[keyof typeof prefs, string, string]>).map(([key, label, hint]) => (
                      <label key={key} className="flex items-center justify-between gap-2 cursor-pointer">
                        <span className="text-xs text-[var(--foreground)]">
                          {label}
                          <span className="block text-[10px] text-[var(--neutral-gray-400)]">{hint}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(prefs[key])}
                          onChange={(e) => setPref(key, e.target.checked)}
                          className="accent-[var(--brand-purple)]"
                        />
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={() => { actions.resetPreferences(); toast.info('Voice preferences reset to defaults.'); }}
                    className="w-full mt-1 px-2 py-1.5 text-xs text-[var(--neutral-gray-500)] hover:text-[var(--color-error)] border border-[var(--neutral-gray-200)] rounded-lg"
                  >
                    Reset to defaults
                  </button>
                </div>
              ) : (
                /* Analytics tab */
                <div className="space-y-2 text-xs">
                  <p className="text-[11px] font-semibold text-[var(--neutral-gray-500)]">Voice usage (this browser)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['Sessions', state.analytics.sessions],
                      ['Questions', state.analytics.questions],
                      ['Interruptions', state.analytics.interruptions],
                      ['Failures', state.analytics.failures],
                    ] as Array<[string, number]>).map(([label, value]) => (
                      <div key={label} className="bg-[var(--background-alt)] rounded-lg px-3 py-2">
                        <p className="text-lg font-bold text-[var(--foreground)]">{value}</p>
                        <p className="text-[10px] text-[var(--neutral-gray-400)]">{label}</p>
                      </div>
                    ))}
                    <div className="bg-[var(--background-alt)] rounded-lg px-3 py-2 col-span-2">
                      <p className="text-lg font-bold text-[var(--foreground)]">
                        {state.analytics.avgLatencyMs ? `${state.analytics.avgLatencyMs}ms` : '—'}
                      </p>
                      <p className="text-[10px] text-[var(--neutral-gray-400)]">Avg AI response latency</p>
                    </div>
                  </div>
                  {Object.keys(state.analytics.commands).length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--neutral-gray-500)] mb-1">Commands</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(state.analytics.commands).map(([cmd, n]) => (
                          <span key={cmd} className="px-2 py-0.5 rounded-full bg-[var(--brand-purple)]/10 text-[var(--brand-purple)] text-[10px]">
                            {cmd} ×{n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom bar: mic + typing + commands */}
            <div className="shrink-0 border-t border-[var(--neutral-gray-200)] px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                {/* Mic button — toggle or push-to-talk hold */}
                {prefs.pushToTalk ? (
                  <button
                    onPointerDown={(e) => { e.preventDefault(); actions.pushToTalkStart(); }}
                    onPointerUp={(e) => { e.preventDefault(); actions.pushToTalkEnd(); }}
                    onPointerLeave={() => actions.pushToTalkEnd()}
                    onKeyDown={(e) => { if (e.key === 'Enter') actions.pushToTalkStart(); }}
                    onKeyUp={(e) => { if (e.key === 'Enter') actions.pushToTalkEnd(); }}
                    disabled={state.status === 'thinking' || state.status === 'speaking'}
                    className={`w-12 h-10 rounded-full flex items-center justify-center text-lg transition-all shrink-0 select-none ${
                      state.status === 'listening'
                        ? 'bg-green-500 text-white shadow-lg animate-pulse'
                        : 'bg-[var(--background-alt)] border border-[var(--neutral-gray-300)] hover:border-[var(--brand-purple)] text-[var(--foreground)]'
                    } disabled:opacity-50`}
                    aria-label="Hold to talk (push-to-talk)"
                    title="Hold to talk"
                  >
                    🎤
                  </button>
                ) : (
                  <button
                    onClick={toggleMic}
                    disabled={state.status === 'thinking' || state.status === 'speaking'}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all shrink-0 ${
                      state.status === 'listening'
                        ? 'bg-green-500 text-white shadow-lg animate-pulse'
                        : 'bg-[var(--background-alt)] border border-[var(--neutral-gray-300)] hover:border-[var(--brand-purple)] text-[var(--foreground)]'
                    } disabled:opacity-50`}
                    aria-label={state.status === 'listening' ? 'Stop listening' : 'Start listening'}
                  >
                    🎤
                  </button>
                )}
                {/* Interrupt while speaking */}
                {state.status === 'speaking' && (
                  <button
                    onClick={interrupt}
                    className="shrink-0 px-2 py-2 bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/30 rounded-lg text-xs font-medium"
                    aria-label="Interrupt Atlas"
                  >
                    ✋ Stop
                  </button>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={typing}
                  onChange={(e) => setTyping(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={prefs.wakeWord ? 'Ask Atlas anything… ("Atlas" wakes me)' : 'Ask Atlas anything…'}
                  className="flex-1 bg-[var(--background-alt)] border border-[var(--neutral-gray-300)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--neutral-gray-400)] focus:outline-none focus:border-[var(--brand-purple)]"
                  disabled={state.status === 'thinking'}
                />
                <button
                  onClick={sendTyped}
                  disabled={!typing.trim() || state.status === 'thinking'}
                  className="shrink-0 px-3 py-2 bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  Send
                </button>
              </div>
              {/* Quick action chips */}
              <div className="flex flex-wrap gap-1.5">
                {['Open claims', 'Generate supplement', 'Explain decision', 'Run demo'].map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => {
                      setExpandedTab('chat');
                      trackVoiceAnalytics({ type: 'command', command: cmd });
                      actions.runCommand(cmd);
                    }}
                    className="px-2 py-1 rounded-full text-[10px] font-medium border border-[var(--neutral-gray-300)] text-[var(--neutral-gray-500)] hover:border-[var(--brand-purple)] hover:text-[var(--brand-purple)] transition-colors"
                  >
                    {cmd}
                  </button>
                ))}
                <span className="px-2 py-1 rounded-full text-[10px] text-[var(--neutral-gray-400)] border border-dashed border-[var(--neutral-gray-300)]">
                  Ctrl+K · Space = mic
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
