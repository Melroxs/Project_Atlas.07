/**
 * Voice engine client — the central orchestrator thread.
 *
 * Wires together STT, TTS, the brain, the command router, the tool registry,
 * and the session. The React provider mounts one instance and exposes it via
 * `useVoice()`. Nothing outside this package creates a second namespace.
 */

import type {
  EngineOptions,
  EngineState,
  VoiceActions,
  VoiceConfig,
  VoiceContext,
  VoiceMode,
  ToolContext,
  ToolResult,
  VoicePreferences,
} from "./types";
import { VoiceSession } from "./session";
import {
  BrowserSttProvider,
  BrowserTtsProvider,
  CartesiaTtsProvider,
  NoopTtsProvider,
  detectWakeWord,
  stripWakeWord,
  type TtsOptions,
} from "./speech";
import { HttpAtlasBrain, LocalAtlasBrain } from "./gemini";
import { LiveKitVoiceTransport } from "./livekit";
import { ToolRegistry } from "./tools";
import { parseCommand, resolveContext, modeForIntent } from "./commands";

export { ToolRegistry };
export type { ToolRegistry as ToolRegistryType } from "./tools";

export class VoiceEngine {
  readonly session = new VoiceSession();
  readonly tools = new ToolRegistry();
  private options: EngineOptions;
  private stt!: BrowserSttProvider;
  private tts!: BrowserTtsProvider | CartesiaTtsProvider | NoopTtsProvider;
  private brain!: HttpAtlasBrain | LocalAtlasBrain;
  private livekit!: LiveKitVoiceTransport;
  private lastAskStartedAt = 0;

  /* --- constructor / config ------------------------------------------- */

  constructor(options: EngineOptions = {}) {
    this.options = { apiBase: "", ...options };
    const api = this.options.apiBase ?? "";
    this.livekit = new LiveKitVoiceTransport(api);
    this.brain = new LocalAtlasBrain(); // upgraded after fetchConfig
    this.stt = new BrowserSttProvider();
    this.tts = "speechSynthesis" in globalThis
      ? new BrowserTtsProvider()
      : new NoopTtsProvider();
    this.session.sttSupported = this.stt.supported;
    this.session.ttsSupported =
      typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Fetch server-side voice config (booleans only, no secrets). */
  async fetchConfig(context: VoiceContext): Promise<VoiceConfig> {
    this.session.setContext(context);
    try {
      const res = await fetch(
        `${this.options.apiBase ?? ""}/api/voice/config`,
        { headers: { "Content-Type": "application/json" } }
      );
      if (!res.ok) throw new Error(`voice config ${res.status}`);
      const cfg: VoiceConfig = await res.json();
      this.session.setConfig(cfg);
      this.session.setTier(cfg.tier);

      // Upgrade brain if AI is configured.
      if (cfg.ai) {
        this.brain = new HttpAtlasBrain(this.options.apiBase ?? "");
      } else {
        this.brain = new LocalAtlasBrain();
      }

      // Upgrade TTS if Cartesia is configured.
      if (cfg.tts === "cartesia" && this.options.apiBase) {
        this.tts = new CartesiaTtsProvider(this.options.apiBase);
      } else {
        this.tts = "speechSynthesis" in globalThis
          ? new BrowserTtsProvider()
          : new NoopTtsProvider();
      }

      return cfg;
    } catch {
      const fallback: VoiceConfig = {
        enabled: true,
        livekit: false,
        ai: false,
        tts: "browser",
        stt: "browser",
        tier: "browser",
      };
      this.session.setConfig(fallback);
      this.brain = new LocalAtlasBrain();
      this.tts = "speechSynthesis" in globalThis
        ? new BrowserTtsProvider()
        : new NoopTtsProvider();
      this.session.sttSupported = true;
      this.session.ttsSupported = "speechSynthesis" in window;
      return fallback;
    }
  }

  /** Try to connect via LiveKit; on failure the engine stays on the browser tier. */
  async tryLiveKitConnect(): Promise<void> {
    if (!this.session.config?.livekit) return;
    this.session.setStatus("connecting");
    const result = await this.livekit.connect({
      onConnected: () => {
        this.session.setTier("livekit");
        this.session.setStatus("listening");
      },
      onDisconnected: () => {
        this.session.setTier("browser");
        this.session.setStatus("idle");
      },
      onAgentAudio: () => {
        this.session.setSpeaking(true);
      },
      onError: () => {
        this.session.setTier("browser");
        this.session.setStatus("idle");
      },
    });
    if (result !== "connected") {
      this.session.setTier("browser");
      this.session.setStatus("idle");
    }
  }

  /* --- public API exposed via hooks ---------------------------------- */

  /** Return the current public state as a plain object. */
  getState(): EngineState {
    return this.session.snapshot();
  }

  get actions(): VoiceActions {
    return {
      startListening: () => this.startListening(),
      stopListening: () => this.stopListening(),
      toggleMute: () => this.toggleMute(),
      interrupt: () => this.interrupt(),
      speak: (text) => this.speak(text),
      askAtlas: (text) => this.askAtlas(text),
      runCommand: (text) => this.runCommand(text),
      clearConversation: () => this.clearConversation(),
      setMode: (m) => this.session.setMode(m),
      setContext: (p) => this.session.setContext(p),
      clearContext: () => this.session.resetContext(),
      updatePreferences: (p) => this.updatePreferences(p),
      resetPreferences: () => this.session.resetPreferences(),
      pushToTalkStart: () => this.pushToTalkStart(),
      pushToTalkEnd: () => this.pushToTalkEnd(),
    };
  }

  /* --------------- preferences --------------- */

  updatePreferences(partial: Partial<VoicePreferences>): void {
    this.session.updatePreferences(partial);
  }

  /* --------------- listening (STT) --------------- */

  startListening() {
    if (this.session.status === "listening") return;
    if (this.livekit.connected) {
      this.session.setStatus("listening");
      return; // LiveKit handles mic
    }
    this.session.setStatus("listening");
    if (!this.stt.supported) {
      // No browser STT — the user types into the floating assistant.
      return;
    }
    const prefs = this.session.preferences;
    this.stt.start({
      lang: prefs.language || "en-US",
      continuous: prefs.continuous,
      onPartial: (text) =>
        this.session.pushSegment({
          id: `seg-${Date.now()}`,
          role: "user",
          text,
          final: false,
          timestamp: Date.now(),
        }),
      onFinal: (text) => {
        this.session.pushSegment({
          id: `seg-${Date.now()}`,
          role: "user",
          text,
          final: true,
          timestamp: Date.now(),
        });
        // Wake word: strip it and treat the rest as the command.
        const isWake = detectWakeWord(text);
        const command = isWake ? stripWakeWord(text) : text.trim();
        if (isWake) {
          this.session.setMode("general");
          this.speak("Yes?");
        }
        this.processInput(command);
      },
      onEnd: () => {
        if (this.session.status === "listening") {
          this.session.setStatus("idle");
        }
        // Auto-listen restarts capture after a turn (continuous conversation).
        if (prefs.autoListen || prefs.continuous) {
          setTimeout(() => {
            if (this.session.status === "idle") this.startListening();
          }, 400);
        }
      },
      onError: (msg) => {
        this.session.setError(msg);
        this.session.trackFailure();
        this.session.setStatus("idle");
      },
    });
  }

  stopListening() {
    this.stt.stop();
    this.livekit.disconnect();
    this.session.setStatus("idle");
  }

  /** Push-to-talk: begin capture. */
  pushToTalkStart() {
    this.session.trackSessionStart();
    if (this.session.status === "listening") return;
    this.startListening();
  }

  /** Push-to-talk: end capture and process the final utterance. */
  pushToTalkEnd() {
    // STT already processes final transcripts on result — just idle out.
    this.stt.stop();
    this.livekit.disconnect();
    if (this.session.status === "listening") {
      this.session.setStatus("idle");
    }
  }

  toggleMute() {
    const next = !this.session.muted;
    this.session.setMuted(next);
    if (this.livekit.connected) {
      this.livekit.setMuted(next).catch(() => {});
    }
    if (next) {
      this.tts.stop();
    }
  }

  interrupt() {
    this.brain.abort();
    this.tts.stop();
    this.livekit.disconnect();
    this.session.trackInterruption();
    this.session.setStatus("idle");
    this.session.setSpeaking(false);
  }

  /* --------------- speak (TTS) --------------- */

  speak(text: string) {
    if (!text || this.session.muted) return;
    this.session.setStatus("speaking");
    this.session.setSpeaking(true);
    const prefs = this.session.preferences;
    const opts: TtsOptions = {
      voice: prefs.voice || undefined,
      rate: prefs.rate,
      pitch: prefs.pitch,
      volume: prefs.volume,
      lang: prefs.language || undefined,
    };
    this.tts.speak(text, () => {
      this.session.setSpeaking(false);
      if (this.session.status === "speaking") {
        this.session.setStatus("idle");
      }
    }, opts);
  }

  /* --------------- ask (brain → TTS) --------------- */

  async askAtlas(text: string) {
    if (!text) return;
    this.session.trackSessionStart();
    this.session.trackQuestion();
    this.lastAskStartedAt = Date.now();
    this.session.setStatus("thinking");
    this.session.addReasoning("Processing your question…");
    this.session.addUserMessage(text);

    const msg = this.session.beginAssistantMessage();
    this.session.addReasoning("Searching for context…");

    const brainReq = {
      text,
      context: this.session.context,
      history: this.session.messages.slice(-8),
    };

    try {
      const full = await this.brain.ask(brainReq, (delta) => {
        this.session.appendAssistantDelta(msg.id, delta);
      });
      this.session.finalizeAssistantMessage(msg.id);
      this.session.clearReasoning();
      this.session.trackLatency(Date.now() - this.lastAskStartedAt);
      this.speak(full);
    } catch (error) {
      this.session.finalizeAssistantMessage(msg.id);
      this.session.setError(
        error instanceof Error ? error.message : "Voice brain failed"
      );
      this.session.trackFailure();
      this.session.clearReasoning();
      this.session.setStatus("idle");
      // Fall back to local brain for a graceful reply.
      try {
        const localBrain = new LocalAtlasBrain();
        const fallback = await localBrain.ask(brainReq, () => {});
        this.session.appendAssistantDelta(msg.id, fallback);
        this.speak(fallback);
      } catch {
        this.session.setStatus("idle");
      }
    }
  }

  /* --------------- command routing --------------- */

  /** Input from STT or the typing field. */
  async processInput(text: string) {
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    const ctx: ToolContext = {
      page: this.session.context.page,
      mode: this.session.context.mode,
      claimId: this.session.context.claimId,
      claimNumber: this.session.context.claimNumber,
      decisionId: this.session.context.decisionId,
      documentId: this.session.context.documentId,
      supplementId: this.session.context.supplementId,
      interviewId: this.session.context.interviewId,
      extra: this.session.context.extra,
      navigate: this.options.navigate,
    };

    const intent = parseCommand(trimmed);

    if (!intent) {
      // Free-form question — route to the AI brain.
      this.session.setMode("general");
      await this.askAtlas(trimmed);
      return;
    }

    this.session.trackSessionStart();
    this.session.trackCommand(intent.id);
    this.session.setMode(modeForIntent(intent));

    if (intent.toolId === "navigate") {
      const path = intent.params.path || "/admin";
      this.options.navigate?.(path);
      this.session.addUserMessage(trimmed);
      this.session.beginAssistantMessage(intent.label);
      this.session.appendAssistantDelta(
        this.session.messages[this.session.messages.length - 1].id,
        `Navigating to ${path.replace("/admin/", "")}…`
      );
      this.session.finalizeAssistantMessage(
        this.session.messages[this.session.messages.length - 1].id
      );
      this.session.setStatus("idle");
      return;
    }

    // Resolve context + execute the tool.
    const params = resolveContext(intent, ctx);
    this.session.addUserMessage(trimmed);
    this.session.setStatus("thinking");

    let toolResult: ToolResult;
    try {
      toolResult = await this.tools.run(intent.toolId, params, ctx);
    } catch (error) {
      // Never leave the user stranded: report the failure and idle out.
      this.session.trackFailure();
      this.session.setError(
        error instanceof Error ? error.message : "Tool execution failed"
      );
      const errMsg = error instanceof Error ? error.message : "Something went wrong";
      this.session.beginAssistantMessage(intent.id);
      const errMessage = this.session.messages[this.session.messages.length - 1];
      this.session.appendAssistantDelta(
        errMessage.id,
        `I hit an error while running that. ${errMsg}`
      );
      this.session.finalizeAssistantMessage(errMessage.id);
      this.session.setStatus("idle");
      return;
    }

    const reply = toolResult.ok ? toolResult.text : `I couldn't do that. ${toolResult.text}`;
    this.session.beginAssistantMessage(intent.id);
    const msg = this.session.messages[this.session.messages.length - 1];
    this.session.appendAssistantDelta(msg.id, reply);
    this.session.finalizeAssistantMessage(msg.id);
    this.session.setStatus("idle");
    this.speak(reply);

    // Navigate if the tool returned a navigation target.
    if (toolResult.navigate) {
      this.options.navigate?.(toolResult.navigate);
    }
  }

  async runCommand(text: string) {
    await this.processInput(text);
  }

  clearConversation() {
    this.session.clear();
  }
}
