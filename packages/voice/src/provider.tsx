/**
 * React provider + useVoice() hook.
 *
 * Mounted once in the root layout. Exposes the full engine API through
 * `useVoice()` to every component in the tree. The floating assistant UI
 * is rendered inside the provider so it persists across page navigation.
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VoiceEngine } from "./client";
import type {
  EngineEvent,
  EngineState,
  VoiceActions,
  VoiceConfig,
  VoiceContext,
  VoiceMode,
} from "./types";

// ─── Context ───────────────────────────────────────────────────────────

interface VoiceContextValue {
  state: EngineState;
  actions: VoiceActions;
  engine: VoiceEngine;
}

const Ctx = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVoice() requires a <VoiceProvider> ancestor.");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────

interface VoiceProviderProps {
  children: React.ReactNode;
  /** Configure navigation callback for voice commands. */
  onNavigate?: (path: string) => void;
}

export function VoiceProvider({ children, onNavigate }: VoiceProviderProps) {
  const engineRef = useRef<VoiceEngine | null>(null);
  const [state, setState] = useState<EngineState>(() => ({
    status: "idle",
    tier: "browser",
    muted: false,
    config: null,
    messages: [],
    segments: [],
    reasoning: [],
    context: { page: "", mode: "general" },
    error: null,
    supported: { stt: false, tts: false },
    preferences: {
      voice: "",
      language: "en-US",
      rate: 1.02,
      pitch: 1,
      volume: 1,
      wakeWord: false,
      autoListen: false,
      pushToTalk: false,
      continuous: false,
    },
    analytics: {
      sessions: 0,
      commands: {},
      questions: 0,
      avgLatencyMs: 0,
      failures: 0,
      interruptions: 0,
      lastActiveAt: 0,
    },
  }));

  // Initialize engine once.
  useEffect(() => {
    const engine: VoiceEngine = new VoiceEngine({
      navigate: onNavigate,
      getContext: () => {
        // Default: the context set on the session externally.
        return engine.session.context;
      },
    });
    engineRef.current = engine;

    const unsub = engine.session.subscribe((event: EngineEvent) => {
      // React to all session events by snapshotting state.
      setState(engine.session.snapshot());
    });

    // Fetch config on mount.
    engine.fetchConfig({ page: "", mode: "general" }).then(() => {
      setState(engine.session.snapshot());
    });

    // Mark session end on page unload. Analytics must never block navigation.
    const onUnload = () => {
      try {
        engine.session.trackSessionEnd();
      } catch {
        /* noop */
      }
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      unsub();
      window.removeEventListener("beforeunload", onUnload);
      engine.stopListening();
      try {
        engine.session.trackSessionEnd();
      } catch {
        /* noop */
      }
    };
  }, [onNavigate]);

  const engine = engineRef.current;

  const actions = useMemo<VoiceActions>(
    () =>
      engine
        ? engine.actions
        : {
            startListening: () => {},
            stopListening: () => {},
            toggleMute: () => {},
            interrupt: () => {},
            speak: () => {},
            askAtlas: () => Promise.resolve(),
            runCommand: () => Promise.resolve(),
            clearConversation: () => {},
            setMode: () => {},
            setContext: () => {},
            clearContext: () => {},
            updatePreferences: () => {},
            resetPreferences: () => {},
            pushToTalkStart: () => {},
            pushToTalkEnd: () => {},
          },
    [engine]
  );

  const value = useMemo<VoiceContextValue>(
    () => ({
      state,
      actions,
      engine: engine ?? ({} as VoiceEngine),
    }),
    [state, actions, engine]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
