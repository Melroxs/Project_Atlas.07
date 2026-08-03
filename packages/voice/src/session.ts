/**
 * Voice session — owns the assistant's state, conversation history and
 * event fan-out. The client orchestrates STT/TTS/brain around this.
 */

import type {
  EngineEvent,
  EngineListener,
  EngineState,
  TranscriptSegment,
  VoiceAnalytics,
  VoiceConfig,
  VoiceContext,
  VoiceMessage,
  VoiceMode,
  VoicePreferences,
  VoiceStatus,
  VoiceTier,
} from "./types";
import { DEFAULT_PREFERENCES } from "./types";

let messageId = 0;
const nextId = () => `vm-${Date.now()}-${messageId++}`;

const PREF_KEY = "atlas.voice.preferences";
const ANALYTICS_KEY = "atlas.voice.analytics";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}

export class VoiceSession {
  private listeners = new Set<EngineListener>();

  status: VoiceStatus = "idle";
  tier: VoiceTier = "browser";
  muted = false;
  config: VoiceConfig | null = null;
  messages: VoiceMessage[] = [];
  segments: TranscriptSegment[] = [];
  reasoning: string[] = [];
  context: VoiceContext = { page: "", mode: "general" };
  error: string | null = null;
  sttSupported = false;
  ttsSupported = false;
  preferences: VoicePreferences = readJson(PREF_KEY, DEFAULT_PREFERENCES);
  analytics: VoiceAnalytics = readJson(ANALYTICS_KEY, {
    sessions: 0,
    commands: {},
    questions: 0,
    avgLatencyMs: 0,
    failures: 0,
    interruptions: 0,
    lastActiveAt: 0,
  });

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  snapshot(): EngineState {
    return {
      status: this.status,
      tier: this.tier,
      muted: this.muted,
      config: this.config,
      messages: [...this.messages],
      segments: [...this.segments],
      reasoning: [...this.reasoning],
      context: { ...this.context },
      error: this.error,
      supported: { stt: this.sttSupported, tts: this.ttsSupported },
      preferences: { ...this.preferences },
      analytics: { ...this.analytics, commands: { ...this.analytics.commands } },
    };
  }

  /* ---------------- state ---------------- */

  setStatus(status: VoiceStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emit({ type: "state", status });
  }

  setTier(tier: VoiceTier): void {
    if (this.tier === tier) return;
    this.tier = tier;
    this.emit({ type: "tier", tier });
  }

  setConfig(config: VoiceConfig): void {
    this.config = config;
    this.sttSupported = config.stt === "browser";
    this.ttsSupported = config.tts !== "none";
    this.emit({ type: "config", config });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.emit({ type: "muted", muted });
  }

  setError(message: string | null): void {
    this.error = message;
    if (message) this.emit({ type: "error", message });
  }

  setContext(partial: Partial<VoiceContext>): void {
    this.context = { ...this.context, ...partial };
  }

  setMode(mode: VoiceMode): void {
    this.context = { ...this.context, mode };
  }

  /** Drop entity context so stale ids never leak into the next page. */
  resetContext(): void {
    this.context = {
      ...this.context,
      claimId: undefined,
      claimNumber: undefined,
      decisionId: undefined,
      documentId: undefined,
      supplementId: undefined,
      interviewId: undefined,
      extra: undefined,
    };
  }

  setSpeaking(speaking: boolean): void {
    this.emit({ type: "speaking", speaking });
  }

  addReasoning(step: string): void {
    this.reasoning = [...this.reasoning, step].slice(-6);
    this.emit({ type: "reasoning", step });
  }

  clearReasoning(): void {
    this.reasoning = [];
  }

  /* ---------------- preferences ---------------- */

  updatePreferences(partial: Partial<VoicePreferences>): void {
    this.preferences = { ...this.preferences, ...partial };
    writeJson(PREF_KEY, this.preferences);
    this.emit({ type: "preferences", preferences: this.preferences });
  }

  resetPreferences(): void {
    this.preferences = { ...DEFAULT_PREFERENCES };
    writeJson(PREF_KEY, this.preferences);
    this.emit({ type: "preferences", preferences: this.preferences });
  }

  /* ---------------- analytics ---------------- */

  trackSessionStart(): void {
    this.analytics = { ...this.analytics, sessions: this.analytics.sessions + 1 };
    this.persistAnalytics();
  }

  /** Marks the end of a voice session (provider unmount / page unload). */
  trackSessionEnd(): void {
    this.analytics = { ...this.analytics, lastActiveAt: Date.now() };
    this.persistAnalytics();
  }

  trackCommand(intentId: string): void {
    this.analytics = {
      ...this.analytics,
      commands: {
        ...this.analytics.commands,
        [intentId]: (this.analytics.commands[intentId] || 0) + 1,
      },
      lastActiveAt: Date.now(),
    };
    this.persistAnalytics();
  }

  trackQuestion(): void {
    this.analytics = {
      ...this.analytics,
      questions: this.analytics.questions + 1,
      lastActiveAt: Date.now(),
    };
    this.persistAnalytics();
  }

  trackLatency(ms: number): void {
    const prev = this.analytics.avgLatencyMs;
    this.analytics = {
      ...this.analytics,
      // Rolling average over the session.
      avgLatencyMs: prev === 0 ? ms : Math.round((prev + ms) / 2),
      lastActiveAt: Date.now(),
    };
    this.persistAnalytics();
  }

  trackFailure(): void {
    this.analytics = {
      ...this.analytics,
      failures: this.analytics.failures + 1,
      lastActiveAt: Date.now(),
    };
    this.persistAnalytics();
  }

  trackInterruption(): void {
    this.analytics = {
      ...this.analytics,
      interruptions: this.analytics.interruptions + 1,
      lastActiveAt: Date.now(),
    };
    this.persistAnalytics();
  }

  private persistAnalytics(): void {
    writeJson(ANALYTICS_KEY, this.analytics);
    this.emit({ type: "analytics", analytics: this.analytics });
  }

  /* ---------------- messages ---------------- */

  addUserMessage(text: string): VoiceMessage {
    const message: VoiceMessage = {
      id: nextId(),
      role: "user",
      text,
      timestamp: Date.now(),
    };
    this.messages = [...this.messages, message];
    this.emit({ type: "message", message });
    return message;
  }

  beginAssistantMessage(intent?: string): VoiceMessage {
    const message: VoiceMessage = {
      id: nextId(),
      role: "assistant",
      text: "",
      streaming: true,
      intent,
      timestamp: Date.now(),
    };
    this.messages = [...this.messages, message];
    this.emit({ type: "message", message });
    return message;
  }

  appendAssistantDelta(id: string, delta: string): void {
    this.messages = this.messages.map((m) =>
      m.id === id ? { ...m, text: m.text + delta } : m
    );
  }

  finalizeAssistantMessage(id: string): void {
    this.messages = this.messages.map((m) =>
      m.id === id ? { ...m, streaming: false } : m
    );
  }

  pushSegment(segment: TranscriptSegment): void {
    this.segments = [...this.segments, segment].slice(-40);
    this.emit({ type: "segment", segment });
  }

  clear(): void {
    this.messages = [];
    this.segments = [];
    this.reasoning = [];
  }
}
