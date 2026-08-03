/**
 * Atlas Voice Orchestration Engine — shared types.
 *
 * The core engine is framework-agnostic. React bindings (provider + hooks)
 * live in provider.tsx / hooks.ts. Nothing outside this package should call
 * LiveKit, the browser Speech APIs, or the TTS/STT providers directly.
 */

/** Which realtime transport the engine is currently using. */
export type VoiceTier = "livekit" | "browser" | "mock";

/** Lifecycle state of the assistant. */
export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

/** Contextual mode — derived from the page the user is on. */
export type VoiceMode =
  | "general"
  | "claim"
  | "decision"
  | "document"
  | "interview"
  | "supplement"
  | "demo"
  | "evidence";

/** Capability report fetched from the server (booleans only — never secrets). */
export interface VoiceConfig {
  enabled: boolean;
  livekit: boolean;
  ai: boolean;
  tts: "cartesia" | "browser" | "none";
  stt: "browser" | "none";
  tier: VoiceTier;
}

/** A single message in the conversation. */
export interface VoiceMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  streaming?: boolean;
  intent?: string;
  timestamp: number;
}

/** Live transcript segment (partial STT results). */
export interface TranscriptSegment {
  id: string;
  role: "user";
  text: string;
  final: boolean;
  timestamp: number;
}

/** What the user is looking at — modules expose this to the assistant. */
export interface VoiceContext {
  page: string;
  mode: VoiceMode;
  claimId?: string;
  claimNumber?: string;
  decisionId?: string;
  documentId?: string;
  supplementId?: string;
  interviewId?: string;
  extra?: Record<string, string>;
}

/** Result of executing an Atlas tool. */
export interface ToolResult {
  ok: boolean;
  text: string;
  data?: unknown;
  navigate?: string;
  error?: string;
}

/** A callable Atlas capability. Every tool calls an existing API. */
export interface ToolDefinition {
  id: string;
  description: string;
  run(
    args: Record<string, unknown>,
    ctx: ToolContext
  ): Promise<ToolResult>;
}

export interface ToolContext {
  page: string;
  mode: VoiceMode;
  claimId?: string;
  claimNumber?: string;
  decisionId?: string;
  documentId?: string;
  supplementId?: string;
  interviewId?: string;
  extra?: Record<string, string>;
  navigate?: (path: string) => void;
}

/** Input to the AI brain. */
export interface BrainRequest {
  text: string;
  context: VoiceContext;
  history: VoiceMessage[];
}

/** Brain streaming contract. */
export interface AtlasBrain {
  /** Stream a reply; onDelta receives partial text. Resolves with full text. */
  ask(req: BrainRequest, onDelta: (delta: string) => void): Promise<string>;
  /** Cancel any in-flight ask. */
  abort(): void;
}

/**
 * User-configurable voice preferences. Persisted locally so they survive
 * navigation and reloads; nothing sensitive is ever stored server-side.
 */
export interface VoicePreferences {
  /** TTS voice name preference ("" = automatic / browser default). */
  voice: string;
  /** STT + TTS language code (e.g. "en-US", "en-GB", "es-ES"). */
  language: string;
  /** Speech rate 0.5 – 2.0. */
  rate: number;
  /** Speech pitch 0 – 2. */
  pitch: number;
  /** Output volume 0 – 1. */
  volume: number;
  /** Wake word ("Atlas") arms hands-free activation. */
  wakeWord: boolean;
  /** Restart listening after each response when idle. */
  autoListen: boolean;
  /** Hold-to-talk push-to-talk mode. */
  pushToTalk: boolean;
  /** Keep listening across turns (continuous conversation). */
  continuous: boolean;
}

export const DEFAULT_PREFERENCES: VoicePreferences = {
  voice: "",
  language: "en-US",
  rate: 1.02,
  pitch: 1,
  volume: 1,
  wakeWord: false,
  autoListen: false,
  pushToTalk: false,
  continuous: false,
};

/** Rolling analytics captured by the engine (local, non-sensitive). */
export interface VoiceAnalytics {
  /** Total assistant sessions in this browser. */
  sessions: number;
  /** Commands executed keyed by intent id. */
  commands: Record<string, number>;
  /** Free-form questions asked. */
  questions: number;
  /** Average AI latency (ms). */
  avgLatencyMs: number;
  /** Transcription / provider failures. */
  failures: number;
  /** Interruptions requested while speaking/thinking. */
  interruptions: number;
  /** Last interaction timestamp (ms). */
  lastActiveAt: number;
}

/** Events emitted by the engine to subscribers. */
export type EngineEvent =
  | { type: "state"; status: VoiceStatus }
  | { type: "tier"; tier: VoiceTier }
  | { type: "message"; message: VoiceMessage }
  | { type: "segment"; segment: TranscriptSegment }
  | { type: "speaking"; speaking: boolean }
  | { type: "muted"; muted: boolean }
  | { type: "reasoning"; step: string }
  | { type: "error"; message: string }
  | { type: "config"; config: VoiceConfig }
  | { type: "preferences"; preferences: VoicePreferences }
  | { type: "analytics"; analytics: VoiceAnalytics };

export type EngineListener = (event: EngineEvent) => void;

export interface EngineOptions {
  /** Base URL for Atlas API routes (defaults to same-origin ""). */
  apiBase?: string;
  /** App-level navigation callback (used by navigation tools). */
  navigate?: (path: string) => void;
  /** Returns the current page context (set by the host app). */
  getContext?: () => VoiceContext;
}

export interface EngineState {
  status: VoiceStatus;
  tier: VoiceTier;
  muted: boolean;
  config: VoiceConfig | null;
  messages: VoiceMessage[];
  segments: TranscriptSegment[];
  reasoning: string[];
  context: VoiceContext;
  error: string | null;
  supported: { stt: boolean; tts: boolean };
  preferences: VoicePreferences;
  analytics: VoiceAnalytics;
}

/** Public API exposed to React via useVoice(). */
export interface VoiceActions {
  startListening(): void;
  stopListening(): void;
  toggleMute(): void;
  interrupt(): void;
  speak(text: string): void;
  askAtlas(text: string): Promise<void>;
  runCommand(text: string): Promise<void>;
  clearConversation(): void;
  setMode(mode: VoiceMode): void;
  setContext(partial: Partial<VoiceContext>): void;
  /** Clear entity context (claim/document/decision/...) — used on page unmount. */
  clearContext(): void;
  /** Update voice preferences (partial merge). */
  updatePreferences(partial: Partial<VoicePreferences>): void;
  /** Reset voice preferences to defaults. */
  resetPreferences(): void;
  /** Trigger push-to-talk capture (hold). */
  pushToTalkStart(): void;
  /** Release push-to-talk — processes the captured utterance. */
  pushToTalkEnd(): void;
}
