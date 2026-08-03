/**
 * Speech layer — the ONLY place in the codebase that touches browser
 * SpeechRecognition / speechSynthesis and the Cartesia TTS route.
 *
 * Everything here degrades gracefully: if a provider is unsupported it
 * reports `supported: false` and the engine falls back to typed input.
 */

/* ------------------------------------------------------------------ */
/* STT — browser SpeechRecognition (real, free, no external service)   */
/* ------------------------------------------------------------------ */

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** STT start options (extended for wake word + continuous mode). */
export interface SttStartOptions {
  /** Language override (defaults to en-US). */
  lang?: string;
  /** Continuous recognition (restarts after silence). */
  continuous?: boolean;
  onPartial(text: string): void;
  onFinal(text: string): void;
  onEnd(): void;
  onError(message: string): void;
}

export interface SttProvider {
  supported: boolean;
  start(options: SttStartOptions): void;
  stop(): void;
}

/** Real browser speech recognition with continuous + interim support. */
export class BrowserSttProvider implements SttProvider {
  readonly supported: boolean;
  private recognition: SpeechRecognitionLike | null = null;
  private running = false;

  constructor() {
    this.supported = isSpeechRecognitionSupported();
  }

  start(options: SttStartOptions) {
    if (!this.supported || this.running) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = options.lang || "en-US";
    rec.continuous = options.continuous ?? true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          options.onFinal(transcript);
        } else {
          interim += transcript;
        }
      }
      if (interim) options.onPartial(interim);
    };

    rec.onend = () => {
      this.running = false;
      options.onEnd();
    };

    rec.onerror = (e) => {
      if (e.error === "aborted" || e.error === "no-speech") {
        options.onEnd();
        return;
      }
      options.onError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access denied — enable the mic or type instead."
          : `Speech recognition error: ${e.error}`
      );
    };

    this.recognition = rec;
    this.running = true;
    try {
      rec.start();
    } catch {
      this.running = false;
      options.onError("Could not start speech recognition.");
    }
  }

  stop() {
    if (this.running && this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        /* noop */
      }
    }
    this.running = false;
  }
}

/** Wake-word matcher: "atlas", "hey atlas", "atlas voice". */
export function detectWakeWord(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  return (
    t.startsWith("atlas") ||
    t.startsWith("hey atlas") ||
    t.startsWith("ok atlas") ||
    /^(atlas|hey atlas|ok atlas)[,.\s]/.test(t)
  );
}

/** Strip the leading wake word so the remainder is the actual command. */
export function stripWakeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/^(hey|ok)?\s*atlas[,.\s]*/i, "")
    .trim();
}

/* ------------------------------------------------------------------ */
/* TTS — browser speechSynthesis (default) + Cartesia (premium)        */
/* ------------------------------------------------------------------ */

export interface TtsOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

export interface TtsProvider {
  readonly supported: boolean;
  speak(text: string, onDone?: () => void, options?: TtsOptions): void;
  stop(): void;
}

/** Zero-config TTS using the browser's built-in speech synthesis. */
export class BrowserTtsProvider implements TtsProvider {
  readonly supported: boolean;

  constructor() {
    this.supported =
      typeof window !== "undefined" && "speechSynthesis" in window;
  }

  speak(text: string, onDone?: () => void, options?: TtsOptions) {
    if (!this.supported) {
      onDone?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options?.rate ?? 1.02;
      utterance.pitch = options?.pitch ?? 1;
      utterance.volume = options?.volume ?? 1;
      utterance.lang = options?.lang ?? "en-US";
      const voices = window.speechSynthesis.getVoices();
      const wanted = options?.voice || "";
      const preferred =
        (wanted && voices.find((v) => v.name === wanted || v.voiceURI === wanted)) ||
        voices.find((v) => v.lang === utterance.lang && /female|zira|samantha/i.test(v.name)) ||
        voices.find((v) => v.lang === utterance.lang);
      if (preferred) utterance.voice = preferred;
      utterance.onend = () => onDone?.();
      utterance.onerror = () => onDone?.();
      window.speechSynthesis.speak(utterance);
    } catch {
      onDone?.();
    }
  }

  stop() {
    if (!this.supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
  }
}

/**
 * Premium TTS via the Atlas TTS proxy route (`/api/voice/tts`) which talks
 * to Cartesia server-side (the API key never reaches the browser).
 * Falls back to the browser provider when unavailable.
 */
export class CartesiaTtsProvider implements TtsProvider {
  readonly supported: boolean;
  private audio: HTMLAudioElement | null = null;
  private controller: AbortController | null = null;
  private objectUrl: string | null = null;

  constructor(private apiBase: string) {
    this.supported = typeof window !== "undefined" && "Audio" in window;
  }

  speak(text: string, onDone?: () => void, options?: TtsOptions) {
    if (!this.supported || !text) {
      onDone?.();
      return;
    }
    this.stop();

    const controller = new AbortController();
    this.controller = controller;

    fetch(`${this.apiBase}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 2400),
        voice: options?.voice,
        rate: options?.rate,
        pitch: options?.pitch,
        volume: options?.volume,
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`tts ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        this.objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(this.objectUrl);
        this.audio = audio;
        if (options?.volume != null) audio.volume = options.volume;
        audio.onended = () => {
          this.cleanupAudio();
          onDone?.();
        };
        audio.onerror = () => {
          this.cleanupAudio();
          onDone?.();
        };
        audio.play().catch(() => {
          this.cleanupAudio();
          onDone?.();
        });
      })
      .catch(() => {
        // Cartesia unavailable — callers fall back to browser TTS.
        onDone?.();
      });
  }

  private cleanupAudio() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.audio = null;
  }

  stop() {
    this.controller?.abort();
    try {
      this.audio?.pause();
    } catch {
      /* noop */
    }
    this.cleanupAudio();
  }
}

/** No-op provider — used when the browser supports nothing. */
export class NoopTtsProvider implements TtsProvider {
  readonly supported = false;
  speak(_text: string, onDone?: () => void, _options?: TtsOptions) {
    onDone?.();
  }
  stop() {
    /* noop */
  }
}

/** Reduced-motion / speed-aware typewriter helper. */
export function shouldReduceMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
